import type { Company } from './types'

export interface CompanyLogoProps {
  /** 已匹配的企业；为空时表示未匹配，交由调用方显示警示图标 */
  company: Company | null
  /** 企业简称，用于没有真实 logo 图片时的文字兜底渲染 */
  shortName: string
}

/**
 * 企业头像：真实 logo 图片优先，没有图片时退化为品牌色文字头像。
 *
 * 文字内容来自 `COMPANY_SHORT_NAMES` 简称表而不是机械截取企业全称，
 * 避免类似“中国移动”被错误截断为“中国”。
 *
 * 当前采用“固定字号 + 自动换行”的折中方案做字体自适应：简称超过两个字时
 * 拆成两行显示，而不是根据容器宽度动态计算 font-size，详见项目文档
 * docs/building-a-batch-company-matcher-with-react.md 的“公司头像如何实现”一节。
 */
export function CompanyLogo({ company, shortName }: CompanyLogoProps) {
  if (company?.logo.src) {
    return (
      <img
        className="company-result-item__logo"
        src={company.logo.src}
        alt={`${company.name} Logo`}
      />
    )
  }

  return (
    <span
      className="company-result-item__logo"
      style={{
        background: company?.logo.background,
        color: company?.logo.foreground,
      }}
      role="img"
      aria-label={`${company?.name} Logo`}
    >
      {shortName.length > 2 ? (
        <>
          <span className="company-result-item__logo-line">{shortName.slice(0, 2)}</span>
          <span className="company-result-item__logo-line">{shortName.slice(2)}</span>
        </>
      ) : (
        shortName
      )}
    </span>
  )
}
