import { useMemo, useState, useTransition } from 'react'
import { COMPANY_DIRECTORY, MODEL_MATCH_TEST_NAMES } from './companyData'
import { createPerformanceCompanyNames } from './performanceData'
import { companyMatcher } from './matcher'
import { deduplicateCompanyMatches } from './deduplicateMatches'
import type { Company, CompanyMatch } from './types'
import { getResultKey, parseCompanyNames } from './companyMatchViewModel'

const DEFAULT_INPUT = [
  ...MODEL_MATCH_TEST_NAMES.slice(0, 10),
  '北京未来星科技有限公司',
].join('\n')

/**
 * 批量匹配页面的数据模型。
 *
 * 输入解析、匹配执行、人工纠错、去重、排序和过滤都收敛在这里；页面组件
 * 只消费已经派生好的视图数据，不需要了解这些状态之间的更新顺序。
 */
export function useCompanyMatchModel() {
  const [rawInput, setRawInput] = useState(DEFAULT_INPUT)
  const [matches, setMatches] = useState<CompanyMatch[]>([])
  const [editingSourceId, setEditingSourceId] = useState<string | null>(null)
  const [resultOpen, setResultOpen] = useState(false)
  const [matchDuration, setMatchDuration] = useState<number | null>(null)
  const [keepImportOrder, setKeepImportOrder] = useState(false)
  const [hideUnmatchedResults, setHideUnmatchedResults] = useState(false)
  const [isPending, startTransition] = useTransition()

  const sourceNames = useMemo(() => parseCompanyNames(rawInput), [rawInput])
  const matchedCount = useMemo(
    () => matches.filter((item) => item.company).length,
    [matches],
  )
  const unmatchedCount = matches.length - matchedCount
  const hasResult = matches.length > 0
  const uniqueMatchedResults = useMemo(
    () => deduplicateCompanyMatches(matches),
    [matches],
  )
  const displayedResults = useMemo(() => {
    const results = deduplicateCompanyMatches(matches, { includeUnmatched: true })
    const filteredResults = hideUnmatchedResults
      ? results.filter((result) => result.company)
      : results

    if (keepImportOrder) return filteredResults

    // 默认让待处理项置顶，人工确认后会自动回到已匹配结果区域。
    return [...filteredResults].sort((left, right) =>
      Number(Boolean(left.company)) - Number(Boolean(right.company)),
    )
  }, [hideUnmatchedResults, keepImportOrder, matches])
  const resultIndexBySourceId = useMemo(() => {
    const indexBySourceId = new Map<string, number>()
    displayedResults.forEach((result, resultIndex) => {
      result.sourceIds.forEach((sourceId) => {
        indexBySourceId.set(sourceId, resultIndex)
      })
    })
    return indexBySourceId
  }, [displayedResults])
  const resultByKey = useMemo(
    () => new Map(displayedResults.map((result) => [getResultKey(result), result])),
    [displayedResults],
  )

  const handleInputChange = (value: string) => {
    setRawInput(value)
    setMatches([])
    setEditingSourceId(null)
    setMatchDuration(null)
  }

  const handleMatch = () => {
    const startedAt = performance.now()
    const nextMatches = companyMatcher.matchAll(sourceNames, COMPANY_DIRECTORY)
    const duration = performance.now() - startedAt
    startTransition(() => {
      setMatches(nextMatches)
      setMatchDuration(duration)
    })
  }

  const handleCreateTestData = (count: number) => {
    handleInputChange(createPerformanceCompanyNames(count).join('\n'))
  }

  const handleManualMatch = (sourceId: string, company: Company) => {
    setMatches((current) =>
      current.map((item) =>
        item.sourceId === sourceId
          ? {
              ...item,
              company,
              kind: 'manual',
              strategyLabel: '人工确认',
              confidence: 1,
            }
          : item,
      ),
    )
    setEditingSourceId(null)
  }

  return {
    rawInput,
    sourceNames,
    matches,
    matchedCount,
    unmatchedCount,
    hasResult,
    uniqueMatchedResults,
    displayedResults,
    resultIndexBySourceId,
    resultByKey,
    duplicateCount: matchedCount - uniqueMatchedResults.length,
    editingSourceId,
    setEditingSourceId,
    resultOpen,
    setResultOpen,
    matchDuration,
    keepImportOrder,
    setKeepImportOrder,
    hideUnmatchedResults,
    setHideUnmatchedResults,
    isPending,
    handleInputChange,
    handleMatch,
    handleCreateTestData,
    handleManualMatch,
  }
}
