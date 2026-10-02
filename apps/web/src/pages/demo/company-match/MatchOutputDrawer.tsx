import { Alert, Drawer, Space, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table/interface'
import type { CompanyMatch } from './types'
import type { DeduplicatedCompanyMatch } from './deduplicateMatches'

const MATCH_KIND_LABEL: Record<CompanyMatch['kind'], string> = {
  exact: '全称命中',
  alias: '简称命中',
  normalized: '智能命中',
  manual: '人工匹配',
  unmatched: '未匹配',
}

const outputColumns: ColumnsType<DeduplicatedCompanyMatch> = [
  {
    title: '原始词条来源',
    width: 240,
    render: (_, record) => (
      <Space size={6} wrap>
        <span>{record.sourceNames.slice(0, 2).join('、')}{record.sourceNames.length > 2 ? ' 等' : ''}</span>
        {record.sourceCount > 1 && <Tag>合并 {record.sourceCount} 条</Tag>}
      </Space>
    ),
  },
  {
    title: '匹配企业',
    render: (_, record) => record.company?.name,
  },
  {
    title: '地区',
    width: 130,
    render: (_, record) => record.company?.region,
  },
  {
    title: '统一社会信用代码',
    width: 190,
    render: (_, record) => record.company?.creditCode,
  },
  {
    title: '匹配方式',
    width: 110,
    render: (_, record) => <Tag color={record.kind === 'manual' ? 'purple' : 'blue'}>{MATCH_KIND_LABEL[record.kind]}</Tag>,
  },
]

export interface MatchOutputDrawerProps {
  open: boolean
  onClose: () => void
  uniqueMatchedResults: DeduplicatedCompanyMatch[]
  duplicateCount: number
  unmatchedCount: number
}

/**
 * 最终输出面板：去重后的标准企业名单表格，以及去重/未匹配提示。
 *
 * 独立成组件后，表格列定义和匹配方式文案只在这里维护，
 * 不再占用主页面组件的篇幅。
 */
export function MatchOutputDrawer({
  open,
  onClose,
  uniqueMatchedResults,
  duplicateCount,
  unmatchedCount,
}: MatchOutputDrawerProps) {
  return (
    <Drawer
      size={920}
      open={open}
      onClose={onClose}
      title="标准企业名单（已去重）"
      extra={<Tag color="success">{uniqueMatchedResults.length} 家企业</Tag>}
    >
      {duplicateCount > 0 && (
        <Alert
          showIcon
          type="success"
          title={`已按企业 ID 合并 ${duplicateCount} 条重复匹配结果`}
          style={{ marginBottom: 16 }}
        />
      )}
      {unmatchedCount > 0 && (
        <Alert
          showIcon
          type="warning"
          title={`${unmatchedCount} 个未匹配词条已跳过，可返回继续人工匹配`}
          style={{ marginBottom: 16 }}
        />
      )}
      <Table<DeduplicatedCompanyMatch>
        rowKey="sourceId"
        size="middle"
        pagination={false}
        columns={outputColumns}
        dataSource={uniqueMatchedResults}
        virtual
        scroll={{ x: 850, y: 620 }}
      />
    </Drawer>
  )
}
