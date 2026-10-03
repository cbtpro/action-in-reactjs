import { Button, Space, Tag } from 'antd'
import { ExperimentOutlined } from '@ant-design/icons'

export interface VirtualListBenchmarkProps {
  onCreateTestData: (count: number) => void
  matchDuration: number | null
  hasResult: boolean
  uniqueMatchedCount: number
  renderedRowCount: number
}

/**
 * 虚拟列表性能验证工具条：一键生成大批量测试数据，并展示匹配耗时、
 * 去重后数量和当前单列实际渲染的 DOM 行数，用来直观验证虚拟滚动效果。
 *
 * @param props - 测试数据生成回调和当前性能统计。
 * @returns 性能测试操作与统计工具条。
 */
export function VirtualListBenchmark({
  onCreateTestData,
  matchDuration,
  hasResult,
  uniqueMatchedCount,
  renderedRowCount,
}: VirtualListBenchmarkProps) {
  return (
    <div className="company-match-benchmark">
      <div className="company-match-benchmark__intro">
        <ExperimentOutlined />
        <div>
          <strong>虚拟列表性能验证</strong>
          <span>生成大批量数据，列表始终只渲染视口附近约 20 行</span>
        </div>
      </div>
      <Space wrap>
        <Button onClick={() => onCreateTestData(1000)}>载入 1,000 条</Button>
        <Button onClick={() => onCreateTestData(10000)}>载入 10,000 条</Button>
        {matchDuration !== null && (
          <Tag color="processing">匹配耗时 {matchDuration.toFixed(1)} ms</Tag>
        )}
        {hasResult && <Tag color="success">去重后 {uniqueMatchedCount} 家</Tag>}
        <Tag>单列 DOM 行数 {renderedRowCount}</Tag>
      </Space>
    </div>
  )
}
