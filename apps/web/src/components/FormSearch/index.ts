/**
 * FormSearch 模块公共导出(遵循"index.ts 做门面"惯例)。
 *
 * 公共 API:
 *   - FormSearch  : 搜索容器组件
 *   - SearchItem  : 声明式搜索条件配置
 *   - FormSearchProps / SearchItemProps / SearchItemType : 类型
 *   - FormSearchHandle : imperative handle
 *
 * 内部实现不对外暴露(符合 C1:业务层不需感知 IME 机制):
 *   - IMEContext     (contexts/IMEContext)
 *   - useIME         (hooks/useIME)
 *   - IMEInput       (components/IMEInput)
 *   - IMETextArea    (components/IMETextArea)
 *   - createIMEController (工厂函数)
 * 上述实现项仅在包内部 import,不通过此 index 导出。
 * 如果未来其他业务场景确实需要 IMEInput 等,再显式加入此处。
 */
export { FormSearch } from './FormSearch'
export type { FormSearchProps, FormSearchHandle } from './FormSearch'
export { SearchItem } from './SearchItem'
export type { SearchItemProps, SearchItemType } from './SearchItem'
