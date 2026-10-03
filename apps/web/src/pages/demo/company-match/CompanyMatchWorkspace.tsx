import { Button, Tooltip } from 'antd'
import { ArrowRightOutlined } from '@ant-design/icons'
import { CompanySourcePanel } from './CompanySourcePanel'
import { CompanyResultPanel } from './CompanyResultPanel'
import { ConnectorSvgLayer } from './ConnectorSvgLayer'
import type { CompanyMatchModel } from './useCompanyMatchModel'
import type { CompanyMatchWorkspaceState } from './useCompanyMatchWorkspace'

export interface CompanyMatchWorkspaceProps {
  model: CompanyMatchModel
  workspace: CompanyMatchWorkspaceState
}

/**
 * 组合来源面板、匹配操作、结果面板和 SVG 连线图层。
 *
 * @param props - 页面数据模型和工作区交互状态。
 * @returns 批量匹配的双栏工作区。
 */
export function CompanyMatchWorkspace({ model, workspace }: CompanyMatchWorkspaceProps) {
  const { interactions } = workspace

  return (
    <div
      ref={interactions.workspaceRef}
      className="company-match-workspace"
      onMouseMove={interactions.handleWorkspaceMouseMove}
      onMouseLeave={interactions.handleWorkspaceMouseLeave}
    >
      <ConnectorSvgLayer layer={interactions.connectorLayer} />
      <CompanySourcePanel model={model} workspace={workspace} />

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

      <CompanyResultPanel model={model} workspace={workspace} />
    </div>
  )
}
