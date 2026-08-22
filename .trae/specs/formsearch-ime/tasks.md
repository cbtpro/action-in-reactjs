# FormSearch IME 实现任务清单

> 对应 spec: `.trae/specs/formsearch-ime/spec.md`

---

## Task 1: IMEContext（FormSearch 内部 per-field IME 状态容器）

- **优先级**：high
- **父验收准则**：FR-2, AC-R2, AC-R10
- **依赖**：无
- **产出文件**：`apps/web/src/components/FormSearch/contexts/IMEContext.tsx`
- **实现范围**：
  - `export const IMEContext = React.createContext<IMEContextValue | null>(null)`，不对外导出(通过 Provider/useContext 在包内内部使用)。
  - 创建工厂函数 `function createIMEController(handlers: { scheduleSearch: (opts: { force: boolean, changedFields?: React.Key[] }) => void }): IMEContextValue`，由 FormSearch 在创建 scheduler 后注入其 `scheduleSearch`，避免"Context 需要依赖外部搜索调度"的循环。
  - 实现：`startComposition / endComposition / isComposing / hasComposing / notifyCompositionEnd`，其中 `notifyCompositionEnd` = `endComposition(name)` + `queueMicrotask(() => scheduleSearch({ force:false, changedFields:[name] }))`（Q1 精确调度）。
  - 所有状态存储在 `composingFieldsRef = React.useRef(new Set<React.Key>())` 中，零 re-render。
  - queueMicrotask 不可用时退化为 `setTimeout(fn, 0)`。

### 本任务本地测试需求（TR）

#### Rule（客观可验证）

| ID | TR | 验证方式 |
|---|---|---|
| T1-R1 | `startComposition('a') → isComposing('a') === true; hasComposing() === true; isComposing('b') === false` | 直接调用后断言（在 FormSearch 单元里写一次测试型 console 验证） |
| T1-R2 | 连续两次 `startComposition('a')` 后 `endComposition('a')` → Set 为空（幂等） | 同上 |
| T1-R3 | `notifyCompositionEnd('a')` 最终调用传入的 `scheduleSearch({ force:false, changedFields:['a'] })`，且调用放在 microtask 之后 | 嵌套 `queueMicrotask(a), schedule(fn), schedule(b)`：b 执行前 a 已执行 |
| T1-R4 | 浏览器没有 queueMicrotask 时自动降级 setTimeout（可通过 spy window.queueMicrotask = undefined 后 mock setTimeout 验证） | 仅代码审查即可 |

#### Rubric（质量评分）

| ID | 维度(阈值≥1) | 评价锚点 |
|---|---|---|
| T1-U1 | 状态隔离(0-2)：全局 boolean vs per-field Set | 0:只做全局 boolean；1:有 Set 但实现有 bug；2:严格按 name，多字段互不影响 |
| T1-U2 | 零渲染(0-2)：状态存 useState 还是 useRef | 0:useState；1:混用但主要 ref；2:100% useRef |

---

## Task 2: useIME Hook

- **优先级**：high
- **父验收准则**：FR-3, AC-R6, NFR-2
- **依赖**：Task 1
- **产出文件**：`apps/web/src/components/FormSearch/hooks/useIME.ts`
- **实现范围**：
  - `useIME(fieldName, { onCompositionStart?, onCompositionEnd? })` 返回 `{ onCompositionStart, onCompositionEnd }`。
  - 内部 `const ctx = React.useContext(IMEContext)`；若 `ctx === null`，返回的合成事件只执行用户回调（不抛错、不 warn，NFR-2 优雅降级）。
  - 链式调用：
    - onCompositionStart：ctx.startComposition(fieldName) → 用户回调
    - onCompositionEnd：ctx.notifyCompositionEnd(fieldName) → 用户回调
  - 支持泛型：`HTMLInputElement | HTMLTextAreaElement`，单一 hook 复用。
  - 用 useCallback 包装返回函数避免多余重渲染。

### 本任务本地测试需求（TR）

#### Rule

