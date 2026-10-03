import { Badge, Button, Input, Tooltip } from 'antd'
import { LeftOutlined, RightOutlined } from '@ant-design/icons'
import { SourceListItem } from './SourceListItem'
import { VirtualList } from './VirtualList'
import {
  VIRTUAL_LIST_HEIGHT,
  VIRTUAL_ROW_HEIGHT,
} from './companyMatchConstants'
import type { CompanyMatchModel } from './useCompanyMatchModel'
import type { CompanyMatchWorkspaceState } from './useCompanyMatchWorkspace'

export interface CompanySourcePanelProps {
  model: CompanyMatchModel
  workspace: CompanyMatchWorkspaceState
}

/**
 * 渲染原始企业输入和解析后的来源词条虚拟列表。
 *
 * @param props - 页面数据模型和工作区交互状态。
 * @returns 可折叠输入区及来源词条列表。
 */
export function CompanySourcePanel({ model, workspace }: CompanySourcePanelProps) {
  const { interactions } = workspace

  return (
    <section className="company-match-panel company-match-panel--source">
      <div className="company-match-panel__header">
        <div>
          <span className="company-match-panel__index">01</span>
          <div><h3>原始企业名单</h3><p>支持企业名称或统一社会信用代码</p></div>
        </div>
        <Badge count={model.sourceNames.length} showZero color="#5b67f1" />
      </div>

      <div className={`company-source-layout${workspace.isSourceInputCollapsed ? ' is-input-collapsed' : ''}`}>
        <div className="company-source-input-pane">
          <div className="company-source-pane__header">
            <span>原始输入</span>
            <Tooltip title={workspace.isSourceInputCollapsed ? '展开原始企业名单' : '向左收起原始企业名单'}>
              <Button
                type="text"
                size="small"
                icon={workspace.isSourceInputCollapsed ? <RightOutlined /> : <LeftOutlined />}
                onClick={workspace.toggleSourceInput}
                aria-label={workspace.isSourceInputCollapsed ? '展开原始企业名单' : '收起原始企业名单'}
              />
            </Tooltip>
          </div>
          {!workspace.isSourceInputCollapsed && (
            <Input.TextArea
              className="company-match-input"
              value={model.rawInput}
              onChange={(event) => model.handleInputChange(event.target.value)}
              placeholder="请输入公司名称或统一社会信用代码，每行一条"
            />
          )}
        </div>

        <div className="company-source-list-pane">
          <div className="company-source-pane__header">
            <span>解析词条</span>
            <span className="company-source-pane__count">{model.sourceNames.length} 条</span>
          </div>
          <VirtualList
            ref={interactions.sourceListRef}
            className="company-source-list"
            ariaLabel="已解析企业词条"
            items={model.sourceNames}
            height={VIRTUAL_LIST_HEIGHT}
            itemHeight={VIRTUAL_ROW_HEIGHT}
            getKey={(name, index) => `${name}-${index}`}
            onRenderedRangeChange={interactions.handleSourceRenderedRangeChange}
            onScrollOffset={interactions.handleSourceScroll}
            renderItem={(name, index) => {
              const sourceId = `source-${index}`
              return (
                <SourceListItem
                  name={name}
                  index={index}
                  sourceId={sourceId}
                  result={model.matches[index]}
                  isActive={interactions.activeSourceIds.includes(sourceId)}
                  itemRef={(element) => interactions.registerSourceItem(sourceId, element)}
                  onMouseEnter={(event) => interactions.handleSourceMouseEnter(sourceId, event)}
                  onMouseLeave={() => interactions.setHoveredSources([])}
                />
              )
            }}
          />
        </div>
      </div>
    </section>
  )
}
