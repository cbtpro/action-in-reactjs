import { Checkbox, Empty, Tag } from 'antd'
import { FileSearchOutlined } from '@ant-design/icons'
import { ResultListItem } from './ResultListItem'
import { VirtualList } from './VirtualList'
import {
  VIRTUAL_LIST_HEIGHT,
  VIRTUAL_ROW_HEIGHT,
} from './companyMatchConstants'
import { getResultKey } from './companyMatchViewModel'
import type { CompanyMatchModel } from './useCompanyMatchModel'
import type { CompanyMatchWorkspaceState } from './useCompanyMatchWorkspace'

export interface CompanyResultPanelProps {
  model: CompanyMatchModel
  workspace: CompanyMatchWorkspaceState
}

/**
 * 渲染标准企业结果、排序过滤工具条和人工纠错入口。
 *
 * @param props - 页面数据模型和工作区交互状态。
 * @returns 匹配结果虚拟列表或等待匹配的空状态。
 */
export function CompanyResultPanel({ model, workspace }: CompanyResultPanelProps) {
  const { interactions } = workspace

  return (
    <section className="company-match-panel company-match-panel--result">
      <div className="company-match-panel__header">
        <div>
          <span className="company-match-panel__index">02</span>
          <div><h3>标准企业结果</h3><p>悬停任一词条可查看对应关系</p></div>
        </div>
        {model.hasResult && (
          <Tag color={model.unmatchedCount ? 'warning' : 'success'}>
            {model.displayedResults.length} 个结果 · {model.unmatchedCount} 个待确认
          </Tag>
        )}
      </div>

      {model.hasResult && (
        <div className="company-result-toolbar" aria-label="匹配结果排序和过滤">
          <Checkbox
            checked={model.keepImportOrder}
            onChange={(event) => model.setKeepImportOrder(event.target.checked)}
          >
            按导入顺序
          </Checkbox>
          <Checkbox
            checked={model.hideUnmatchedResults}
            onChange={(event) => model.setHideUnmatchedResults(event.target.checked)}
          >
            过滤匹配失败项
          </Checkbox>
        </div>
      )}

      {!model.hasResult ? (
        <div className="company-match-empty">
          <FileSearchOutlined />
          <strong>等待匹配</strong>
          <span>点击中间按钮，结果会在这里逐条对齐</span>
        </div>
      ) : (
        <VirtualList
          ref={interactions.resultListRef}
          className="company-result-list"
          ariaLabel="企业匹配结果"
          items={model.displayedResults}
          height={VIRTUAL_LIST_HEIGHT}
          itemHeight={VIRTUAL_ROW_HEIGHT}
          empty={(
            <div className="company-result-filter-empty">
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="匹配失败项已过滤"
              />
            </div>
          )}
          getKey={getResultKey}
          onRenderedRangeChange={interactions.handleResultRenderedRangeChange}
          onScrollOffset={interactions.handleResultScroll}
          renderItem={(result) => (
            <ResultListItem
              result={result}
              isActive={result.sourceIds.some((sourceId) =>
                interactions.activeSourceIds.includes(sourceId))}
              isEditing={model.editingSourceId === result.sourceId}
              itemRef={(element) => interactions.registerResultItem(result, element)}
              onMouseEnter={(event) => interactions.handleResultMouseEnter(result, event)}
              onMouseLeave={() => interactions.setHoveredSources([])}
              onEditOpenChange={(open) =>
                model.setEditingSourceId(open ? result.sourceId : null)}
              onManualMatch={(company) => model.handleManualMatch(result.sourceId, company)}
            />
          )}
        />
      )}
    </section>
  )
}
