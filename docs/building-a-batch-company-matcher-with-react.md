# 用 React 实现批量公司匹配：高亮、连线与虚拟列表联动

## 背景

在 CRM、招投标、供应链和企业数据清洗场景中，经常会收到一批“看起来像公司名称”的文本：

```text
深圳市腾讯计算机系统有限公司
阿里巴巴（中国）有限公司
阿里巴巴
华为科技
字节跳动公司
北京未来星科技有限公司
```

这些数据混合了工商全称、简称、别名和无法识别的名称。只比较字符串是否相等，简称和格式略有差异的名称无法命中；一次性渲染上万条结果，又会让浏览器承担大量没有必要的 DOM 创建、样式计算和布局工作。

本文实现的批量公司匹配 Demo 包含以下能力：

- 批量解析公司名称；
- 左侧展示原始词条，右侧展示去重后的标准企业；
- hover 时高亮左右关联项，并使用 SVG 连线；
- 未匹配企业标红，支持人工选择候选企业；
- 使用虚拟列表处理 1,000 条和 10,000 条测试数据；
- 多个关键词命中同一企业时只渲染一个标准结果；
- 输出去重后的企业名称、地区、信用代码和匹配方式。

## 案例

在设计交互和数据流程前，可以参考这些企业批量查询产品：

