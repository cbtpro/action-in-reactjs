import { Steps } from 'antd'
import { CompanyMatchFooter } from './CompanyMatchFooter'
import { CompanyMatchHero } from './CompanyMatchHero'
import { CompanyMatchWorkspace } from './CompanyMatchWorkspace'
import { MatchOutputDrawer } from './MatchOutputDrawer'
import { VirtualListBenchmark } from './VirtualListBenchmark'
import { useCompanyMatchModel } from './useCompanyMatchModel'
import { useCompanyMatchWorkspace } from './useCompanyMatchWorkspace'
import './company-match.css'

/** 批量公司匹配流程的步骤配置。 */
const STEP_ITEMS = [
  { title: '录入名单', content: '一行一家企业' },
  { title: '自动匹配', content: '确认异常词条' },
  { title: '输出结果', content: '生成标准名单' },
]

/**
 * 组合批量公司匹配页面的数据模型、工作区和输出面板。
 *
 * @returns 批量公司匹配 Demo 页面。
 */
export default function CompanyMatchDemoPage() {
  const model = useCompanyMatchModel()
  const workspace = useCompanyMatchWorkspace(model)

  return (
    <section
      ref={workspace.interactions.componentRootRef}
      className="company-match-page"
    >
      <CompanyMatchHero
        pendingCount={model.sourceNames.length}
        matchedCount={model.matchedCount}
        hasResult={model.hasResult}
        unmatchedCount={model.unmatchedCount}
      />

      <Steps
        className="company-match-steps"
        current={model.hasResult ? (model.unmatchedCount ? 1 : 2) : 0}
        items={STEP_ITEMS}
      />

      <VirtualListBenchmark
        onCreateTestData={model.handleCreateTestData}
        matchDuration={model.matchDuration}
        hasResult={model.hasResult}
        uniqueMatchedCount={model.uniqueMatchedResults.length}
        renderedRowCount={workspace.renderedRowCount}
      />

      <CompanyMatchWorkspace model={model} workspace={workspace} />
      <CompanyMatchFooter model={model} />

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
