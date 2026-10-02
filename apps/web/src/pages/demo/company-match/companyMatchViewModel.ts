import type { DeduplicatedCompanyMatch } from './deduplicateMatches'

export const parseCompanyNames = (value: string) =>
  value
    .split(/[\n,，;；]+/)
    .map((item) => item.trim())
    .filter(Boolean)

export const getResultKey = (result: DeduplicatedCompanyMatch) =>
  result.company?.id ?? result.sourceId

export const getSourceIndex = (sourceId: string) => {
  const match = /^source-(\d+)$/.exec(sourceId)
  return match ? Number(match[1]) : null
}
