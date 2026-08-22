# FormSearch 输入法合成(IME)处理 规格说明

> 与「表单校验 IME 防抖」任务不同:本规格处理的是 **搜索调度层抑制中间值**、
> **不阻断 Form value 本身更新**。
> 这是与 `hooks/useComposition.ts` / `components/ime/*` 的根本区别。

---

## 1. 问题与目标

### 1.1 问题描述

项目当前的列表搜索 (`pages/list/Index.tsx`) 使用原生 antd `<Form>` + `<Form.Item>` 逐字段手写，存在如下痛点：

1. **搜索组件复用难**：每新增一个列表页都要重复写 Form inline + 查询/重置按钮。
2. **没有输入即搜索**：只能点"查询"按钮才触发搜索，无法在字段变更时(加上 debounce)自动查询。
3. **中文 IME 输入引发无意义请求**：如果未来启用"输入即搜索"，用户用拼音输入 `北京` 的过程中会产生 `b / be / bei / beij / beijin / beijing / 北京` 多次无意义搜索请求，打爆后端 + 结果闪烁。
4. **事件合并未标准化**：在 Form.Item inner props 中写入 `onChange / onCompositionStart / onCompositionEnd` 没有统一机制。

### 1.2 目标用户

- 业务开发者（写列表查询页的人）: 用 `<SearchItem type / name / formItemProps / innerProps>` 声明式配置查询条件。
- 最终用户（使用中文/日文等 IME 输入法）：在搜索框输入拼音时不触发中间搜索，选字完成后自然搜索。

### 1.3 设计目标

1. **新增通用 `FormSearch + SearchItem` 体系**：公共 API 严格遵循 `{ type, name, formItemProps, innerProps }`。
2. **输入即搜索 + debounce**：在 `Form.onValuesChange` 上触发，所有搜索入口统一走调度器。
3. **IME composition 期间抑制搜索**：不吞 onChange、不拦截 Form value 流向 rc-field-form，仅在"是否执行真正的搜索调度"上做 gating。
4. **compositionend 后触发一次且仅一次搜索**：通过 queueMicrotask + 统一 scheduleSearch 入口，避免与 onChange 重复触发两次请求。
5. **事件合并**：保留 innerProps 透传的 `onChange / onCompositionStart / onCompositionEnd`，不覆盖。
6. **不侵入 Form.Item**：composition 事件仅绑定到真实 `<input>/<textarea>`。

### 1.4 非目标

- 不实现操作系统/浏览器 IME（已有环境提供）。
- 不做中文分词/拼音转汉字/智能搜索。
- 不重写 antd Form 的 value / onChange 数据链。
- 不改造 Select、DatePicker 等非文本控件的 IME。
- 不修改 pages/list/Index 之外的页面（一个示范页即可,未来其他页可按同样模式替换）。
- 不对组件吞掉 UI 库 props(这点已在权限组件里强调)。

---

## 2. 功能需求（FR）

### FR-1 FormSearch 容器组件

新建 `apps/web/src/components/FormSearch/FormSearch.tsx`
- **children**：0~N 个 `<SearchItem>`（或任意合法 children，但约定 SearchItem 为主要孩子）。
- **Props**：
  - `form?`：可选，外部传入 Form instance；不传入则内部创建。
  - `onSearch(values)`：必选，当搜索应该被执行时调用(在其内部执行分页归位、调用 queryXXX)。
  - `debounceMs?`：默认 280ms，非负整数；**仅用于输入即搜索**，"查询按钮 submit"不受 debounce 影响(立即执行)。
  - `triggerOnChange?`：默认 `true` —— 是否在 onValuesChange 触发搜索调度(即输入即搜索开关)；`false` 时退化为"仅查询按钮/重置触发"。
  - `extra?` / `submitText?` / `showResetButton?`：可选的 UI 定制。
- **渲染结构**：`<IMEContext.Provider> → <Form layout="inline"> → children → 查询按钮(可选) → 重置按钮(可选) → 可选的 extra(如新增按钮)</Form> </IMEContext.Provider>`。
- **搜索调度统一入口**：`scheduleSearch({ force: boolean })`
  - `force=false`(普通 onChange / onValuesChange / compositionend)：检查 composingFields.size>0 → 若有 → 取消执行；否则走 debouncedSearch。
  - `force=true`(查询按钮 onFinish / 重置 / 外部 imperative 调用)：跳过 composing gating，但仍挂在 debounce 之前（立刻执行 debounce 的调用方 flush）。
