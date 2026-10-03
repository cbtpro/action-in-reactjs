import { Typography } from 'antd'

/** Ant Design 标题和文本组件的局部别名。 */
const { Text, Title } = Typography

export interface CompanyMatchHeroProps {
  pendingCount: number
  matchedCount: number
  hasResult: boolean
  unmatchedCount: number
}

/**
 * 渲染页面标题和待处理、已匹配、待确认三项汇总统计。
 *
 * @param props - 当前输入和匹配状态的数量统计。
 * @returns 批量匹配页面的顶部信息区。
 */
export function CompanyMatchHero({
  pendingCount,
  matchedCount,
  hasResult,
  unmatchedCount,
}: CompanyMatchHeroProps) {
  return (
    <header className="company-match-hero">
      <div>
        <Title level={2}>批量匹配公司</Title>
        <Text type="secondary">粘贴企业名单，自动校准为工商企业全称，人工处理未命中项后统一输出。</Text>
      </div>
      <div className="company-match-hero__summary">
        <div><strong>{pendingCount}</strong><span>待处理</span></div>
        <div><strong>{matchedCount}</strong><span>已匹配</span></div>
        <div className={unmatchedCount > 0 ? 'has-warning' : ''}><strong>{hasResult ? unmatchedCount : 0}</strong><span>待确认</span></div>
      </div>
    </header>
  )
}
