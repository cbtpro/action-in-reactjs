import type { MouseEvent as ReactMouseEvent } from 'react'
import { Button, Popover, Tooltip } from 'antd'
import { EditOutlined, WarningFilled } from '@ant-design/icons'
import { CandidatePicker } from './CandidatePicker'
import { CompanyLogo } from './CompanyLogo'
import type { Company } from './types'
import type { DeduplicatedCompanyMatch } from './deduplicateMatches'

export interface ResultListItemProps {
  result: DeduplicatedCompanyMatch
  isActive: boolean
  isEditing: boolean
  itemRef: (element: HTMLDivElement | null) => void
  onMouseEnter: (event: ReactMouseEvent<HTMLDivElement>) => void
  onMouseLeave: () => void
  onEditOpenChange: (open: boolean) => void
  onManualMatch: (company: Company) => void
}

/**
 * 右侧“标准企业结果”虚拟列表的单行渲染。
 *
 * 未匹配词条额外渲染一个人工纠错入口（Popover + CandidatePicker），
 * 匹配成功的词条渲染企业头像与匹配方式/置信度信息。
 *
 * @param props - 去重结果、交互状态、DOM 登记和人工匹配回调。
 * @returns 标准企业结果虚拟列表中的单行结果。
 */
export function ResultListItem({
  result,
  isActive,
  isEditing,
  itemRef,
  onMouseEnter,
  onMouseLeave,
  onEditOpenChange,
  onManualMatch,
}: ResultListItemProps) {
  const unmatched = !result.company
  const shortName = result.company?.shortName ?? ''

  return (
    <div
      ref={itemRef}
      data-result-key={result.company?.id ?? result.sourceId}
      className={`company-result-item${isActive ? ' is-active' : ''}${unmatched ? ' is-unmatched' : ''}`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="company-result-item__status">
        {unmatched ? <WarningFilled /> : <CompanyLogo company={result.company} shortName={shortName} />}
      </div>
      <div className="company-result-item__content">
        <span className="company-result-item__source">
          {result.sourceCount > 1 ? `${result.sourceCount} 个词条：` : ''}
          {result.sourceNames.join('、')}
        </span>
        {result.company ? (
          <div className="company-result-item__company">
            <strong>{result.company.name}</strong>
            <span>{result.company.region} · {result.strategyLabel} · {Math.round(result.confidence * 100)}%</span>
          </div>
        ) : (
          <div className="company-result-item__company company-result-item__company--missing">
            <strong>未找到匹配企业</strong>
            <span>请人工选择正确的工商主体</span>
          </div>
        )}
      </div>
      {unmatched && (
        <Popover
          trigger="click"
          placement="bottomRight"
          open={isEditing}
          onOpenChange={onEditOpenChange}
          content={<CandidatePicker sourceName={result.sourceName} onSelect={onManualMatch} />}
        >
          <Tooltip title="选择匹配企业">
            <Button
              className="company-result-item__edit"
              type="text"
              icon={<EditOutlined />}
              aria-label={`编辑 ${result.sourceName} 的匹配企业`}
            />
          </Tooltip>
        </Popover>
      )}
    </div>
  )
}