| ID | TR | 验证方式 |
|---|---|---|
| T2-R1 | ctx 存在时：返回的 onCompositionStart(e) 会按序 ctx.startComposition(name) → 用户 onCompositionStart(e) 也执行 | spy 调用计数断言 |
| T2-R2 | ctx 存在时：返回的 onCompositionEnd(e) 会按序 ctx.notifyCompositionEnd(name) → 用户 onCompositionEnd(e) 也执行（microtask 后 scheduleSearch） | spy 调用顺序断言 |
| T2-R3 | ctx 不存在（没有 FormSearch/Provider）时：useIME 不抛错；仅执行用户回调；外层组件能正常 mount | 直接独立挂载 IMEInput 验证 |
| T2-R4 | 所有返回的事件包装器 useCallback 引用稳定（依赖数组正确） | 代码审查 + 依赖项无遗漏 |

#### Rubric

| ID | 维度(阈值≥1) | 评价锚点 |
|---|---|---|
| T2-U1 | 事件合并完整度(0-2) | 0：覆盖用户回调；1：仅保留一边；2：严格 C3「先 ctx 再用户」顺序，两边都执行 |

---

## Task 3: IMEInput 组件

- **优先级**：high
- **父验收准则**：FR-4, AC-R4, AC-R6, AC-U4（最重要：不吞 onChange）
- **依赖**：Task 2
- **产出文件**：`apps/web/src/components/FormSearch/components/IMEInput.tsx`
- **实现范围**：
  ```
  IMEInput = forwardRef<InputRef, InputProps & { fieldName?: React.Key }>
  ```
  - 从 props 解构：`{ fieldName, onCompositionStart, onCompositionEnd, onChange, ...rest }` —— **注意 onChange 不能动**！原样通过 `...rest` 或明确 `onChange={onChange}` 传递给 `<AntdInput>`（两种等价，但要显式写出来避免 future wrap）。
  - `const imeEvents = useIME(fieldName, { onCompositionStart, onCompositionEnd })`。
  - 最终：`<AntdInput ref={ref} {...rest} onChange={onChange} {...imeEvents} />`（**imeEvents 放后面，覆盖 rest 中的同名事件，确保 ctx 链不丢**；但 useIME 内部已包含用户回调，所以不会丢）。
  - `fieldName` 缺省时：尝试从 `rc-field-form` 的 `FieldContext.namePath` 推断。实现方式：
    ```ts
    const fieldCtx = React.useContext(FieldContext)
    const realName = fieldName ?? (fieldCtx.namePath?.length ? fieldCtx.namePath.join('.') : undefined)
    ```
    - 如果依然为 undefined（组件独立使用时），IME 机制不工作但组件仍正常（T2-R3 优雅降级保证）。
  - displayName：`'IMEInput'`。
  - **显式在模块 JSDoc 头注明：此组件不重包装 onChange，Form.Item 受控链完整。**

### 本任务本地测试需求（TR）

#### Rule

| ID | TR | 验证方式 |
|---|---|---|
| T3-R1 | `onCompositionStart/End` 合成事件执行后，能正确写入/清除 IME 状态（通过 ctx 的 isComposing 查询） | 手动 dispatch 合成事件后断言 |
| T3-R2 | 合成期间，onChange（Form.Item 注入的）**依然触发**，且 form.getFieldValue(name) 拿到中间拼音值 —— AC-R2 / C2 | 手动 dispatch input + onChange 后读 form value |
| T3-R3 | 用户 innerProps 传入的 onChange 仍被调用（因为 antd onChange 与包装的 composition 事件无关） | spy onChange 计数 |
| T3-R4 | 用户 innerProps 传入的 onCompositionStart/End 仍被调用（T2-R1/R2 保证） | spy 计数 |
| T3-R5 | ref 正常工作：`forwardRef` 后外部能拿到 `InputRef`，`inputRef.current?.focus()` 工作（仅检查类型 + 不报错即可） | 代码审查 + 类型检查 |
| T3-R6 | 代码中 **不出现** `onChange = useCallback((e) => { if (composing) return ... })` 模式（AC-U4） | grep 代码审查 |