- **debouncedSearch**：内部用 `useRef + setTimeout` 实现简单 debounce，同一 key 快速连续写入时只保留最后一次；卸载/下一次调度前 cancel 旧 timer。
- **compositionend 重新调度**：通过 IMEContext 暴露 `notifyCompositionEnd(name)`，调用方 IMEInput/IMETextArea 的 onCompositionEnd 中先 ime.endComposition(name) 再 queueMicrotask → `scheduleSearch({ force: false })`。
  - **防抖合并与重复搜索消除**：onCompositionEnd 触发的 scheduleSearch 与 紧接其后 onChange 触发的 scheduleSearch 走的是**同一个** `debouncedSearch`；因为 debounce 会 cancel 旧任务 → 最终只保留最后一次调用,避免两次请求。

### FR-2 IMEContext (内部)

新建 `FormSearch/contexts/IMEContext.tsx`
```ts
interface IMEContextValue {
  startComposition(name: React.Key): void
  endComposition(name: React.Key): void
  isComposing(name: React.Key): boolean
  hasComposing(): boolean          // 任一字段处于合成
  notifyCompositionEnd(name: React.Key): void  // end + queueMicrotask scheduleSearch
}
```
- 以 `composingFieldsRef = useRef(new Set<React.Key>())` 实现 per-field 独立 IME 标记（多字段并行 IME 互不影响）。
- 仅暴露给内部 IMEInput / IMETextArea；**不作为公共导出**。

### FR-3 useIME Hook

新建 `FormSearch/hooks/useIME.ts`
```ts
function useIME(
  fieldName: React.Key,
  opts?: {
    onCompositionStart?: React.CompositionEventHandler<HTMLInputElement | HTMLTextAreaElement>
    onCompositionEnd?: React.CompositionEventHandler<HTMLInputElement | HTMLTextAreaElement>
  }
): {
  onCompositionStart: React.CompositionEventHandler<...>
  onCompositionEnd: React.CompositionEventHandler<...>
}
```
- 在 Context 未提供(即 IMEInput 被单独拿出来用在 FormSearch 外)时，优雅退化：仅执行用户回调、不做调度（不抛错、不 warn，保证组件在任何环境可用）。
- 永远链式调用用户传入的 `onCompositionStart / onCompositionEnd`（若有）。

### FR-4 IMEInput 组件（Input 专用、不重包装 onChange）

新建 `FormSearch/components/IMEInput.tsx`

- 本质是 antd `<Input>`，接收完整 antd `InputProps` 并 100% 透传（除了我们自己要加的 `onCompositionStart / onCompositionEnd` 在尾部包一层）。
- **不要**重包装 `onChange`！Form.Item 注入的 onChange 必须原封不动走 antd/rc-field-form 的数据链，确保 Form value 合成中间拼音状态也能实时存储(以便输入到一半切 tab 回来值还在)。
- **禁止**用 `onChange={(e) => { if (composing) return; props.onChange?.(e) }}`—— 这种做法会让 Form.Item 无法在合成期同步 value，与设计目标相反。
- 在 `onCompositionStart` 中：`ime.startComposition(fieldName)` → 调用用户 `props.onCompositionStart?.(e)`。
- 在 `onCompositionEnd` 中：`ime.notifyCompositionEnd(fieldName)` → 调用用户 `props.onCompositionEnd?.(e)`。
- 通过 `forwardRef` 透传 antd Input 的 ref（`InputRef` 类型）。
- 支持 fieldName 与 Form.Item name 对齐；若用户未传 fieldName，尝试自动从最近的 rc-field-form FieldContext 拉取 name（通过 `import { FieldContext } from 'rc-field-form'` —— 若不好取则在 SearchItem 构造时显式传入）。

### FR-5 IMETextArea 组件

- 实现完全同 FR-4，只是 antd 组件是 `<Input.TextArea>`，ref 类型兼容。

### FR-6 SearchItem 组件

新建 `FormSearch/SearchItem.tsx`

