/**
 * FormSearch 模块公共导出(门面 index)。
 *
 * 2026-08-22 重构:
 *   之前版本内部自己实现了一套 IMEContext / useIME / IMEInput / IMETextArea。
 *   现在使用用户重构的公共 IME* 组件(@/components/IMEInput 等):
 *   - withComposition 在控件层自己做 onChange gating。
 *   - 本目录**不再有 contexts / hooks / components 子目录**。
 *   - IME 能力对业务层透明, 公共 API 直接就是 FormSearch + SearchItem。
 *
 * 公共 API:
 *   - FormSearch            容器 + Scheduler + debounce + 操作按钮栏
 *   - SearchItem            声明式搜索条件(type → 控件分发:input/number/textarea/select/date/range)
 *   - 类型 Props/Handle/Type 方便业务 TS 声明。
 */
export { FormSearch } from './FormSearch'
export type { FormSearchProps, FormSearchHandle } from './FormSearch'

export { SearchItem } from './SearchItem'
export type { SearchItemProps, SearchItemType } from './SearchItem'