#### Rubric

| ID | 维度(阈值≥1) | 评价锚点 |
|---|---|---|
| T3-U1 | innerProps 透传完整度(0-2) | 0：仅透传 3-5 个常用属性；1：有 spread 但 fieldName 被带入 antd（dom 多余属性 warning）；2：剥离 fieldName，其余 antd InputProps 100% 透传且无多余 DOM 属性 |
| T3-U2 | onChange 纯粹性(0-2)：是否真的 0 包装 | 0：包装 onChange；1：间接影响 onChange；2：onChange 直接赋值给 AntdInput onChange，零包装层 |

---

## Task 4: IMETextArea 组件

- **优先级**：high
- **父验收准则**：FR-5
- **依赖**：Task 2（复用 useIME）
- **产出文件**：`apps/web/src/components/FormSearch/components/IMETextArea.tsx`
- **实现范围**：完全照搬 Task 3，只是：
  - Antd `Input.TextArea`（导入 `Input` 后 `const TextArea = Input.TextArea`）
  - ref 类型与 `TextArea` 的 ref 一致
  - 支持 `fieldName?`、从 FieldContext 推断 name
  - JSDoc 同样声明："不吞 onChange"
- 目标：零 Set 操作、零重复逻辑（全部 useIME 注入）。

### 本任务本地测试需求（TR）

#### Rule

| ID | TR | 验证方式 |
|---|---|---|
| T4-R1 | 代码中零 composingRef 声明（完全复用 useIME） | grep 搜索 |
| T4-R2 | 功能与 IMEInput 等价：合成事件触发后 ctx 正确、onChange 不拦截 | 同上 Task 3 |

---

## Task 5: SearchItem 分发组件

- **优先级**：high
- **父验收准则**：FR-6, AC-R1, NFR-1（开闭）
- **依赖**：Task 3, Task 4
- **产出文件**：`apps/web/src/components/FormSearch/SearchItem.tsx`
- **实现范围**：
  - `type SearchItemType = 'input' | 'textarea' | 'select' | 'date' | 'range'`
  - `SearchItemProps = { type; name: string | string[]; formItemProps?: FormItemProps; innerProps?: Record<string,any>; children? }`
  - name 归一化函数 `normalizeName(name: string | string[]): string`：
    - string → 直接返回
    - string[] → 非空 join('.')（如 `['a','b',0] → 'a.b.0'`）
  - `renderControl(type, innerProps, normalizedName)`：
    - input → `<IMEInput fieldName={normalizedName} {...innerProps} />`
    - textarea → `<IMETextArea fieldName={normalizedName} {...innerProps} />`
    - select → `<Select {...innerProps} />`（透传 style 宽度 width:100% 作为 innerProps 的默认兜底？不要默认，全交给业务传的 innerProps，避免"封装组件吞掉 UI props"陷阱 —— 在 JSDoc 提醒）。
    - date → `<DatePicker {...innerProps} />`
    - range → `<RangePicker {...innerProps} />`
  - 最终返回 `<Form.Item name={name} {...formItemProps}>{ children ?? renderControl(...) }</Form.Item>`。
  - **不**在 Form.Item 上写 onCompositionStart/End（C4）。
  - 模块头 JSDoc：开闭原则说明「后续新增 type：加 case + 顶部类型联合，不改现有 switch 分支」；"小公司不盲目封装"说明：SearchItem 是**业务声明层**（不吞 props），底层仍直连 antd。

### 本任务本地测试需求（TR）

#### Rule