```ts
type SearchItemType =
  | 'input'
  | 'textarea'
  | 'select'
  | 'date'
  | 'range'

interface SearchItemProps {
  type: SearchItemType
  name: string | string[]
  formItemProps?: FormItemProps
  innerProps?: Record<string, any>
  children?: React.ReactNode
}
```
- 渲染：
  ```
  <Form.Item name={name} {...formItemProps}>
    {children 若提供 → children}
    {否则按 type 渲染:}
      input    → <IMEInput  fieldName={name} {...innerProps} />
      textarea → <IMETextArea fieldName={name} {...innerProps} />
      select   → <Select {...innerProps} />
      date     → <DatePicker {...innerProps} />
      range    → <RangePicker {...innerProps} />
  </Form.Item>
  ```
- name 规范化：`string | string[]` 统一成字符串 key（join('.') 或 `${String(name[0])}${name.length>1?'.'+name.slice(1).join('.'):''}`），传给 IME* 的 fieldName。
- **innerProps 事件完全保留**：IMIInput/IMETextArea 在 `useIME({ onCompositionStart: innerProps.onCompositionStart, onCompositionEnd: innerProps.onCompositionEnd })` 中已经串了用户回调，SearchItem 不再做额外包装。

### FR-7 FormSearch 的 onValuesChange / onFinish 整合

- **onValuesChange(changedValues, allValues)**：
  1. 若是 `triggerOnChange=false` → return；
  2. 否则调用 `scheduleSearch({ force: false })`。
- **onFinish**：`scheduleSearch({ force: true })`（立刻 flush debounce）。
- **重置按钮 onClick**：
  1. `form.resetFields()`
  2. `scheduleSearch({ force: true })`（重置后也应该重新查询）。

### FR-8 列表页应用示范

在 `pages/list/Index.tsx` 中：
- 原有的 `<Form inline> → N 个 Form.Item + 按钮` 整个搜索区块，替换为：
  ```tsx
  <FormSearch<QueryForm>
    onSearch={() => setPage(1)}
    debounceMs={280}
    triggerOnChange
    extra={<Button ...>新增记录</Button>}
  >
    <SearchItem
      type="input"
      name="keyword"
      formItemProps={{ label: '关键字' }}
      innerProps={{ placeholder: '编号/用户名/邮箱', allowClear, prefix:<SearchOutlined/>, style:{minWidth:220} }}
    />
    <SearchItem
      type="select"
      name="role"
      formItemProps={{ label: '角色' }}
      innerProps={{ placeholder: '全部', allowClear, style:{minWidth:140}, options:[...] }}
    />
    <SearchItem
      type="select"
      name="status"
      formItemProps={{ label: '状态' }}
      innerProps={{ placeholder: '全部', allowClear, style:{minWidth:140}, options:[...] }}
    />
  </FormSearch>
  ```
- 搜索触发源改为从 FormSearch 的 `onSearch` → `setPage(1)` → 在 useEffect 中 `[page,pageSize]` 触发 `queryFormRecords(values+page+pageSize)`；但注意 values 需要从新的 `form.getFieldsValue()` 拿(可传 form 给 FormSearch)。
- 或者更自然：FormSearch 把 `form` 暴露给父——可以通过 `const [queryForm] = Form.useForm()` 在外层创建后传进 `<FormSearch form={queryForm}>`，这样 effect 里 `queryForm.getFieldsValue()` 仍然可用，无破坏。

---

## 3. 非功能需求（NFR）

### NFR-1 代码分层与开闭原则
- 新增代码全集中在 `components/FormSearch/` 目录，不污染其他组件。
- 新增 `type`：在 SearchItem 的 switch 中增加 case + 对应的 Control component（可扩展，**对扩展开放**）；现有逻辑零修改（**对修改关闭**）。
- IME 机制（Context、Hook）与控件（IMEInput/IMETextArea）解耦，任何将来的 SearchControl 只要 `{...useIME(fieldName, opts)}` 展开即可接入 IME，不需要修改 FormSearch 容器。

### NFR-2 鲁棒性
- 无 IMEContext 时 IMEInput/IMETextArea 不抛错 → 组件可独立在任意页面复用。
- 重复调用 start/end composition → Set.add/delete 幂等。
- debounce timer 在组件卸载时 clearInterval/clearTimeout，避免内存泄漏或 setState 到已卸载组件。
- `queueMicrotask` 不可用时，退化为 `setTimeout(fn, 0)`。

