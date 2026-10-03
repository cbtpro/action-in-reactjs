import { Button, Progress, Space, Typography } from 'antd'
import type { CompanyMatchModel } from './useCompanyMatchModel'

/** Ant Design 文本组件的局部别名。 */
const { Text } = Typography

export interface CompanyMatchFooterProps {
  model: CompanyMatchModel
}

/**
 * 渲染匹配进度和进入输出名单的页面底部操作区。
 *
 * @param props - 批量匹配页面的数据模型。
 * @returns 包含进度提示和下一步按钮的底部区域。
 */
export function CompanyMatchFooter({ model }: CompanyMatchFooterProps) {
  const progress = model.hasResult
    ? Math.round((model.matchedCount / model.matches.length) * 100)
    : 0

  return (
    <footer className="company-match-footer">
      <div className="company-match-footer__progress">
        <Progress percent={progress} showInfo={false} />
        <span>
          {model.hasResult
            ? `已完成 ${model.matchedCount} 条，${model.unmatchedCount} 条待确认`
            : '匹配后可生成标准企业名单'}
        </span>
      </div>
      <Space>
        {model.unmatchedCount > 0 && (
          <Text type="warning">未匹配项不会进入输出名单</Text>
        )}
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
  )
}