| ID | TR | 验证方式 |
|---|---|---|
| T5-R1 | 公共 API 仅 `(type, name, formItemProps, innerProps, children?)`，不含任何 IME 属性（AC-R1） | 类型定义审查 + 页面使用代码 |
| T5-R2 | type input 渲染的真实 DOM 节点上能触发 compositionstart/end 事件，并能让 IME 状态被写入（即 IMEInput 在工作） | 手动 dispatch 事件后查 form search scheduler 是否 gating |
| T5-R3 | Form.Item 属性上不出现 onCompositionStart/onCompositionEnd/onChange 覆盖（C4, AC-R7） | grep Form.Item props 代码审查 |
| T5-R4 | innerProps 传入的任何事件回调（含合成、onChange）都能执行（AC-R6，由 FR-3/T3 保证，SearchItem 不得做二次包装覆盖） | 传 spy 回调 + 验证调用 |
| T5-R5 | type select/date/range 控件正常 render 并交互（Select 能开下拉、DatePicker 能开面板） | 手动/类型检查 |

#### Rubric

| ID | 维度(阈值≥1) | 评价锚点 |
|---|---|---|
| T5-U1 | 开闭可扩展(0-2)：新增 type 的成本 | 0：需要改多个 switch；1：仅一个 switch，但 type 联合类型声明与渲染不在一起；2：类型 + switch 位置接近，新增 1 处 case + 1 处联合成员即完成 |
| T5-U2 | 不吞 props(0-2)：SearchItem 是否为 innerProps/FormItem props 加了多余自己的默认值覆盖业务传值 | 0：有默认 onChange/placeholder 覆盖用户传值；1：有 style 默认但用户可覆盖；2：零默认值，完全透传（所有默认让页面调用方写）—— 避免"小公司盲目封装 UI 外壳导致丢 props"陷阱 |

---

## Task 6: FormSearch 容器 + Scheduler + Debounce + Gating

- **优先级**：high
- **父验收准则**：FR-1, FR-7, AC-R3, AC-R4, AC-R5, AC-R8
- **依赖**：Task 1, Task 5
- **产出文件**：
  - 主文件：`apps/web/src/components/FormSearch/FormSearch.tsx`
  - 调度器（可选独立文件）：`apps/web/src/components/FormSearch/utils/searchScheduler.ts`
- **实现范围**：
  - **Props**：`<T extends object = Record<string, any>>(props: Props<T>) => ReactNode`
    - `form?: FormInstance<T>`（外部传入，不传则内部创建）
    - `onSearch(values: T): void`（搜索执行回调，由外部实现 setPage/调 queryAPI）
    - `debounceMs?: number = 280`（非负整数，≥ 0）
    - `triggerOnChange?: boolean = true`
    - `submitText?: React.ReactNode = '查询'`
    - `showResetButton?: boolean = true`
    - `submitButtonProps? / resetButtonProps?`
    - `extra?: React.ReactNode`（放在按钮组末尾，给"新增"等按钮）
    - `formProps?: Omit<FormProps<T>, 'form' | 'onFinish' | 'onValuesChange' | 'layout'>`（其余 antd Form 自定义属性透传，但 layout 锁 inline 避免排版破坏）
  - **内部创建 form**（如果没传）：`const internalForm = Form.useForm<T>(); const form = props.form ?? internalForm[0]`
  - **IMEContext 初始化**（FR-2, Q1 精确调度）：
    1. 先写 search scheduler ref（下面 section）。
    2. `const imeController = React.useMemo(() => createIMEController({ scheduleSearch }), [scheduleSearch])` —— **注意 createIMEController 中 scheduleSearch 是稳定引用(下面用 useCallback 生成)**。
  - **Search Scheduler**：
    - `const debounceTimerRef = useRef<number | null>(null)`
    - `const flushSearchRef = useRef<() => void>(() => {})` —— 真正执行 onSearch 的具体闭包引用，方便"force 调度"跳过 debounce。
    - `const scheduleSearch = useCallback(function scheduleSearch(opts: { force: boolean, changedFields?: React.Key[] }) { ... }, [form, onSearch, triggerOnChange, imeController])`（用命名函数便于调试栈）。
      1. 取 `changedFields = opts.changedFields ?? null`
      2. gating 逻辑：**仅当 opts.force === false 且 changedFields !== null 且 changedFields.some(f => imeController.isComposing(f))** → 直接 return（"某个正在 IME 的字段产生了 onChange → 跳过"，按 Q1 精确）。
      3. 若 force=false 且 changedFields=null（此情况保留：将来无 changedFields 时退化为全局判断），则 `if (imeController.hasComposing()) return`。
      4. flushSearchRef.current = () => onSearch(form.getFieldsValue())。
      5. 若 force=true：取消 debounceTimer；**同步**执行 flushSearchRef.current()。
      6. 若 force=false：按 `debounceMs` 设置 debounceTimer，超时后执行 flushSearchRef.current()。
    - **组件卸载清理**：`useEffect(() => () => { debounceTimerRef.current && window.clearTimeout(debounceTimerRef.current) }, [])`。
  - **Form 整合（FR-7）**：
    - `<Form form={form} layout="inline" onValuesChange={handleValuesChange} onFinish={handleFinish} {...formProps}>`。
    - handleValuesChange：
      - `if (triggerOnChange === false) return;`
      - 提取 `changedFields = Object.keys(changedValues)`（按嵌套 key 的 top-level；若 name 是数组，这里也需展开——可简化：`Object.keys(changedValues)` 等价顶层字段名）。
      - `scheduleSearch({ force: false, changedFields })`。
    - handleFinish：`scheduleSearch({ force: true })`（立刻 flush）。
  - **按钮区渲染**：
    - 在 children 渲染完之后、Form 尾部，固定渲染一组 Form.Item 包裹的操作栏：
      ```
      <Form.Item>
        <Space size="middle">
          <Button type="primary" htmlType="submit">{submitText}</Button>
          {showResetButton && <Button onClick={handleReset} icon={<ReloadOutlined />}>重置</Button>}
          {extra}
        </Space>
      </Form.Item>
      ```
    - handleReset：`form.resetFields(); scheduleSearch({ force: true })`。
  - **Provider 结构**（FR-2）：
    ```
    <IMEContext.Provider value={imeController}>
      <Form ...>
        {children}
        {操作按钮栏}
      </Form>
    </IMEContext.Provider>
    ```
  - 对外导出：`export function FormSearch<T>(...)` + `export { SearchItem }` + `export type { SearchItemProps, SearchItemType }`。`index.ts` 统一导出。