### NFR-3 性能
- IME 全部状态用 `useRef + Set`，不触发 re-render（仅 gating 搜索调度）。
- debounce 对快速英文输入也有节流效果 → 减少请求数量。
- 不重包装 onChange：Form value 变动不经过自定义包装函数，链路长度等同原生 antd。

### NFR-4 类型安全（TypeScript）
- `FormSearch<T>`、`SearchItemProps`、`IMEContextValue`、`useIME` 参数类型、IMEInput/IMETextArea `ForwardRef<antd Ref>` 全部显式定义。
- 最少使用 `any`。对 antd/rc-component 无法从导出拿到的类型（如 `InputNumberRef`），用 `ComponentRef<typeof InputNumber>` 替代。

### NFR-5 风格一致性
- 现有代码的中文注释、分节分隔符、设计哲学声明等风格保持一致。
- 遵循用户 Git 提交规范：中文 + conventional format。

---

## 4. 约束/依赖/假设

### 约束（C）
- C1：SearchItem 公共 API `{ type, name, formItemProps, innerProps }` 不改变。业务层代码不得加 `enableIME` 等新属性。
- C2：绝对不能通过覆盖 Form.Item 的 onChange 来实现 IME gating；Form value 必须在 IME 合成期实时更新。
- C3：composition/onChange 都必须保留用户 innerProps 传入的同名回调(链式调用)。
- C4：不能在 Form.Item 上挂 onCompositionStart/End（Form.Item 不是 DOM 事件目标）。
- C5：不在 IME 期间 `setValue / format` 或任何方式强制覆盖 Input value。

### 依赖（D）
- D1：antd v6（项目已有）：Input、Input.TextArea、Select、DatePicker、Form、Button。
- D2：rc-field-form（antd 内部依赖已装）：`FieldContext` 可选（自动推断 name 的备选）。
- D3：现有 `pages/list/Index.tsx` 结构、`queryFormRecords({keyword,role,status,page,pageSize})` 接口。

### 假设（A）
- A1：浏览器支持 `compositionstart / compositionend / queueMicrotask`，退化 fallback 为 setTimeout。
- A2：在同一字段 composition 完成后，onChange 事件或 form value 会在同一 microtask 或下一帧之前同步到 form store（这是 React Synthetic Event + rc-field-form 的一贯行为，如文档章节 17、18 所述），故 queueMicrotask 后读 form.getFieldsValue 能拿到最终值。
- A3：debounceMs 默认 280ms 对中文用户（拼音选字节奏≈300ms 左右）是合理的，不会过度延迟也不会合并不了。

---

## 5. 开放问题

- Q1：当一个字段在 composition 中，**其他字段**发生普通 onChange 是否允许触发搜索？
  - **规格选择**：允许。因为 ScheduleSearch 在检查时对 "其他字段" 来说它的 IME 状态本身无意义（IME 是"字段正在输入中，这字段的中间值我不想拿来搜"，其他字段变更应当正常触发）。
  - 但：当前实现简单策略"任意 composing 就不执行"与这里矛盾。→ 采用 **更精确的实现**：在 `FR-1 scheduleSearch` 中不要用全局 size 判断，改为在 `onValuesChange(changedValues)` 中对**每个改变的字段**检查 `ime.isComposing(field)`，若 **至少有一个 changed 字段正在 IME 合成**，则**跳过该次 scheduleSearch**；若 changed 字段都不在合成期，则正常调度。这样 A 字段拼音过程中，B 字段 change → A.isComposing=true 但它不是 changed 字段 → 正常执行 B 触发的搜索。
  - **修正 FR-1 scheduleSearch 为带 changedFieldsName 参数的签名**：`scheduleSearch({ force, changedFields? })`。
- Q2：compositionend 的 notifyCompositionEnd 直接触发一次调度，是否应该带 `changedFields=[fieldName]`？是的，已在 FR-2 notifyCompositionEnd 实现中携带。

---

## 6. 验收准则（Acceptance Criteria）

### 规则类（rule）—— 必须满足

