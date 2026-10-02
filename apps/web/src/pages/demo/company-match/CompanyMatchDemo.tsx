import { useState } from 'react'
import {
  Badge,
  Button,
  Checkbox,
  Empty,
  Input,
  Progress,
  Space,
  Steps,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import {
  ArrowRightOutlined,
  FileSearchOutlined,
  LeftOutlined,
  RightOutlined,
} from '@ant-design/icons'
import { VirtualList } from './VirtualList'
import { CompanyMatchHero } from './CompanyMatchHero'
import { VirtualListBenchmark } from './VirtualListBenchmark'
import { ConnectorSvgLayer } from './ConnectorSvgLayer'
import { SourceListItem } from './SourceListItem'
import { ResultListItem } from './ResultListItem'
import { MatchOutputDrawer } from './MatchOutputDrawer'
import { getResultKey } from './companyMatchViewModel'
import { useCompanyMatchModel } from './useCompanyMatchModel'
import { useCompanyMatchInteractions } from './useCompanyMatchInteractions'
import './company-match.css'

const { Text } = Typography
const VIRTUAL_LIST_HEIGHT = 460
const VIRTUAL_ROW_HEIGHT = 84

export default function CompanyMatchDemoPage() {
  const [renderedSourceCount, setRenderedSourceCount] = useState(0)
  const [renderedResultCount, setRenderedResultCount] = useState(0)
  const [isSourceInputCollapsed, setIsSourceInputCollapsed] = useState(false)
  const model = useCompanyMatchModel()
  const interactions = useCompanyMatchInteractions({
    displayedResults: model.displayedResults,
    resultIndexBySourceId: model.resultIndexBySourceId,
    resultByKey: model.resultByKey,
    hasResult: model.hasResult,
    isSourceInputCollapsed,
    onRenderedSourceCountChange: setRenderedSourceCount,
    onRenderedResultCountChange: setRenderedResultCount,
  })

  return (
    <section className="company-match-page">
      <CompanyMatchHero
        pendingCount={model.sourceNames.length}
        matchedCount={model.matchedCount}
        hasResult={model.hasResult}
        unmatchedCount={model.unmatchedCount}
      />

      <Steps
        className="company-match-steps"
        current={model.hasResult ? (model.unmatchedCount ? 1 : 2) : 0}
        items={[
          { title: '录入名单', content: '一行一家企业' },
          { title: '自动匹配', content: '确认异常词条' },
          { title: '输出结果', content: '生成标准名单' },
        ]}
      />

      <VirtualListBenchmark
        onCreateTestData={model.handleCreateTestData}
        matchDuration={model.matchDuration}
        hasResult={model.hasResult}
        uniqueMatchedCount={model.uniqueMatchedResults.length}
        renderedRowCount={Math.max(renderedSourceCount, renderedResultCount)}
      />

      <div
        ref={interactions.workspaceRef}
        className="company-match-workspace"
        onMouseMove={interactions.handleWorkspaceMouseMove}
        onMouseLeave={interactions.handleWorkspaceMouseLeave}
      >
        <ConnectorSvgLayer layer={interactions.connectorLayer} />
        <section className="company-match-panel company-match-panel--source">
          <div className="company-match-panel__header">
            <div>
              <span className="company-match-panel__index">01</span>
              <div><h3>原始企业名单</h3><p>支持换行、逗号或分号分隔</p></div>
            </div>
            <Badge count={model.sourceNames.length} showZero color="#5b67f1" />
          </div>
          <div className={`company-source-layout${isSourceInputCollapsed ? ' is-input-collapsed' : ''}`}>
            <div className="company-source-input-pane">
              <div className="company-source-pane__header">
                <span>原始输入</span>
                <Tooltip title={isSourceInputCollapsed ? '展开原始企业名单' : '向左收起原始企业名单'}>
                  <Button
                    type="text"
                    size="small"
                    icon={isSourceInputCollapsed ? <RightOutlined /> : <LeftOutlined />}
                    onClick={() => setIsSourceInputCollapsed((collapsed) => !collapsed)}
                    aria-label={isSourceInputCollapsed ? '展开原始企业名单' : '收起原始企业名单'}
                  />
                </Tooltip>
              </div>
              {!isSourceInputCollapsed && (
                <Input.TextArea
                  className="company-match-input"
                  value={model.rawInput}
                  onChange={(event) => model.handleInputChange(event.target.value)}
                  placeholder="请输入公司名称，每行一家"
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
                  const result = model.matches[index]
                  return (
                    <SourceListItem
                      name={name}
                      index={index}
                      sourceId={sourceId}
                      result={result}
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

        <div className="company-match-action">
          <span className="company-match-action__line" />
          <Tooltip title={model.sourceNames.length ? '运行全部匹配策略' : '请先输入企业名称'}>
            <Button
              className="company-match-action__button"
              type="primary"
              shape="circle"
              size="large"
              icon={<ArrowRightOutlined />}
              disabled={!model.sourceNames.length}
              onClick={model.handleMatch}
              loading={model.isPending}
              aria-label="开始匹配"
            />
          </Tooltip>
          <span className="company-match-action__label">智能匹配</span>
          <span className="company-match-action__line" />
        </div>

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
                  isActive={result.sourceIds.some((sourceId) => interactions.activeSourceIds.includes(sourceId))}
                  isEditing={model.editingSourceId === result.sourceId}
                  itemRef={(element) => interactions.registerResultItem(result, element)}
                  onMouseEnter={(event) => interactions.handleResultMouseEnter(result, event)}
                  onMouseLeave={() => interactions.setHoveredSources([])}
                  onEditOpenChange={(open) => model.setEditingSourceId(open ? result.sourceId : null)}
                  onManualMatch={(company) => model.handleManualMatch(result.sourceId, company)}
                />
              )}
            />
          )}
        </section>
      </div>

      <footer className="company-match-footer">
        <div className="company-match-footer__progress">
          <Progress
            percent={model.hasResult ? Math.round((model.matchedCount / model.matches.length) * 100) : 0}
            showInfo={false}
          />
          <span>
            {model.hasResult
              ? `已完成 ${model.matchedCount} 条，${model.unmatchedCount} 条待确认`
              : '匹配后可生成标准企业名单'}
          </span>
        </div>
        <Space>
          {model.unmatchedCount > 0 && <Text type="warning">未匹配项不会进入输出名单</Text>}
          <Button
            type="primary"
            size="large"
            disabled={!model.matchedCount}
            onClick={() => model.setResultOpen(true)}
          >
            下一步 · 生成名单
          </Button>
        </Space>
      </footer>

      <MatchOutputDrawer
        open={model.resultOpen}
        onClose={() => model.setResultOpen(false)}
        uniqueMatchedResults={model.uniqueMatchedResults}
        duplicateCount={model.duplicateCount}
        unmatchedCount={model.unmatchedCount}
      />
    </section>
  )
}
