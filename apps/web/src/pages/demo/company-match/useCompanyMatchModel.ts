import { useMemo, useState, useTransition } from 'react'
import { COMPANY_DIRECTORY, MODEL_MATCH_TEST_NAMES } from './companyData'
import { createPerformanceCompanyNames } from './performanceData'
import { companyMatcher } from './matcher'
import { deduplicateCompanyMatches } from './deduplicateMatches'
import type { Company, CompanyMatch } from './types'
import { getResultKey, parseCompanyNames } from './companyMatchViewModel'

/** Demo 初次加载时展示的可匹配样本和一条未匹配样本。 */
const DEFAULT_INPUT = [
  ...MODEL_MATCH_TEST_NAMES.slice(0, 10),
  '北京未来星科技有限公司',
].join('\n')

/**
 * 批量匹配页面的数据模型。
 *
 * 输入解析、匹配执行、人工纠错、去重、排序和过滤都收敛在这里；页面组件
 * 只消费已经派生好的视图数据，不需要了解这些状态之间的更新顺序。
 *
 * @returns 页面渲染所需的模型状态、派生结果和业务操作。
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

    /*
     * 默认让待处理项置顶，人工确认后会自动回到已匹配结果区域。
     */
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

  /**
   * 更新原始输入并清空依赖旧输入产生的匹配状态。
   *
   * @param value - 新的原始企业名单文本。
   * @returns 无返回值。
   */
  const handleInputChange = (value: string) => {
    setRawInput(value)
    setMatches([])
    setEditingSourceId(null)
    setMatchDuration(null)
  }

  /**
   * 执行当前全部输入的匹配并记录计算耗时。
   *
   * @returns 无返回值。
   */
  const handleMatch = () => {
    const startedAt = performance.now()
    const nextMatches = companyMatcher.matchAll(sourceNames, COMPANY_DIRECTORY)
    const duration = performance.now() - startedAt
    startTransition(() => {
      setMatches(nextMatches)
      setMatchDuration(duration)
    })
  }

  /**
   * 生成指定规模的性能测试输入并替换当前原始名单。
   *
   * @param count - 需要生成的输入条数。
   * @returns 无返回值。
   */
  const handleCreateTestData = (count: number) => {
    handleInputChange(createPerformanceCompanyNames(count).join('\n'))
  }

  /**
   * 将指定来源更新为人工选中的标准企业。
   *
   * @param sourceId - 需要修改的来源词条 ID。
   * @param company - 人工确认的标准企业。
   * @returns 无返回值。
   */
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

export type CompanyMatchModel = ReturnType<typeof useCompanyMatchModel>
