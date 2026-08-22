/**
 * IMEContext.tsx
 * ------------------------------------------------------------------
 * FormSearch 内部专用的 per-field IME(输入法合成)状态容器。
 *
 * 【设计哲学 / 与全局 boolean 方案的区别】
 * 一个 FormSearch 通常有多个文本搜索字段(姓名、地址、关键词、备注……)。
 * 如果用一个全局 isComposing boolean,会出现:
 *   姓名字段正在拼音输入,用户顺手切到地址下拉选择一个城市 → 地址的正常
 *   onChange 也被全局 IME 标记阻塞,无法及时搜索。
 * 因此这里采用 Set<React.Key> : 只有"本字段正在 IME"才会阻塞"本字段
 * 自身 onChange 产生的搜索调度"。其他字段变更照常进行(Q1 精确调度)。
 *
 * 【不存 useState 的理由】
 * IME 状态只参与搜索调度的 gating 判断,不需要触发 React 重渲染。
 * 全部状态写入 useRef,零 re-render(NFR-3 性能要求)。
 *
 * 【不作为公共导出】
 * IMEContext 仅在 FormSearch 包内部使用(IMEInput / IMETextArea 通过
 * useContext 获取)。业务开发者不会接触到它——因此 SearchItem 公共 API
 * 不需要暴露 startComposition/endComposition 等(C1:SearchItem 公共 API 不
 * 新增 IME 参数)。
 *
 * 【queueMicrotask 说明】
 * compositionend 后,浏览器/React 的事件顺序是:
 *   compositionend → (可能有) input → change → rc-field-form 写 form store
 * 不同浏览器顺序不完全一致(chrome/firefox/safari 都有各自微略差别)。
 * 我们想在"form store 的最终值已确定"之后再 scheduleSearch,所以把
 * notifyCompositionEnd 的 scheduleSearch(fn) 调用放在 queueMicrotask
 * 里而不是同步调用。如果浏览器没有 queueMicrotask,退化为 setTimeout(fn, 0)
 * 以保证兼容性(NFR-2 鲁棒性)。
 *
 * 【依赖倒置】
 * createIMEController 接收一个外部注入的 scheduleSearch,而不是从
 * Context 里自己调,原因是:
 *   1. IMEContext 属于底层,不知道上层 FormSearch 的 debounce/force flush
 *      策略,避免环形依赖。
 *   2. 方便单测:传一个 jest.fn() 即可 verify notifyCompositionEnd 调用路径。
 *   3. 将来 scheduleSearch 演进(比如加 tracing)时 IMEContext 不用改(开闭)。
 */
import * as React from 'react'

export interface IMEContextValue {
  /** 进入 IME 合成态。多次调用对同 name 幂等(Set.add)。 */
  startComposition(name: React.Key): void
  /** 退出 IME 合成态。多次调用对同 name 幂等(Set.delete)。 */
  endComposition(name: React.Key): void
  /** 查询单字段是否处于 IME 合成态。主要用于 Q1 精确调度。 */
  isComposing(name: React.Key): boolean
  /** 任一字段处于合成态。用于 scheduleSearch 的全局兜底路径。 */
  hasComposing(): boolean
  /**
   * 用于合成完成时通知上层:先 endComposition(name),
   * 再 queueMicrotask 中调用外部注入的 scheduleSearch。
   */
  notifyCompositionEnd(name: React.Key): void
}

export const IMEContext = React.createContext<IMEContextValue | null>(null)
IMEContext.displayName = 'FormSearchIMEContext'

/* ------------------------------------------------------------------ */
/*  工厂函数(在 FormSearch 组件内部初始化时调用)                        */
/* ------------------------------------------------------------------ */

export interface CreateIMEControllerOptions {
  /** 外部注入的搜索调度回调。通常是 FormSearch 写好 debounce/force flush 的 scheduleSearch。 */
  scheduleSearch: (opts: {
    force: boolean
    changedFields?: React.Key[]
  }) => void
}

/**
 * 创建 IME 控制器实例(供 FormSearch useMemo 缓存后塞进 Provider)。
 *
 * 注意:使用 useRef(new Set()) 在 create 函数内部持有 composingFieldsRef
 * —— 因为 createIMEController 本身是纯函数,不参与 React 生命周期,
 * 所以它的局部变量是闭包;但调用方(FormSearch)需要把返回的 imeController
 * 包进 useMemo([scheduleSearch 稳定引用]),确保只有一个实例、一个 Set。
 */
export function createIMEController(
  opts: CreateIMEControllerOptions,
): IMEContextValue {
  const { scheduleSearch } = opts

  /* 状态:闭包内声明 Set(等价 useRef,由外部 useMemo 保证单例)。
   * 不叫 composingFieldsRef 因为它是闭包本地变量,不需要 ref 包装。
   */
  const composingFields = new Set<React.Key>()

  /* ---------- microtask 调度工具(兼容老浏览器) ---------- */
  const defer =
    typeof queueMicrotask === 'function'
      ? queueMicrotask.bind(undefined)
      : (fn: () => void) => window.setTimeout(fn, 0)

  /* ---------- 5 个接口 ---------- */

  function startComposition(name: React.Key): void {
    composingFields.add(name) // Set.add:幂等
  }

  function endComposition(name: React.Key): void {
    composingFields.delete(name) // Set.delete:幂等
  }

  function isComposing(name: React.Key): boolean {
    return composingFields.has(name)
  }

  function hasComposing(): boolean {
    return composingFields.size > 0
  }

  function notifyCompositionEnd(name: React.Key): void {
    /*
     * 注意:先 endComposition 再 defer(scheduleSearch)。
     * 因为 scheduleSearch 的 gating 逻辑会查 isComposing(name)。
     * 如果放在 defer 之后才 endComposition,scheduleSearch 执行时
     * isComposing 可能仍为 true,导致这次调度被自己吞掉 →
     * 最终合成结束后一次搜索都不会触发,这是严重 bug。
     */
    endComposition(name)
    defer(() => {
      scheduleSearch({ force: false, changedFields: [name] })
    })
  }

  return {
    startComposition,
    endComposition,
    isComposing,
    hasComposing,
    notifyCompositionEnd,
  }
}