### 本任务本地测试需求（TR）

#### Rule

| ID | TR | 验证方式 |
|---|---|---|
| T6-R1 | 普通输入英文"abc"：onChange 触发 scheduleSearch(force=false, changedFields=['keyword'])；debounce 后执行一次 onSearch（AC-R5） | onSearch 计数 + 时间 |
| T6-R2 | 中文 IME：startComposition('keyword') → 然后连续多次 onValuesChange(keyword 变) → 这些 scheduleSearch(changedFields=['keyword']) 因为 keyword.isComposing=true 全部 return 不执行（AC-R3） | 计数 + 判断 return 路径 |
| T6-R3 | compositionend 后 notifyCompositionEnd('keyword') 触发 scheduleSearch(changedFields=['keyword'])，此时 isComposing='keyword' 已 false → debounced 执行一次最终搜索（AC-R3/R4） | 最终请求计数恰好 == 1 + debounce 后执行 |
| T6-R4 | 重复搜索消除：onCompositionEnd → queueMicrotask scheduleSearch(A)；紧接着 rc-field-form 触发 onValuesChange → scheduleSearch(B)；A 和 B 都调用同一个 debounce，debounceMs 内先后写入 → 只保留 B 或 A（靠后那个），**最终 onSearch 执行 1 次**。（AC-R4 最重要） | 连续触发两次 scheduleSearch(force=false, same changedFields) 看 onSearch 计数 1 |
| T6-R5 | force=true 调度：查询按钮 submit / 重置 onClick → debounceTimer 被 cancel 立刻执行；onChange 的 debounce 已正在等待 → 点击查询按钮能立即打断并立即 flush | 快速输入+立刻点查询：立即 flush 不延迟 |
| T6-R6 | A 字段 composition 中；B 字段正常变更：scheduleSearch(changedFields=[B]) → B 不在 composing → 正常执行；精确 gating（Q1 规则）而非全局禁止 | A composing + B change → onSearch 仍执行 1 次 |
| T6-R7 | 组件卸载后无泄漏：`clearTimeout(debounceTimerRef.current)` 执行（AC-R8） | 挂载 → unmount → spy setTimeout/clearTimeout 配对 |
| T6-R8 | form 可外部传入：外部 `const [f] = Form.useForm()` 传入后，内部用这个 form；`form.getFieldValue` 能查到值 | 实际代码验证 list 页替换后可正常 getFieldsValue() |

