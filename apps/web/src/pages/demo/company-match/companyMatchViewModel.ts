import type { DeduplicatedCompanyMatch } from './deduplicateMatches'

/**
 * 按换行符、逗号或分号拆分并清理原始企业名单。
 *
 * @param value - 用户粘贴或输入的企业名单文本。
 * @returns 已去除空白项的来源词条列表。
 */
export const parseCompanyNames = (value: string) =>
  value
    .split(/[\n,，;；]+/)
    .map((item) => item.trim())
    .filter(Boolean)

/**
 * 获取去重结果在 React 列表和 DOM 登记表中共用的稳定键。
 *
 * @param result - 去重后的匹配结果。
 * @returns 已匹配企业 ID；未匹配时返回来源词条 ID。
 */
export const getResultKey = (result: DeduplicatedCompanyMatch) =>
  result.company?.id ?? result.sourceId

/**
 * 从标准来源 ID 中解析原始输入索引。
 *
 * @param sourceId - 格式为 `source-{index}` 的来源 ID。
 * @returns 解析后的零基索引；格式不合法时返回 `null`。
 */
export const getSourceIndex = (sourceId: string) => {
  const match = /^source-(\d+)$/.exec(sourceId)
  return match ? Number(match[1]) : null
}