- [启信宝批量查询](https://www.qixin.com/batch/search)
- [企查查批量查询](https://www.qcc.com/web/project/batchSearch)
- [企知道企业批量查询](https://qiye.qizhidao.com/batch-query-home)
- [天眼查批量查询](https://www.tianyancha.com/batch)
- [企查猫企业批量查询](https://www.qichamao.com/orgcompany/companybatch)
- ~~[水滴科标](https://kebiao.shuidi.cn/#/)~~
- ~~[爱企查批量查询](https://aiqicha.baidu.com/batchquery)~~
- ~~[企业预警通](https://www.qyyjt.cn/)~~
- ~~[信用视界](https://www.x315.com/)~~
- ~~钉钉企典~~

## 先确定前端关联数据

页面看起来是两个列表，真正贯穿匹配、去重、高亮、滚动和导出的却是两类稳定标识：

- `sourceId`：标识一条原始输入，例如 `source-12`；
- `company.id`：标识企业目录中的标准企业。

逐条匹配结果保存原始词条与标准企业：

```ts
export interface CompanyMatch {
  sourceId: string
  sourceName: string
  company: Company | null
  kind: MatchKind
  strategyLabel: string
  confidence: number
}
```

右侧按 `company.id` 去重以后，一个标准企业可能对应多条输入，因此聚合结果必须继续保存全部来源：

```ts
export interface DeduplicatedCompanyMatch extends CompanyMatch {
  sourceIds: string[]
  sourceNames: string[]
  sourceCount: number
}
```

例如“阿里巴巴（中国）有限公司”和“阿里巴巴”都命中同一家企业时，右侧只渲染一个结果，但它的 `sourceIds` 同时包含两条左侧记录。这个数组是后续所有关联交互的依据，不能在去重时丢弃。

前端不需要了解名称是如何命中的，只需要消费稳定的匹配结果。无论数据来自本地规则、Web Worker 还是服务端接口，只要保留 `sourceId`、标准企业和置信度，后面的高亮、连线与虚拟滚动逻辑都不需要改变。

### 用一个例子贯穿全文

假设左侧有三条输入：

| 左侧下标 | `sourceId` | 输入文本 | 匹配结果 |
| ---: | --- | --- | --- |
| 0 | `source-0` | 阿里巴巴（中国）有限公司 | `company-alibaba` |
| 1 | `source-1` | 阿里巴巴 | `company-alibaba` |
| 2 | `source-2` | 不存在企业 | 未匹配 |

右侧去重后只显示两行：

| 右侧下标 | 结果键 | `sourceIds` |
| ---: | --- | --- |
| 0 | `source-2` | `['source-2']` |
| 1 | `company-alibaba` | `['source-0', 'source-1']` |

后面的交互都在解决同一个问题：已知一侧的稳定 ID，如何找到另一侧的业务记录；目标进入虚拟窗口后，又如何找到它当前对应的 DOM。

这里要区分三层关系：

1. **业务关系**：`sourceId` 对应哪个聚合结果；
2. **虚拟窗口**：目标记录当前是否已经渲染；
3. **几何关系**：两个已渲染元素在页面中的位置。

先解决业务关系，再让目标进入虚拟窗口，最后才能读取 DOM 位置。直接从一个 DOM 猜另一个 DOM，会在排序、去重和虚拟滚动后失效。

## 一、hover 关联高亮如何实现

### 原理：高亮的是业务关系，不是两个 DOM

左侧的“阿里巴巴”与右侧的标准企业不是因为文字相似而高亮，也不是因为它们碰巧都在第 2 行，而是因为右侧结果的 `sourceIds` 包含 `source-1`。

因此页面只保存一份状态：当前激活了哪些来源 ID。

- hover 左侧 `source-1`：激活 `['source-1']`；
- hover 右侧 `company-alibaba`：激活 `['source-0', 'source-1']`；
- 左侧行判断自己的 ID 是否被激活；
- 右侧行判断自己的 `sourceIds` 是否与激活集合有交集。

```tsx
const [activeSourceIds, setActiveSourceIds] = useState<string[]>([])

const sourceActive = activeSourceIds.includes(sourceId)
const resultActive = result.sourceIds.some((sourceId) =>
  activeSourceIds.includes(sourceId),
)
```

### 从左侧 hover 如何找到右侧元素

这个过程不能一步完成，需要依次经过数据、虚拟列表和 DOM：

1. 左侧事件给出 `sourceId`；
2. 用 `sourceId → resultIndex` 映射找到右侧数据下标；
3. 请求右侧虚拟列表滚动到该下标，确保目标行挂载；
4. 从右侧结果取得稳定键；
5. 用稳定键从 `resultItemRefs` 找到当前 DOM。

先建立来源到结果下标的索引：

```ts
const resultIndexBySourceId = new Map<string, number>()

displayedResults.forEach((result, resultIndex) => {
  result.sourceIds.forEach((sourceId) => {
    resultIndexBySourceId.set(sourceId, resultIndex)
  })
})
```

hover 左侧时，通过索引定位并滚动右侧：

```tsx
const handleSourceMouseEnter = (sourceId: string) => {
  setHoveredSources([sourceId])

  const resultIndex = resultIndexBySourceId.get(sourceId)
  if (resultIndex !== undefined) {
    resultListRef.current?.scrollToIndex(resultIndex)
  }
}
```

右侧行挂载时，以企业 ID 登记 DOM：

```tsx
const getResultKey = (result: DeduplicatedCompanyMatch) =>
  result.company?.id ?? result.sourceId

<div
  ref={(element) => {
    const key = getResultKey(result)
    if (element) resultItemRefs.current.set(key, element)
    else resultItemRefs.current.delete(key)
  }}
/>
```

需要画线时，沿相同路径再次取得右侧记录和 DOM：

```ts
const resultIndex = resultIndexBySourceId.get(sourceId)
const result = resultIndex === undefined
  ? undefined
  : displayedResults[resultIndex]
const resultElement = result
  ? resultItemRefs.current.get(getResultKey(result))
  : undefined
```

如果 `resultElement` 不存在，说明目标尚未进入虚拟窗口，此时不画线。等虚拟列表完成渲染后再测量，不能使用旧 DOM 的坐标。

### 从右侧 hover 如何找到左侧元素

右侧记录已经直接携带 `sourceIds`，因此不需要反查 Map。以示例中的阿里巴巴为例，右侧 hover 会得到 `['source-0', 'source-1']`，左侧两行都应高亮。

```tsx
const handleResultMouseEnter = (result: DeduplicatedCompanyMatch) => {
  setHoveredSources(result.sourceIds)
}
```

但虚拟列表可能无法同时显示相距很远的两条来源。用于反向滚动时，应从多个 `sourceIds` 中选择距离当前左侧视口最近的一条；用于高亮和绘线时，则处理当前已经挂载的所有来源 DOM：

```ts
const visibleSourceElements = result.sourceIds.flatMap((sourceId) => {
  const element = sourceItemRefs.current.get(sourceId)
  return element ? [{ sourceId, element }] : []
})
```

### 为什么 state 之外还需要 ref

高亮 class 由 React state 驱动，但 300ms 延迟回调和滚动回调需要读取“执行当下”的最新值。为避免闭包拿到旧 state，同一组 ID 还保存在 ref 中：

```tsx
const [activeSourceIds, setActiveSourceIds] = useState<string[]>([])
const activeSourceIdsRef = useRef<string[]>([])

const setHoveredSources = (sourceIds: string[]) => {
  activeSourceIdsRef.current = sourceIds
  setActiveSourceIds(sourceIds)
}
```

### 滚动后鼠标不动也要重新识别

虚拟滚动会替换鼠标下方的元素，但浏览器不保证重新触发 `mouseenter`。解决方法不是恢复滚动前的 ID，而是记录鼠标坐标，在滚动停止后重新询问浏览器“这个坐标下面现在是谁”：

```tsx
const pointerPositionRef = useRef<{ x: number; y: number } | null>(null)

const restoreHoverAtPointer = () => {
  const position = pointerPositionRef.current
  if (!position) return

  const pointedElement = document.elementFromPoint(position.x, position.y)
  const sourceElement = pointedElement?.closest<HTMLElement>('[data-source-id]')
  const sourceId = sourceElement?.dataset.sourceId

  if (sourceId) handleSourceMouseEnter(sourceId)
}
```

滚动期间立即隐藏；停止 80ms 后重新命中当前元素；命中后再等待 300ms 显示连线。鼠标离开整个工作区时清空坐标并取消任务。

最后，高亮样式只修改边框、背景和阴影，不改变位移和宽度，因此不会造成列表抖动。

## 二、SVG 线条如何实现

### 原理：连线是两个 DOM 中心点之间的几何关系

高亮只需要业务 ID，SVG 连线还需要元素的真实位置。一次绘制分为五步：

1. 根据 `sourceId` 找到左侧已挂载 DOM；
2. 根据 `sourceId → resultIndex` 找到右侧记录，再根据结果键找到右侧 DOM；
3. 分别读取两个 DOM 的边界；
4. 把视口坐标换算成工作区内部坐标，生成 SVG 路径；
5. 把路径写入 React state，由独立 SVG 图层渲染。

如果右侧结果关联了多个来源，算法会为当前已挂载的每个来源生成一条路径。未挂载的来源跳过，因为浏览器无法测量一个不存在的 DOM。

### 为什么使用独立绘图层

SVG 不属于左侧列表，也不属于右侧列表，而是覆盖整个工作区：

```tsx
<div ref={workspaceRef} className="company-match-workspace">
  <svg className="company-match-connectors" aria-hidden="true">
    {connectorLayer.paths.map((path) => (
      <g key={path.id}>
        <path className="company-match-connector__outline" d={path.d} />
        <path className="company-match-connector__ants" d={path.d} />
      </g>
    ))}
  </svg>
  {/* 左侧列表、中间按钮、右侧列表 */}
</div>
```

这样做有两个原因：一是左右端点可以使用同一个工作区坐标系，二是连线不会参与任何一侧列表的布局。SVG 使用 `pointer-events: none`，不会遮挡 hover、滚动和编辑按钮。

### 使用 Map 保存当前挂载的端点

虚拟列表只挂载视口附近的行，不能假设所有来源和结果都有 DOM。渲染行时把当前节点登记到 Map，卸载时删除：

```tsx
const sourceItemRefs = useRef(new Map<string, HTMLDivElement>())
const resultItemRefs = useRef(new Map<string, HTMLDivElement>())

ref={(element) => {
  if (element) sourceItemRefs.current.set(sourceId, element)
  else sourceItemRefs.current.delete(sourceId)
}}
```

来源节点以 `sourceId` 为键；匹配成功的结果以 `company.id` 为键，未匹配结果继续使用自己的 `sourceId`。这与 React 列表的稳定 `key` 规则一致。

### 示例：把两个元素换算到同一坐标系

`getBoundingClientRect()` 返回视口坐标。绘制前分别读取工作区、来源行和结果行的位置，再减去工作区的左上角：

```ts
const workspaceRect = workspace.getBoundingClientRect()
const sourceRect = sourceElement.getBoundingClientRect()
const resultRect = resultElement.getBoundingClientRect()

const startX = sourceRect.right - workspaceRect.left
const startY = sourceRect.top + sourceRect.height / 2 - workspaceRect.top
const endX = resultRect.left - workspaceRect.left
const endY = resultRect.top + resultRect.height / 2 - workspaceRect.top
```

假设工作区左边缘在视口的 `x = 100`，左侧元素右边缘在 `x = 420`，那么 SVG 内部的起点就是 `420 - 100 = 320`。纵坐标同样先取元素中心点，再减去工作区顶部。

路径使用三次贝塞尔曲线。两个控制点分别位于起点右侧和终点左侧，使连线在不同纵向位置之间平滑过渡：

```ts
const controlOffset = Math.max(30, (endX - startX) * 0.42)

const d = `M ${startX} ${startY}
  C ${startX + controlOffset} ${startY},
    ${endX - controlOffset} ${endY},
    ${endX} ${endY}`
```

### 两层路径组成淡灰色蚂蚁线

同一条曲线绘制两次：底层使用较粗的页面背景色隔开复杂背景，上层使用虚线和动画：

```css
.company-match-connector__outline {
  stroke: var(--bg);
  stroke-width: 6px;
}

.company-match-connector__ants {
  stroke: var(--match-connector-color);
  stroke-dasharray: 7 7;
  stroke-width: 2px;
  animation: company-match-marching-ants 700ms linear infinite;
}
```

颜色来自 `--match-connector-color`，以后可以在主题或具体业务页面中覆盖，不需要修改绘图逻辑。系统启用“减少动态效果”时，媒体查询会关闭动画。

### 测量调度与失效处理

不能只在 `mouseenter` 时测量一次。滚动、虚拟窗口更新、面板折叠和容器尺寸变化都会改变坐标，即使激活的业务 ID 没变，旧路径也已经失效。

实现使用 `requestAnimationFrame` 合并同一帧内的测量请求，并在 120ms 后补一次稳定测量，处理布局过渡：

```ts
const scheduleConnectorRefresh = () => {
  scheduleConnectorUpdate()
  connectorSettleTimerRef.current = window.setTimeout(
    scheduleConnectorUpdate,
    120,
  )
}
```

隐藏连线时必须同时取消等待显示的定时器、稳定测量定时器和 animation frame。否则旧回调可能在滚动后重新写入已经失效的路径。

如果来源节点或结果节点不在当前虚拟窗口中，路径应立即清空，不能保留上一帧的位置。等另一侧完成联动滚动并挂载目标行后，`onRenderedRangeChange` 会重新发起测量。

## 三、虚拟滚动时如何关联两侧匹配项

### 原理：同步业务记录，不同步滚动像素

继续使用前面的例子：左侧第 0、1 行都属于阿里巴巴，右侧却只有第 0 行。左侧滚动 84px 从 `source-0` 到 `source-1` 时，右侧目标仍然是同一行。如果把左侧 `scrollTop` 原样复制给右侧，右侧反而会滚到下一家公司。

因此双侧联动的单位不是像素，而是业务关系：

```text
左侧可见下标
  → sourceId
  → 右侧结果下标
  → 右侧 scrollToIndex
```

反方向则是：

```text
右侧可见下标
  → 聚合结果的 sourceIds
  → 距离左侧当前视口最近的 sourceId
  → 左侧 scrollToIndex
```

只有最后一步才把目标下标换算成 `index × itemHeight`。

### 虚拟列表本身只负责窗口计算

`VirtualList<T>` 不认识公司数据，只接收固定行高、数据、键和渲染函数：

```tsx
<VirtualList
  items={displayedResults}
  height={460}
  itemHeight={84}
  getKey={getResultKey}
  renderItem={(result) => (
    <div className="company-result-item">
      {result.company?.name ?? '未找到匹配企业'}
    </div>
  )}
/>
```

列表内部根据 `scrollTop` 计算窗口：

```ts
const visibleCount = Math.ceil(viewportHeight / itemHeight)
const maxStart = Math.max(0, items.length - visibleCount)
const start = Math.min(
  maxStart,
  Math.max(0, Math.floor(scrollTop / itemHeight) - overscan),
)
const end = Math.min(
  items.length,
  start + visibleCount + overscan * 2,
)
```

完整高度由 spacer 保留，当前窗口通过 `translateY(start * itemHeight)` 移动到正确位置。1,000 条和 10,000 条数据都只会挂载视口附近的十几行。

### 左侧滚动如何定位右侧

右侧已经按企业去重，因此左右两列长度和顺序都可能不同，不能直接复制 `scrollTop`。页面预先建立 `sourceId → resultIndex` 映射：

```ts
const resultIndexBySourceId = new Map<string, number>()

displayedResults.forEach((result, resultIndex) => {
  result.sourceIds.forEach((sourceId) => {
    resultIndexBySourceId.set(sourceId, resultIndex)
  })
})
```

左侧滚动时，根据 `scrollTop` 和固定行高得到首个可见行的全局下标，再还原 `sourceId`，最后查询右侧结果下标：

```ts
const sourceIndex = Math.floor(offset / VIRTUAL_ROW_HEIGHT)
const resultIndex = resultIndexBySourceId.get(`source-${sourceIndex}`)

if (resultIndex !== undefined) {
  resultListRef.current?.scrollToIndex(resultIndex)
}
```

### 右侧反向定位选择最近的来源

一个结果可能包含多个 `sourceIds`。固定使用 `sourceIds[0]` 会让左侧从当前区域突然跳回很早的位置。当前实现以左侧当前首个可见下标为基准，从所有来源中选择距离最近的一条：

```ts
const nearestSourceId = result.sourceIds.reduce((nearestId, sourceId) => {
  const sourceIndex = getSourceIndex(sourceId)
  const nearestIndex = getSourceIndex(nearestId)

  return Math.abs(sourceIndex - currentSourceIndex)
    < Math.abs(nearestIndex - currentSourceIndex)
    ? sourceId
    : nearestId
})
```

因此，页面后半段的“腾讯”与页面开头的“腾讯”命中同一家企业时，从右侧反向定位会回到当前视口附近的来源，而不是永远回到第一条。

### 为什么需要同步锁

调用 `scrollToIndex` 会触发目标列表的 `scroll` 事件。如果目标列表继续反向同步，两个列表会互相修改位置，出现抖动甚至回到开头。

容器使用两个 ref 标记本次程序化滚动的目标和预期偏移：

```ts
syncingScrollTargetRef.current = 'result'
syncingScrollOffsetRef.current = resultListRef.current?.scrollToIndex(index)
```

目标列表收到与预期一致的滚动事件时，只释放锁和刷新连线，不再回传。若不加这个判断，左侧推动右侧，右侧又立刻推动左侧，两个列表会来回修正位置。

若实际偏移与预期不同，说明用户在程序化滚动期间主动操作了列表，此时立即释放锁，并把事件按用户滚动处理。

### 滚动、hover 和连线的完整时序

一次用户滚动会经过以下步骤：

1. 立即隐藏连线，取消旧的延迟显示和测量任务；
2. 计算当前首个可见项，通过关联 ID 驱动另一侧滚动；
3. 同步锁吞掉另一侧由程序触发的滚动事件；
4. 滚动停止后，重新查询鼠标坐标下的当前 DOM；
5. 如果命中词条，恢复 `activeSourceIds`；
6. 等待 300ms 后测量当前两端并重新绘制连线。

虚拟列表从有数据变为空，再恢复数据时，滚动容器不会卸载。`useLayoutEffect` 会把 DOM 的 `scrollTop` 和 React 内部状态一起限制到新的最大偏移，避免恢复后仍按旧位置渲染空窗口。

## 四、组件如何解耦，以及如何通信

### 原理：列表负责“怎么滚”，容器负责“滚到哪里”

如果把业务匹配关系写进 `VirtualList`，它就只能用于公司匹配；如果让左右列表互相持有对方 ref，两侧会形成循环依赖；如果让 SVG 自己查询所有 DOM，它又会开始理解业务数据。

当前设计给每层划定了边界：

- 数据模块回答“哪些来源属于同一结果”；
- `VirtualList` 回答“给定数据和偏移，应渲染哪些行”；
- 页面容器回答“用户操作一侧时，另一侧应该定位到哪条数据”；
- SVG 层回答“两个已经挂载的元素应该怎样连接”。

### 按职责分层

| 模块 | 职责 | 不应该知道的内容 |
| --- | --- | --- |
| `companyData.ts` | 企业目录、Logo、简称和模型样本 | 页面滚动与 hover |
| `deduplicateMatches.ts` | 按企业 ID 聚合结果并保留来源 | 列表如何展示 |
| `performanceData.ts` | 生成稳定的大数据测试输入 | 匹配页面状态 |
| `VirtualList.tsx` | 计算虚拟窗口并提供滚动能力 | 具体业务字段 |
| `CompanyMatchDemo.tsx` | 组合业务数据、列表状态和交互协调 | 数据的生成方式 |

去重器和测试数据生成器是独立的数据处理模块，可以单独测试。`VirtualList` 是通用基础组件，可以复用到联系人、专利等固定行高列表。页面容器只负责把这些能力组合起来。

### 用一次左侧 hover 看清通信过程

一次完整通信按照下面的顺序发生：

```text
左侧行触发 mouseenter(sourceId)
  ↓ callback
页面容器查询 resultIndexBySourceId
  ↓ imperative ref
右侧 VirtualList.scrollToIndex(resultIndex)
  ↓ React 渲染
右侧虚拟窗口挂载目标行
  ↓ onRenderedRangeChange callback
页面容器从 DOM Map 读取两端并刷新 SVG
```

这个流程里，左侧行不知道右侧列表的存在；`VirtualList` 不知道滚动目标是一家公司；SVG 也不负责决定哪两条数据相关。所有跨模块决策都集中在页面容器中。

### 组件之间使用四种明确的通信方式

#### 1. Props 传递数据和渲染函数

容器把 `items`、`itemHeight`、`getKey` 和 `renderItem` 交给虚拟列表。虚拟列表不读取外部业务状态，也不导入企业类型。

#### 2. Callback 把事件交还容器

虚拟列表通过两个回调报告变化：

```ts
onScrollOffset?: (offset: number) => void
onRenderedRangeChange?: (count: number) => void
```

`onScrollOffset` 用于两侧关联滚动；`onRenderedRangeChange` 表示虚拟窗口已经换行，容器可以重新测量 SVG 端点。列表组件不直接操作另一侧列表。

#### 3. 受限的 imperative ref 提供定位能力

容器只通过 `VirtualListHandle` 请求滚动：

```ts
export interface VirtualListHandle {
  scrollToIndex: (index: number) => number | null
  scrollToOffset: (offset: number) => number | null
}
```

返回实际偏移是为了建立同步锁。滚动范围限制、DOM `scrollTop` 和内部 state 同步仍由 `VirtualList` 自己负责。

#### 4. 稳定 ID 连接业务状态和当前 DOM

React 状态只保存 `sourceId`，不保存 DOM。SVG 绘制层再通过 `sourceItemRefs` 和 `resultItemRefs` 查找当前已挂载节点。这样业务关系不会依赖虚拟列表当前复用了哪个 DOM 位置。

整个页面不需要全局事件总线。数据向下通过 props，交互向上通过 callback，必要的滚动命令通过受限 ref 发出，跨列表关系通过稳定 ID 解析。每一层都只知道完成自身职责所需的最少信息。

## 人工纠错与最终输出

自动匹配失败后，原始词条仍然保留。右侧未匹配项显示警告状态和编辑按钮，候选面板支持按企业名称、简称和地区搜索。人工选择只更新对应的 `CompanyMatch`：

```ts
setMatches((current) =>
  current.map((item) =>
    item.sourceId === sourceId
      ? {
          ...item,
          company,
          kind: 'manual',
          strategyLabel: '人工确认',
          confidence: 1,
        }
      : item,
  ),
)
```

最终输出使用去重后的匹配结果，未匹配项不进入名单，但会显示跳过数量。结果抽屉使用 Ant Design Table 的虚拟滚动，避免主页面完成优化后又在输出阶段一次性创建大量行。

## 示例数据

下面的数据包含互联网公司、银行、航空、能源和大型央企，可用于验证全称匹配、简称匹配、结果去重、Logo 和大数据生成逻辑：

```text
北京银行股份有限公司
北京市北京饭店有限责任公司
神州融安科技（北京）有限公司
北京稻香村食品有限责任公司
北京丽源有限公司
中邦万基（北京）保安服务有限公司
陆海空三栖（北京）科技有限公司
北京造纸一厂有限公司
北京汽车集团有限公司
北京六必居食品有限公司
阿里巴巴集团
腾讯控股有限公司
深圳市生而不庸软件技术有限责任公司
华为技术有限公司
百度在线网络技术有限公司
京东集团
小米科技有限责任公司
中国平安保险（集团）股份有限公司
中国移动通信集团有限公司
中国石油天然气集团有限公司
中国工商银行股份有限公司
中国建设银行股份有限公司
中国农业银行股份有限公司
中国银行股份有限公司
联想集团有限公司
网易公司
字节跳动有限公司
美团点评
滴滴出行
拼多多
中兴通讯股份有限公司
海尔集团
格力电器股份有限公司
比亚迪股份有限公司
顺丰速运有限公司
中国南方航空集团有限公司
中国国际航空股份有限公司
中国东方航空集团有限公司
中国铁路总公司
中国建筑集团有限公司
中国交通建设股份有限公司
中国邮政集团公司
中国电信集团有限公司
中国联合网络通信集团有限公司
中国海洋石油集团有限公司
中国中化集团有限公司
中国化工集团有限公司
中国兵器工业集团有限公司
中国航天科技集团有限公司
中国航天科工集团有限公司
中国航空工业集团有限公司
中国船舶工业集团有限公司
中国船舶重工集团有限公司
中国电子科技集团有限公司
中国电子信息产业集团有限公司
中国华能集团有限公司
中国大唐集团有限公司
中国华电集团有限公司
国家电力投资集团有限公司
中国长江三峡集团有限公司
国家能源投资集团有限责任公司
```

“载入 1,000 条”和“载入 10,000 条”不会另外加载一份模型样本，而是直接从企业目录的全称和简称中生成可匹配数据，并按固定比例插入未匹配名称。企业目录扩展后，性能样本也会随之更新。

```ts
export function createPerformanceCompanyNames(count: number): string[] {
  return Array.from({ length: count }, (_, index) => {
    if (index % 5 === 4) {
      return `性能测试企业${String(index + 1).padStart(5, '0')}有限公司`
    }

    const matchableIndex = index - Math.floor(index / 5)
    return COMPANY_MATCH_TEST_NAMES[
      matchableIndex % COMPANY_MATCH_TEST_NAMES.length
    ]
  })
}
```

固定数据分布让每次测试都能同时覆盖匹配、未匹配、重复结果、红色状态和人工编辑入口。页面另外显示纯匹配耗时和单列实际 DOM 行数，方便观察算法成本与渲染成本。

## 回归测试

当前组件测试覆盖了三个容易反复出现的问题：

- 滚动时连线立即隐藏，鼠标不动时按滚动后的当前词条恢复；
- 多个来源匹配同一结果时，从右侧反向定位到当前视口最近的来源；
- 结果过滤至空再恢复时，滚动位置归零并从首条重新渲染。

运行测试：

```bash
pnpm test
```

## 总结

批量公司匹配的难点不只是匹配算法，而是去重以后仍要保持来源可追溯，并让两侧虚拟列表、高亮状态和 SVG 连线始终指向同一组业务对象。

这套实现采用四个关键约束：

1. 用 `sourceId` 和 `company.id` 表达关联，不用文本和 DOM 位置推断关系；
2. hover 状态只保存来源 ID，SVG 只读取当前已挂载节点；
3. 双侧滚动按数据映射换算下标，并使用同步锁阻止循环；
4. 数据处理、虚拟列表和页面协调器分别承担单一职责。

在这些边界不变的情况下，可以继续增加新的匹配策略、动态数据源或更复杂的结果组件，而不需要推翻高亮、连线和虚拟滚动机制。

## 最后再看匹配算法

匹配算法不是本文的重点，它在前端交互中只负责生产 `CompanyMatch[]`。当前 Demo 依次尝试企业全称、常用简称和名称归一化，全部失败时返回未匹配结果。

匹配规则通过统一策略接口组织，并按照优先级执行。新增拼音、统一社会信用代码或远程模糊检索时，可以增加新的策略，而不必修改列表、高亮、SVG 连线和虚拟滚动代码。

如果企业目录继续扩大，匹配计算可以迁移到 Web Worker 或服务端。只要输出数据契约保持不变，本文介绍的前端关联机制仍然可以继续使用。
