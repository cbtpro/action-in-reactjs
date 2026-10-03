import type {
  Company,
  CompanyMatch,
  CompanyMatchStrategy,
  MatchCandidate,
} from './types'

/**
 * 归一化企业名称，消除大小写、空白和常见分隔符差异。
 *
 * @param value - 待归一化的企业名称。
 * @returns 可用于等值比较的名称。
 */
const normalize = (value: string) =>
  value
    .trim()
    .toLocaleLowerCase()
    .replace(/[\s()（）·,，.。\-—_]/g, '')

/**
 * 删除归一化名称末尾的常见企业组织形式。
 *
 * @param value - 待处理的企业名称。
 * @returns 不含常见企业后缀的归一化名称。
 */
const removeCompanySuffix = (value: string) =>
  normalize(value).replace(/(有限责任公司|股份有限公司|有限公司|集团|公司)$/u, '')

/**
 * 归一化统一社会信用代码，消除大小写和常见分隔符差异。
 *
 * @param value - 待处理的统一社会信用代码。
 * @returns 大写且不含分隔符的信用代码。
 */
const normalizeCreditCode = (value: string) =>
  value.trim().toLocaleUpperCase().replace(/[\s\-—_]/g, '')

/** 统一社会信用代码允许的 18 位字符格式。 */
const CREDIT_CODE_PATTERN = /^[0-9A-HJ-NPQRTUWXY]{18}$/u

/**
 * 在企业全称和别名中查找满足条件的第一家公司。
 *
 * @param companies - 可搜索的标准企业目录。
 * @param predicate - 用于判断名称或别名是否命中的函数。
 * @returns 首个命中的企业；没有命中时返回 `undefined`。
 */
const findBy = (
  companies: Company[],
  predicate: (name: string) => boolean,
): Company | undefined =>
  companies.find(
    (company) =>
      predicate(company.name) || company.aliases.some((alias) => predicate(alias)),
  )

/** 使用归一化后的完整企业名称进行精确匹配。 */
export const exactNameStrategy: CompanyMatchStrategy = {
  id: 'exact-name',
  label: '企业全称',
  kind: 'exact',
  priority: 100,
  match(sourceName, companies) {
    const company = companies.find(
      (item) => normalize(item.name) === normalize(sourceName),
    )
    return company ? { company, confidence: 1 } : null
  },
}

/** 使用企业目录中维护的常用别名进行精确匹配。 */
export const aliasStrategy: CompanyMatchStrategy = {
  id: 'alias',
  label: '常用简称',
  kind: 'alias',
  priority: 80,
  match(sourceName, companies) {
    const source = normalize(sourceName)
    const company = companies.find((item) =>
      item.aliases.some((alias) => normalize(alias) === source),
    )
    return company ? { company, confidence: 0.96 } : null
  },
}

/** 删除企业组织形式后匹配名称，适用于输入省略“有限公司”等后缀的情况。 */
export const normalizedNameStrategy: CompanyMatchStrategy = {
  id: 'normalized-name',
  label: '名称归一化',
  kind: 'normalized',
  priority: 60,
  match(sourceName, companies) {
    const source = removeCompanySuffix(sourceName)
    if (source.length < 3) return null
    const company = findBy(companies, (name) => removeCompanySuffix(name) === source)
    return company ? { company, confidence: 0.9 } : null
  },
}

/** 使用合法的 18 位统一社会信用代码进行最高优先级匹配。 */
export const creditCodeStrategy: CompanyMatchStrategy = {
  id: 'credit-code',
  label: '统一社会信用代码',
  kind: 'credit-code',
  priority: 120,
  match(sourceName, companies) {
    const source = normalizeCreditCode(sourceName)
    if (!CREDIT_CODE_PATTERN.test(source)) return null

    const company = companies.find(
      (item) => normalizeCreditCode(item.creditCode) === source,
    )
    return company ? { company, confidence: 1 } : null
  },
}

/** 默认匹配策略集合；`CompanyMatcher` 会在执行前按优先级重新排序。 */
const DEFAULT_STRATEGIES = [
  creditCodeStrategy,
  exactNameStrategy,
  aliasStrategy,
  normalizedNameStrategy,
]

/** 按优先级串联匹配策略的企业匹配器。 */
export class CompanyMatcher {
  private readonly strategies: CompanyMatchStrategy[]

  /**
   * 创建企业匹配器并按优先级降序保存策略。
   *
   * @param strategies - 可插拔的匹配策略；默认使用内置策略集合。
   */
  constructor(strategies: CompanyMatchStrategy[] = DEFAULT_STRATEGIES) {
    this.strategies = [...strategies].sort((a, b) => b.priority - a.priority)
  }

  /**
   * 使用首个命中的策略匹配一条来源数据。
   *
   * @param sourceName - 用户输入的企业名称或统一社会信用代码。
   * @param companies - 用于匹配的标准企业目录。
   * @returns 不含来源 ID 的匹配结果；所有策略未命中时返回未匹配结果。
   */
  matchOne(sourceName: string, companies: Company[]): Omit<CompanyMatch, 'sourceId'> {
    for (const strategy of this.strategies) {
      const candidate: MatchCandidate | null = strategy.match(sourceName, companies)
      if (candidate) {
        return {
          sourceName,
          company: candidate.company,
          kind: strategy.kind,
          strategyLabel: strategy.label,
          confidence: candidate.confidence,
        }
      }
    }

    return {
      sourceName,
      company: null,
      kind: 'unmatched',
      strategyLabel: '未找到候选',
      confidence: 0,
    }
  }

  /**
   * 按输入顺序批量匹配来源数据并生成稳定来源 ID。
   *
   * @param sourceNames - 用户输入的企业名称或统一社会信用代码列表。
   * @param companies - 用于匹配的标准企业目录。
   * @returns 与输入顺序一致的匹配结果列表。
   */
  matchAll(sourceNames: string[], companies: Company[]): CompanyMatch[] {
    return sourceNames.map((sourceName, index) => ({
      sourceId: `source-${index}`,
      ...this.matchOne(sourceName, companies),
    }))
  }
}

/** 页面默认使用的企业匹配器实例。 */
export const companyMatcher = new CompanyMatcher()
