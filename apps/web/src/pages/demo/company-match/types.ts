export interface Company {
  id: string
  name: string
  shortName: string
  aliases: string[]
  logo: {
    src?: string
    text: string
    background: string
    foreground: string
  }
  creditCode: string
  region: string
  industry: string
}

export type MatchKind = 'exact' | 'alias' | 'normalized' | 'manual' | 'unmatched'

export interface CompanyMatch {
  sourceId: string
  sourceName: string
  company: Company | null
  kind: MatchKind
  strategyLabel: string
  confidence: number
}

export interface MatchCandidate {
  company: Company
  confidence: number
}

/**
 * 匹配策略扩展点。
 *
 * 新增拼音、统一社会信用代码或远程 AI 匹配时，只需实现这个接口并注入
 * CompanyMatcher，无需修改页面和既有策略（开闭原则）。
 */
export interface CompanyMatchStrategy {
  id: string
  label: string
  priority: number
  match: (sourceName: string, companies: Company[]) => MatchCandidate | null
}
