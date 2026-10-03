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

export type MatchKind =
  | 'credit-code'
  | 'exact'
  | 'alias'
  | 'normalized'
  | 'manual'
  | 'unmatched'

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
 * 新增拼音、登记注册号或远程 AI 匹配时，只需实现这个接口并注入
 * CompanyMatcher，无需修改页面和既有策略（开闭原则）。
 */
export interface CompanyMatchStrategy {
  /** 策略的稳定标识。 */
  id: string
  /** 页面和输出结果使用的策略名称。 */
  label: string
  /** 策略命中后写入匹配结果的类型。 */
  kind: Exclude<MatchKind, 'manual' | 'unmatched'>
  /** 策略执行顺序；数值越大越先执行。 */
  priority: number
  /**
   * 尝试从标准企业目录中匹配一条来源数据。
   *
   * @param sourceName - 用户输入的企业名称或统一社会信用代码。
   * @param companies - 可供检索的标准企业目录。
   * @returns 命中的企业和置信度；没有命中时返回 `null`。
   */
  match: (sourceName: string, companies: Company[]) => MatchCandidate | null
}
