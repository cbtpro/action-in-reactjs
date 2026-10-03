import { COMPANY_MATCH_TEST_NAMES } from './companyData'

/**
 * 从企业模型目录截取稳定、可重复的性能测试数据：
 * 80% 可自动命中，20% 保持未匹配，避免模型与测试样本各自维护。
 *
 * @param count - 需要生成的测试词条数量。
 * @returns 按固定比例混合可匹配和未匹配词条的测试数据。
 */
export function createPerformanceCompanyNames(count: number): string[] {
  return Array.from({ length: count }, (_, index) => {
    if (index % 5 === 4) {
      return `性能测试企业${String(index + 1).padStart(5, '0')}有限公司`
    }

    /** 扣除前面插入的未匹配项，让可匹配样本连续遍历整个模型目录。 */
    const matchableIndex = index - Math.floor(index / 5)
    return COMPANY_MATCH_TEST_NAMES[matchableIndex % COMPANY_MATCH_TEST_NAMES.length]
  })
}
