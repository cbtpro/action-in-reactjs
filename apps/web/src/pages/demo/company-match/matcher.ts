import type {
  Company,
  CompanyMatch,
  CompanyMatchStrategy,
  MatchCandidate,
} from './types'

const normalize = (value: string) =>
  value
    .trim()
    .toLocaleLowerCase()
    .replace(/[\s()（）·,，.。\-—_]/g, '')

const removeCompanySuffix = (value: string) =>
  normalize(value).replace(/(有限责任公司|股份有限公司|有限公司|集团|公司)$/u, '')

const findBy = (
  companies: Company[],
  predicate: (name: string) => boolean,
): Company | undefined =>
  companies.find(
    (company) =>
      predicate(company.name) || company.aliases.some((alias) => predicate(alias)),
  )

export const exactNameStrategy: CompanyMatchStrategy = {
  id: 'exact-name',
  label: '企业全称',
  priority: 100,
  match(sourceName, companies) {
    const company = companies.find(
      (item) => normalize(item.name) === normalize(sourceName),
    )
    return company ? { company, confidence: 1 } : null
  },
}

export const aliasStrategy: CompanyMatchStrategy = {
  id: 'alias',
  label: '常用简称',
  priority: 80,
  match(sourceName, companies) {
    const source = normalize(sourceName)
    const company = companies.find((item) =>
      item.aliases.some((alias) => normalize(alias) === source),
    )
    return company ? { company, confidence: 0.96 } : null
  },
}

export const normalizedNameStrategy: CompanyMatchStrategy = {
  id: 'normalized-name',
  label: '名称归一化',
  priority: 60,
  match(sourceName, companies) {
    const source = removeCompanySuffix(sourceName)
    if (source.length < 3) return null
    const company = findBy(companies, (name) => removeCompanySuffix(name) === source)
    return company ? { company, confidence: 0.9 } : null
  },
}

const DEFAULT_STRATEGIES = [
  exactNameStrategy,
  aliasStrategy,
  normalizedNameStrategy,
]

/** 按优先级串联策略；扩展时通过构造函数注入新策略即可。 */
export class CompanyMatcher {
  private readonly strategies: CompanyMatchStrategy[]

  constructor(strategies: CompanyMatchStrategy[] = DEFAULT_STRATEGIES) {
    this.strategies = [...strategies].sort((a, b) => b.priority - a.priority)
  }

  matchOne(sourceName: string, companies: Company[]): Omit<CompanyMatch, 'sourceId'> {
    for (const strategy of this.strategies) {
      const candidate: MatchCandidate | null = strategy.match(sourceName, companies)
      if (candidate) {
        return {
          sourceName,
          company: candidate.company,
          kind:
            strategy.id === 'exact-name'
              ? 'exact'
              : strategy.id === 'alias'
                ? 'alias'
                : 'normalized',
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

  matchAll(sourceNames: string[], companies: Company[]): CompanyMatch[] {
    return sourceNames.map((sourceName, index) => ({
      sourceId: `source-${index}`,
      ...this.matchOne(sourceName, companies),
    }))
  }
}

export const companyMatcher = new CompanyMatcher()