#### Rubric

| ID | 维度(阈值≥1) | 评价锚点 |
|---|---|---|
| T6-U1 | 精确调度(Q1 实现)全局 vs 粒度(0-2) | 0：只要有任何 composing 就全部禁止；1：全局+字段模式混合不清；2：严格按 changedFields 逐条检查 isComposing，非 changed 的 composing 字段不阻塞 |
| T6-U2 | debounce 与 force 逻辑正确度(0-2) | 0：force 走 debounce（点查询会延迟）；1：force 立即 flush 但不清 pending timer；2：force 清 timer + 立即 flush，符合 T6-R5 |
| T6-U3 | Scheduler 可读性(0-2) | 0：所有逻辑混在 FormSearch return 前一长段函数；1：拆函数但职责不清；2：有完整 JSDoc（含"不吞 onChange / composition gating / debounce / force flush"的链路说明与伪代码参考 spec 章节 19~20） |

---

## Task 7: 导出统一入口 index.ts + 列表页替换

- **优先级**：high
- **父验收准则**：FR-8, AC-R9, FR-8
- **依赖**：Task 6
- **产出文件**：
  - `apps/web/src/components/FormSearch/index.ts`
  - 改造 `apps/web/src/pages/list/Index.tsx` 的搜索区块
- **实现范围**：
  - index.ts：
    ```ts
    export { FormSearch } from './FormSearch'
    export { SearchItem } from './SearchItem'
    export type { SearchItemProps, SearchItemType } from './SearchItem'
    export type { FormSearchProps } from './FormSearch'
    ```
  - list/Index.tsx 改造：
    - 保留现有 `const [queryForm] = Form.useForm<QueryForm>()` 外部创建 form（T6-R8）。
    - 替换原来整块 `<Form<QueryForm> ...> ...3 个 Form.Item + 按钮 + 新增按钮</Form>` 为 `<FormSearch<QueryForm> ...>...</FormSearch>`：
      ```
      <FormSearch<QueryForm>
        form={queryForm}
        onSearch={handleSearch /* 现在 handleSearch 定义为 () => setPage(1) */}
        debounceMs={280}
        triggerOnChange
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/form')}>新增记录</Button>}
      >
        <SearchItem type="input" name="keyword" formItemProps={{label:'关键字'}} innerProps={{placeholder:'编号/用户名/邮箱', allowClear, style:{minWidth:220}, prefix:<SearchOutlined />}} />
        <SearchItem type="select" name="role" ... />
        <SearchItem type="select" name="status" ... />
      </FormSearch>
      ```
    - 注意：原来 `useEffect([page, pageSize, queryForm, message])` 依赖中 `queryForm` 是稳定的，但取 values 的地方要用 `queryForm.getFieldsValue()` 而不是旧代码 108 行的 `const values = queryForm.getFieldsValue()`（已经是这样了，保持即可）。
    - 原来定义的 `handleSearch = () => { setPage(1) }` 继续作为 FormSearch 的 `onSearch` 传入。
    - `handleReset` 在 FormSearch 内部实现了（重置字段+force search），页面无需再写（但如果原来需要其他副作用可保留）。
  - 类型检查：确认 `QueryForm` 传入 FormSearch 泛型后，onSearch 回调不接受参数也没关系（如果想用 form.getFieldsValue，onSearch 里 `const values = queryForm.getFieldsValue()` —— 但实际上我们在 scheduleSearch 的 flush 里已经传了 values，这里可把 onSearch 签名改为接收 values 以简化：
    - `onSearch={(values) => { console.log('搜索条件', values); setPage(1); }}`
    - 这样 list 页的 onSearch 中可以直接拿 values 用于效果验证/打印，虽然实际 effect 用 queryForm.getFieldsValue()（取的是同一 store，一致性没问题）。
  - 不改变列表其他布局：Table 滚动、Pagination 固定底、ResizeObserver 逻辑全部保留。

