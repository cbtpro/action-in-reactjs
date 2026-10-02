import type { MouseEvent as ReactMouseEvent } from 'react'
import { CheckCircleFilled, WarningFilled } from '@ant-design/icons'
import type { CompanyMatch } from './types'

export interface SourceListItemProps {
  name: string
  index: number
  sourceId: string
  result: CompanyMatch | undefined
  isActive: boolean
  itemRef: (element: HTMLDivElement | null) => void
  onMouseEnter: (event: ReactMouseEvent<HTMLDivElement>) => void
  onMouseLeave: () => void
}

/**
 * 左侧“原始企业名单”虚拟列表的单行渲染，纯展示组件：
 * 不持有匹配/连线状态，只负责根据传入的匹配结果渲染序号、置信度和状态图标。
 */
export function SourceListItem({
  name,
  index,
  sourceId,
  result,
  isActive,
  itemRef,
  onMouseEnter,
  onMouseLeave,
}: SourceListItemProps) {
  return (
    <div
      ref={itemRef}
      data-source-id={sourceId}
      className={`company-source-item${isActive ? ' is-active' : ''}${result?.kind === 'unmatched' ? ' is-unmatched' : ''}`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <span className="company-source-item__number">{String(index + 1).padStart(2, '0')}</span>
      <span className="company-source-item__name">{name}</span>
      {result && (
        <span className={`company-source-item__confidence${result.company ? '' : ' is-unmatched'}`}>
          {Math.round(result.confidence * 100)}%
        </span>
      )}
      {result?.company && <CheckCircleFilled className="company-source-item__check" />}
      {result?.kind === 'unmatched' && <WarningFilled className="company-source-item__warning" />}
    </div>
  )
}