| ID | 验收条件 | 验证方法 |
|---|---|---|
| AC-R1 | SearchItem 公共 API `(type, name, formItemProps, innerProps)` 未改变；业务层传 enableIME 等新参数不应该也不需要。 | 静态代码审查 + 列表页实际使用代码。 |
| AC-R2 | IME 合成期间，Form value（`form.getFieldValue(name)`）仍实时更新为中间拼音字符串。 | DevTools / 手动中文输入+观察 onValuesChange 打印。 |
| AC-R3 | IME 合成期间不发起真实 search 调用（onSearch 回调不执行）。 | 在 onSearch 中加 console.log；手动输入 "beijing→北京"，合成期间无日志，选字后恰好一次(或 debounce 后一次)。 |
| AC-R4 | compositionend 后只触发一次 search；不得出现 compositionend 与 onChange 各触发一次导致请求重复。 | Network 面板/onSearch 日志计数。 |
| AC-R5 | 普通英文输入 `abc` 时：行为未退化，正常触发 debounced search。 | 快速输入 abcd → 只有一个请求在 debounce 后执行。 |
| AC-R6 | innerProps.onCompositionStart / onCompositionEnd / onChange：用户提供的这三个回调都必须按原顺序/语义执行，IME 处理逻辑不能覆盖它们。 | 在示例页传 spy 回调，手动触发后检查调用次数。 |
| AC-R7 | Form.Item 上未被写入 onCompositionStart/End（验证 C4）。 | grep Form.Item 代码不出现 composition。 |
| AC-R8 | 卸载组件后无泄漏：timer 被清理；setState 抛错("Can't perform a React state update on an unmounted component")不出现在控制台。 | 快速路由切换后 console。 |
| AC-R9 | 列表页接入 FormSearch 后功能等价：查询 / 重置 / 分页行为不变；keyword、role、status 三项字段均能正确过滤 mock 数据。 | 手动端到端：输入"zhang"→用户=zhang_0 出现在列表；选"admin"角色→只剩管理员。 |
| AC-R10 | 多个搜索字段并行 IME（理论例：name="备注" 中文输入中，同时切换 Tab 输入 keyword="上海"） → 每个字段独立维护 IME 状态，互不干扰；结束后都能正常触发。 | 手动/或 DOM 合成事件 dispatch 模拟。 |
| AC-R11 | `pnpm build` 0 errors。 | 运行构建命令。 |
| AC-R12 | Select / DatePicker / RangePicker 在 SearchItem 中行为不变（它们不应被接入 IME 事件，无副作用）。 | 手动点击选择 → 正常 search 调度触发。 |

### 评估类（rubric）—— 维度评分（0-2，≥1 通过）

| ID | 维度 | 低(0) | 中(1) | 高(2) |
|---|---|---|---|---|
| AC-U1 | 代码结构清晰度与职责分离 | 所有逻辑写一个文件、FormSearch/IMEControl 耦合 | 分层但仍有 1-2 个混合职责(如 SearchItem 里包含调度逻辑) | 严格按章节 27 目录：FormSearch / SearchItem / components(IMEInput,IMETextArea) / hooks(useIME) / contexts(IMEContext) 分文件；单一职责；开闭原则 |
| AC-U2 | 不重复造轮子与可复用性 | IMEContext、useIME 中出现 IMEInput 也重复写同样逻辑 | 有复用但 copy 3+ 行代码未统一 | IMEInput/IMETextArea 纯用 useIME 注入事件、零直接写 Set 操作；FormSearch 零 IME 组件内部细节 |
| AC-U3 | 类型安全 | 文件中出现 5+ 处 `any` / `as any` | 2–4 处 `any`（有明确注释说明为何 antd 无法拿到类型） | 最多 1 处 `any`（注释说明：antd rc-component 合成事件透传的 DOM 属性） |
| AC-U4 | 对"不吞 onChange、不重写 Form.Item 受控链"的遵循度 | 代码中出现 `onChange = (e) => { if (composing) return }` 等拦截 | 某个组件有间接包装 onChange，但不影响 Form value | 所有 IME* 组件 100% 不包装 onChange；仅靠 composition 事件维护状态，Form.Item 注入的 onChange 原样传入 antd 控件 |
| AC-U5 | 文档 & 注释质量（含中文，符合用户现有风格） | 无注释缺分节分隔线 | 关键函数有注释，但缺整体模块设计声明 | 模块头声明设计哲学（符合文档设计原则 + C2~C5 约束），关键函数（scheduleSearch / useIME / IMEInput）有中文 JSDoc，含"不吞 onChange"的注意事项 |
