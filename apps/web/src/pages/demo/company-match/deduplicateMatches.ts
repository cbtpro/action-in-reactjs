import type { CompanyMatch } from './types'

export interface DeduplicatedCompanyMatch extends CompanyMatch {
  /** 归并到该结果的原始词条 ID，用于双向高亮 */
  sourceIds: string[]
  /** 归并到该企业的不同原始名称 */
  sourceNames: string[]
  /** 归并前的匹配结果条数 */
  sourceCount: number
}

/**
 * 按企业主键去重，而不是按输入文本去重。
 *
 * “腾讯”“深圳腾讯”等不同写法可能指向同一企业，只有在完成匹配后使用
 * company.id 才能正确合并，同时保留来源数量用于审计和结果说明。
 */
export function deduplicateCompanyMatches(
  matches: CompanyMatch[],
  options: { includeUnmatched?: boolean } = {},
): DeduplicatedCompanyMatch[] {
  const uniqueResults = new Map<string, DeduplicatedCompanyMatch>()

  matches.forEach((match) => {
    if (!match.company && !options.includeUnmatched) return

    // 未匹配项仍需逐条保留，以便用户分别进行人工修正。
    const resultKey = match.company?.id ?? `unmatched:${match.sourceId}`
    const existing = uniqueResults.get(resultKey)
    if (!existing) {
      uniqueResults.set(resultKey, {
        ...match,
        sourceIds: [match.sourceId],
        sourceNames: [match.sourceName],
        sourceCount: 1,
      })
      return
    }

    existing.sourceCount += 1
    existing.sourceIds.push(match.sourceId)
    if (!existing.sourceNames.includes(match.sourceName)) {
      existing.sourceNames.push(match.sourceName)
    }
    // 结果卡片使用组内可信度最高的策略信息，来源明细仍各自保留原始匹配度。
    if (match.confidence > existing.confidence) {
      existing.confidence = match.confidence
      existing.kind = match.kind
      existing.strategyLabel = match.strategyLabel
    }
  })

  return [...uniqueResults.values()]
}
