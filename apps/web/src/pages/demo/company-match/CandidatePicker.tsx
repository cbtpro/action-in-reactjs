import { useMemo, useState } from 'react'
import { Empty, Input } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { COMPANY_DIRECTORY } from './companyData'
import type { Company } from './types'

export interface CandidatePickerProps {
  sourceName: string
  onSelect: (company: Company) => void
}

/**
 * 未匹配词条的人工纠错面板：按名称、简称或地区搜索企业目录，供用户手动选定。
 */
export function CandidatePicker({ sourceName, onSelect }: CandidatePickerProps) {
  const [keyword, setKeyword] = useState('')
  const candidates = useMemo(() => {
    const normalized = keyword.trim().toLocaleLowerCase()
    if (!normalized) return COMPANY_DIRECTORY
    return COMPANY_DIRECTORY.filter((company) =>
      [company.name, ...company.aliases, company.region]
        .join(' ')
        .toLocaleLowerCase()
        .includes(normalized),
    )
  }, [keyword])

  return (
    <div className="company-picker">
      <div className="company-picker__title">为“{sourceName}”选择企业</div>
      <Input
        autoFocus
        allowClear
        prefix={<SearchOutlined />}
        placeholder="搜索企业名称、简称或地区"
        value={keyword}
        onChange={(event) => setKeyword(event.target.value)}
      />
      <div className="company-picker__list">
        {candidates.length ? candidates.map((company) => (
          <button
            key={company.id}
            type="button"
            className="company-picker__option"
            onClick={() => onSelect(company)}
          >
            <span className="company-picker__option-name">{company.name}</span>
            <span>{company.region} · {company.industry}</span>
          </button>
        )) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有候选企业" />
        )}
      </div>
    </div>
  )
}
