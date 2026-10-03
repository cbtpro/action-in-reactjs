import { describe, expect, it } from 'vitest'
import { COMPANY_DIRECTORY } from './companyData'
import { companyMatcher, creditCodeStrategy } from './matcher'

describe('统一社会信用代码匹配', () => {
  it('按完整信用代码匹配企业', () => {
    const result = companyMatcher.matchOne(
      '91440300708461136T',
      COMPANY_DIRECTORY,
    )

    expect(result).toMatchObject({
      company: { id: 'tencent' },
      kind: 'credit-code',
      strategyLabel: '统一社会信用代码',
      confidence: 1,
    })
  })

  it('忽略信用代码中的大小写、空格和连接符', () => {
    const candidate = creditCodeStrategy.match(
      '9144 0300-7084 6113 6t',
      COMPANY_DIRECTORY,
    )

    expect(candidate?.company.id).toBe('tencent')
    expect(candidate?.confidence).toBe(1)
  })

  it.each([
    '待补充',
    '91440300708461136',
    '91440300708461136I',
    '000000000000000000',
  ])('不把无效或不存在的代码 %s 误匹配到企业', (creditCode) => {
    const result = companyMatcher.matchOne(creditCode, COMPANY_DIRECTORY)

    expect(result.company).toBeNull()
    expect(result.kind).toBe('unmatched')
  })
})