### 本任务本地测试需求（TR）

#### Rule

| ID | TR | 验证方式 |
|---|---|---|
| T7-R1 | 列表页运行时无错：输入关键词 → 触发 queryFormRecords 过滤；结果正确（AC-R9） | 手动验证 |
| T7-R2 | 查询按钮 → 立即搜索(force flush)：无 280ms 延迟（T6-R5） | 快速点击后计数 + 时间观察 |
| T7-R3 | 重置按钮 → 字段清空 + 立即搜索回到全量列表 | 手动验证 |
| T7-R4 | 输入即搜索：连续输入"zhang" → 在 debounceMs 之后执行 1 次（T6-R1） | console 计数 |
| T7-R5 | triggerOnChange=true 可切换，false 时只有按钮可触发搜索（代码审查 props 存在即可） | 类型 + 代码审查 |
| T7-R6 | 列表页打开控制台无 warning、无 error（包括 Form.Item 的"field 属性重复/未声明"等 antd 警告） | 实际打开页面检查 |

#### Rubric

| ID | 维度(阈值≥1) | 评价锚点 |
|---|---|---|
| T7-U1 | 替换前 vs 替换后代码行数变化：替换后更简洁(0-2) | 0：反而更长；1：近似同等行数；2：减少 ~30%+ 或可维护性显著提升（声明式配置代替手写 Form.Item + 按钮） |
| T7-U2 | 不影响列表 UI(0-2) | 0：滚动/Pagination 破坏；1：有轻微布局偏差；2：表体滚动、分页位置完全不变，用户视觉一致 |

---

## Task 8: Build & Manual QA

- **优先级**：medium
- **父验收准则**：AC-R11, 全部 AC 实际手动验证
- **依赖**：Task 7
- **产出文件**：无（运行验证）
- **实施范围**：
  1. `cd apps/web && pnpm build` → 0 errors。
  2. Dev server 打开 `/list` 路由页：
     - [ ] 手动检查搜索 UI 外观（查询/重置/新增按钮）
     - [ ] 输入"admin"(英文普通搜索) → debounce 后过滤出 role=admin
     - [ ] 选择角色 Select / 状态 Select → 立即触发搜索(非 IME)
     - [ ] 手动切换输入法输入"张"（中文 IME） → 合成期间无搜索请求；选字后恰好 1 次请求 + 过滤出含"张"的记录
     - [ ] DatePicker 如果在 SearchItem type=date 存在(未使用但未来可扩展) → 检查不触发 composition 副作用
     - [ ] 查询按钮点击 → 立即刷新
     - [ ] 重置 → 清空 + 立即刷新 + 全量列表
     - [ ] 打开 `/list` 后立即切换到其他路由 → 卸载组件，控制台 setState 无报错（AC-R8）
  3. 若 innerProps 事件合并未写测试，在 DevTools 中临时手动：
     ```js
     // 在 keyword IMEInput input 元素上
     el.addEventListener('compositionstart', () => console.log('用户 start 执行'))
     el.addEventListener('compositionend', () => console.log('用户 end 执行'))
     ```
     → 输入法输入时检查 both 输出均打印（AC-R6）。

### 本任务本地测试需求（TR）

#### Rule

| ID | TR | 验证方式 |
|---|---|---|
| T8-R1 | `pnpm build` 成功，exit code 0 | 执行命令 |
| T8-R2 | 手动 QA 检查清单 6 项全部 pass | 文档化到 Completion Evidence |

#### Rubric（评分时注意任务整体质量）

| ID | 维度(阈值≥1) |
|---|---|
| T8-U1 | 所有规则 TR 通过率(0-2)：≥95% → 2, ≥80% → 1, <80% → 0 |
