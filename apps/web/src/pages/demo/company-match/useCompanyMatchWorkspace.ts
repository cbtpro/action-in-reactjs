import { useCallback, useState } from 'react'
import type { CompanyMatchModel } from './useCompanyMatchModel'
import { useCompanyMatchInteractions } from './useCompanyMatchInteractions'

/**
 * 工作区视图状态与跨列表交互的组合入口。
 *
 * 页面只需要读取最终渲染行数；输入面板折叠、两侧实际渲染数量以及
 * hover/滚动/连线交互都由工作区内部维护。
 *
 * @param model - 批量匹配页面的数据模型。
 * @returns 工作区视图状态、折叠操作、渲染统计和交互控制器。
 */
export function useCompanyMatchWorkspace(model: CompanyMatchModel) {
  const [renderedSourceCount, setRenderedSourceCount] = useState(0)
  const [renderedResultCount, setRenderedResultCount] = useState(0)
  const [isSourceInputCollapsed, setIsSourceInputCollapsed] = useState(false)
  /**
   * 切换原始输入面板的折叠状态。
   *
   * @returns 无返回值。
   */
  const toggleSourceInput = useCallback(() => {
    setIsSourceInputCollapsed((collapsed) => !collapsed)
  }, [])

  const interactions = useCompanyMatchInteractions({
    displayedResults: model.displayedResults,
    resultIndexBySourceId: model.resultIndexBySourceId,
    resultByKey: model.resultByKey,
    hasResult: model.hasResult,
    isSourceInputCollapsed,
    onRenderedSourceCountChange: setRenderedSourceCount,
    onRenderedResultCountChange: setRenderedResultCount,
  })

  return {
    interactions,
    isSourceInputCollapsed,
    toggleSourceInput,
    renderedRowCount: Math.max(renderedSourceCount, renderedResultCount),
  }
}

export type CompanyMatchWorkspaceState = ReturnType<typeof useCompanyMatchWorkspace>
