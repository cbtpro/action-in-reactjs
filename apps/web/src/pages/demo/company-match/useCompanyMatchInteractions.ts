import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import type { MouseEvent as ReactMouseEvent, RefObject } from 'react'
import type { ConnectorLayer } from './ConnectorSvgLayer'
import type { DeduplicatedCompanyMatch } from './deduplicateMatches'
import type { VirtualListHandle } from './VirtualList'
import {
  CONNECTOR_REVEAL_DELAY,
  HOVER_RESTORE_DELAY,
  VIRTUAL_ROW_HEIGHT,
} from './companyMatchConstants'
import { getResultKey, getSourceIndex } from './companyMatchViewModel'

/** 创建跨列表交互控制器所需的数据和统计回调。 */
interface CompanyMatchInteractionsOptions {
  displayedResults: DeduplicatedCompanyMatch[]
  resultIndexBySourceId: Map<string, number>
  resultByKey: Map<string, DeduplicatedCompanyMatch>
  hasResult: boolean
  isSourceInputCollapsed: boolean
  onRenderedSourceCountChange: (count: number) => void
  onRenderedResultCountChange: (count: number) => void
}

/** 当前组件中参与 hover 恢复的来源行和结果行选择器。 */
const INTERACTIVE_ITEM_SELECTOR = '[data-source-id], [data-result-key]'

/**
 * 判断视口坐标是否落在一个可见元素的边界内。
 *
 * @param element - 需要执行边界测试的元素。
 * @param x - 相对于视口左边缘的横坐标。
 * @param y - 相对于视口上边缘的纵坐标。
 * @returns 坐标位于非零尺寸元素内时返回 `true`。
 */
function containsViewportPoint(
  element: HTMLElement,
  x: number,
  y: number,
) {
  const rect = element.getBoundingClientRect()
  return rect.width > 0
    && rect.height > 0
    && x >= rect.left
    && x < rect.right
    && y >= rect.top
    && y < rect.bottom
}

/**
 * 只在当前组件实例内查找鼠标坐标对应的已挂载列表项。
 *
 * @param componentRoot - 当前批量匹配组件的根元素。
 * @param x - 相对于视口左边缘的横坐标。
 * @param y - 相对于视口上边缘的纵坐标。
 * @returns 命中的来源行或结果行；没有命中时返回 `null`。
 */
function findInteractiveItemAtPoint(
  componentRoot: HTMLElement,
  x: number,
  y: number,
) {
  const items = componentRoot.querySelectorAll<HTMLElement>(INTERACTIVE_ITEM_SELECTOR)
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items.item(index)
    if (containsViewportPoint(item, x, y)) return item
  }
  return null
}

/**
 * 管理两个虚拟列表之间的交互关系。
 *
 * 这个 hook 统一处理双向滚动、悬停恢复、DOM 节点登记和 SVG 路径测量，
 * 并通过稳定的事件处理器把这些能力交给页面。业务匹配模型无需感知 DOM。
 *
 * @param options - 当前展示结果、结果索引和虚拟列表渲染统计回调。
 * @returns 双列表组件使用的引用、状态和交互处理函数。
 */
export function useCompanyMatchInteractions({
  displayedResults,
  resultIndexBySourceId,
  resultByKey,
  hasResult,
  isSourceInputCollapsed,
  onRenderedSourceCountChange,
  onRenderedResultCountChange,
}: CompanyMatchInteractionsOptions) {
  const [activeSourceIds, setActiveSourceIds] = useState<string[]>([])
  const [isConnectorVisible, setIsConnectorVisible] = useState(false)
  const [connectorLayer, setConnectorLayer] = useState<ConnectorLayer>({
    width: 0,
    height: 0,
    paths: [],
  })

  const componentRootRef = useRef<HTMLElement>(null)
  const workspaceRef = useRef<HTMLDivElement>(null)
  const sourceListRef = useRef<VirtualListHandle>(null)
  const resultListRef = useRef<VirtualListHandle>(null)
  const sourceItemRefs = useRef(new Map<string, HTMLDivElement>())
  const resultItemRefs = useRef(new Map<string, HTMLDivElement>())
  const activeSourceIdsRef = useRef<string[]>([])
  const pointerPositionRef = useRef<{ x: number; y: number } | null>(null)
  const connectorFrameRef = useRef<number | null>(null)
  const connectorSettleTimerRef = useRef<number | null>(null)
  const connectorRevealTimerRef = useRef<number | null>(null)
  const connectorScrollEndTimerRef = useRef<number | null>(null)
  const syncingScrollTargetRef = useRef<'source' | 'result' | null>(null)
  const syncingScrollOffsetRef = useRef<number | null>(null)
  const releaseScrollSyncTimerRef = useRef<number | null>(null)
  const lastSourceScrollIndexRef = useRef<number | null>(null)
  const lastResultScrollIndexRef = useRef<number | null>(null)
  const currentSourceScrollIndexRef = useRef(0)

  useEffect(() => {
    lastSourceScrollIndexRef.current = null
    lastResultScrollIndexRef.current = null
    syncingScrollTargetRef.current = null
    syncingScrollOffsetRef.current = null
    if (releaseScrollSyncTimerRef.current !== null) {
      window.clearTimeout(releaseScrollSyncTimerRef.current)
      releaseScrollSyncTimerRef.current = null
    }
  }, [displayedResults])

  /**
   * 取消待执行的绘制任务并立即清空当前 SVG 路径。
   *
   * @returns 无返回值。
   */
  const hideConnectorImmediately = useCallback(() => {
    if (connectorRevealTimerRef.current !== null) {
      window.clearTimeout(connectorRevealTimerRef.current)
      connectorRevealTimerRef.current = null
    }
    if (connectorSettleTimerRef.current !== null) {
      window.clearTimeout(connectorSettleTimerRef.current)
      connectorSettleTimerRef.current = null
    }
    if (connectorFrameRef.current !== null) {
      cancelAnimationFrame(connectorFrameRef.current)
      connectorFrameRef.current = null
    }
    setIsConnectorVisible(false)
    setConnectorLayer((current) =>
      current.paths.length ? { ...current, paths: [] } : current,
    )
  }, [])

  /**
   * 在 hover 稳定达到指定延迟后允许显示连接线。
   *
   * @returns 无返回值。
   */
  const scheduleConnectorReveal = useCallback(() => {
    if (connectorRevealTimerRef.current !== null) {
      window.clearTimeout(connectorRevealTimerRef.current)
    }
    connectorRevealTimerRef.current = window.setTimeout(() => {
      connectorRevealTimerRef.current = null
      if (activeSourceIdsRef.current.length) setIsConnectorVisible(true)
    }, CONNECTOR_REVEAL_DELAY)
  }, [])

  /**
   * 更新当前关联的来源 ID，并重新开始连接线显示计时。
   *
   * @param sourceIds - 需要同步高亮的来源词条 ID。
   * @returns 无返回值。
   */
  const setHoveredSources = useCallback((sourceIds: string[]) => {
    if (sourceIds.length && connectorScrollEndTimerRef.current !== null) {
      window.clearTimeout(connectorScrollEndTimerRef.current)
      connectorScrollEndTimerRef.current = null
    }
    activeSourceIdsRef.current = sourceIds
    setActiveSourceIds(sourceIds)
    hideConnectorImmediately()
    if (sourceIds.length) scheduleConnectorReveal()
  }, [hideConnectorImmediately, scheduleConnectorReveal])

  /**
   * 滚动开始时清除 hover 状态并隐藏连接线。
   *
   * @returns 无返回值。
   */
  const clearHoveredSourcesForScroll = useCallback(() => {
    activeSourceIdsRef.current = []
    setActiveSourceIds((current) => current.length ? [] : current)
    hideConnectorImmediately()
  }, [hideConnectorImmediately])

  /**
   * 测量当前已挂载的关联行并更新 SVG 贝塞尔路径。
   *
   * @returns 无返回值。
   */
  const updateConnectorPaths = useCallback(() => {
    const workspace = workspaceRef.current
    if (!workspace || !activeSourceIds.length || !isConnectorVisible) {
      setConnectorLayer((current) =>
        current.paths.length ? { ...current, paths: [] } : current,
      )
      return
    }

    const activeResultIndex = activeSourceIds.reduce<number | undefined>(
      (foundIndex, sourceId) => foundIndex ?? resultIndexBySourceId.get(sourceId),
      undefined,
    )
    const activeResult = activeResultIndex === undefined
      ? undefined
      : displayedResults[activeResultIndex]
    const resultElement = activeResult
      ? resultItemRefs.current.get(getResultKey(activeResult))
      : undefined
    if (!resultElement) {
      setConnectorLayer((current) =>
        current.paths.length ? { ...current, paths: [] } : current,
      )
      return
    }

    const workspaceRect = workspace.getBoundingClientRect()
    const resultRect = resultElement.getBoundingClientRect()
    const endX = resultRect.left - workspaceRect.left
    const endY = resultRect.top + resultRect.height / 2 - workspaceRect.top
    const paths = activeSourceIds.flatMap((sourceId) => {
      const sourceElement = sourceItemRefs.current.get(sourceId)
      if (!sourceElement) return []

      const sourceRect = sourceElement.getBoundingClientRect()
      const startX = sourceRect.right - workspaceRect.left
      const startY = sourceRect.top + sourceRect.height / 2 - workspaceRect.top
      const controlOffset = Math.max(30, (endX - startX) * 0.42)
      return [{
        id: sourceId,
        d: `M ${startX} ${startY} C ${startX + controlOffset} ${startY}, ${endX - controlOffset} ${endY}, ${endX} ${endY}`,
      }]
    })

    if (!paths.length) {
      setConnectorLayer((current) =>
        current.paths.length ? { ...current, paths: [] } : current,
      )
      return
    }
    setConnectorLayer({
      width: workspaceRect.width,
      height: workspaceRect.height,
      paths,
    })
  }, [activeSourceIds, displayedResults, isConnectorVisible, resultIndexBySourceId])

  /**
   * 在下一动画帧执行一次连接线路径测量。
   *
   * @returns 无返回值。
   */
  const scheduleConnectorUpdate = useCallback(() => {
    if (connectorFrameRef.current !== null) {
      cancelAnimationFrame(connectorFrameRef.current)
    }
    connectorFrameRef.current = requestAnimationFrame(() => {
      connectorFrameRef.current = null
      updateConnectorPaths()
    })
  }, [updateConnectorPaths])

  /**
   * 安排即时和布局稳定后的两次连接线测量。
   *
   * @returns 无返回值。
   */
  const scheduleConnectorRefresh = useCallback(() => {
    scheduleConnectorUpdate()
    if (connectorSettleTimerRef.current !== null) {
      window.clearTimeout(connectorSettleTimerRef.current)
    }
    connectorSettleTimerRef.current = window.setTimeout(() => {
      connectorSettleTimerRef.current = null
      scheduleConnectorUpdate()
    }, 120)
  }, [scheduleConnectorUpdate])

  /**
   * 记录来源列表渲染数量，并在虚拟窗口变化后刷新连接线。
   *
   * @param count - 来源虚拟列表当前挂载的行数。
   * @returns 无返回值。
   */
  const handleSourceRenderedRangeChange = useCallback((count: number) => {
    onRenderedSourceCountChange(count)
    scheduleConnectorRefresh()
  }, [onRenderedSourceCountChange, scheduleConnectorRefresh])

  /**
   * 记录结果列表渲染数量，并在虚拟窗口变化后刷新连接线。
   *
   * @param count - 结果虚拟列表当前挂载的行数。
   * @returns 无返回值。
   */
  const handleResultRenderedRangeChange = useCallback((count: number) => {
    onRenderedResultCountChange(count)
    scheduleConnectorRefresh()
  }, [onRenderedResultCountChange, scheduleConnectorRefresh])

  useLayoutEffect(() => {
    scheduleConnectorRefresh()
  }, [displayedResults, isSourceInputCollapsed, scheduleConnectorRefresh])

  useEffect(() => {
    const workspace = workspaceRef.current
    if (!workspace || typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver(scheduleConnectorRefresh)
    const sourceListPane = workspace.querySelector('.company-source-list-pane')
    const resultList = workspace.querySelector('.company-result-list')
    const observedElements = [workspace, sourceListPane, resultList]
    observedElements.forEach((element) => {
      if (element) observer.observe(element)
    })

    const sourceLayout = workspace.querySelector('.company-source-layout')
    sourceLayout?.addEventListener('transitionend', scheduleConnectorRefresh)
    return () => {
      observer.disconnect()
      sourceLayout?.removeEventListener('transitionend', scheduleConnectorRefresh)
    }
  }, [hasResult, isSourceInputCollapsed, scheduleConnectorRefresh])

  /**
   * 滚动目标虚拟列表并登记同步锁，避免两侧滚动相互回传。
   *
   * @param targetRef - 目标虚拟列表的操作引用。
   * @param index - 需要滚动到的目标行索引。
   * @param target - 目标列表的方向标识。
   * @returns 无返回值。
   */
  const syncListToIndex = useCallback((
    targetRef: RefObject<VirtualListHandle | null>,
    index: number,
    target: 'source' | 'result',
  ) => {
    syncingScrollTargetRef.current = target
    syncingScrollOffsetRef.current = targetRef.current?.scrollToIndex(index) ?? null
    if (releaseScrollSyncTimerRef.current !== null) {
      window.clearTimeout(releaseScrollSyncTimerRef.current)
    }
    releaseScrollSyncTimerRef.current = window.setTimeout(() => {
      if (syncingScrollTargetRef.current === target) {
        syncingScrollTargetRef.current = null
        syncingScrollOffsetRef.current = null
      }
      releaseScrollSyncTimerRef.current = null
      if (activeSourceIdsRef.current.length) scheduleConnectorRefresh()
    }, 250)
  }, [scheduleConnectorRefresh])

  /**
   * 从去重结果的来源中选择距离左侧当前视口最近的一项。
   *
   * @param result - 可能包含多个来源 ID 的去重结果。
   * @returns 最接近当前左侧滚动位置的来源 ID；没有有效来源时返回 `undefined`。
   */
  const getNearestSourceId = useCallback((result: DeduplicatedCompanyMatch) => {
    const currentSourceIndex = currentSourceScrollIndexRef.current
    return result.sourceIds.reduce<string | undefined>((nearestId, sourceId) => {
      const sourceIndex = getSourceIndex(sourceId)
      if (sourceIndex === null) return nearestId
      if (!nearestId) return sourceId

      const nearestIndex = getSourceIndex(nearestId)
      return nearestIndex === null
        || Math.abs(sourceIndex - currentSourceIndex) < Math.abs(nearestIndex - currentSourceIndex)
        ? sourceId
        : nearestId
    }, undefined)
  }, [])

  /**
   * 在当前组件根节点内重新识别鼠标下方的词条并恢复关联状态。
   *
   * @returns 无返回值。
   */
  const restoreHoverAtPointer = useCallback(() => {
    const componentRoot = componentRootRef.current
    const pointerPosition = pointerPositionRef.current
    if (!componentRoot || !pointerPosition) return

    const pointedElement = findInteractiveItemAtPoint(
      componentRoot,
      pointerPosition.x,
      pointerPosition.y,
    )
    if (!pointedElement) return

    const sourceElement = pointedElement.closest<HTMLElement>('[data-source-id]')
    const sourceId = sourceElement?.dataset.sourceId
    if (sourceId) {
      setHoveredSources([sourceId])
      const resultIndex = resultIndexBySourceId.get(sourceId)
      if (resultIndex !== undefined) syncListToIndex(resultListRef, resultIndex, 'result')
      return
    }

    const resultElement = pointedElement.closest<HTMLElement>('[data-result-key]')
    const result = resultElement?.dataset.resultKey
      ? resultByKey.get(resultElement.dataset.resultKey)
      : undefined
    if (!result) return

    setHoveredSources(result.sourceIds)
    const nearestSourceId = getNearestSourceId(result)
    const sourceIndex = nearestSourceId ? getSourceIndex(nearestSourceId) : null
    if (sourceIndex !== null) syncListToIndex(sourceListRef, sourceIndex, 'source')
  }, [getNearestSourceId, resultByKey, resultIndexBySourceId, setHoveredSources, syncListToIndex])

  /**
   * 在滚动停止达到指定延迟后恢复鼠标位置对应的 hover。
   *
   * @returns 无返回值。
   */
  const scheduleHoverRestoreAfterScroll = useCallback(() => {
    if (connectorScrollEndTimerRef.current !== null) {
      window.clearTimeout(connectorScrollEndTimerRef.current)
    }
    connectorScrollEndTimerRef.current = window.setTimeout(() => {
      connectorScrollEndTimerRef.current = null
      restoreHoverAtPointer()
    }, HOVER_RESTORE_DELAY)
  }, [restoreHoverAtPointer])

  /**
   * 判断当前滚动是否由另一侧同步触发，并在命中时释放同步锁。
   *
   * @param target - 发生滚动的列表方向。
   * @param offset - 列表报告的实际滚动偏移。
   * @returns 本次滚动属于预期同步滚动时返回 `true`。
   */
  const releaseSynchronizedScroll = useCallback((target: 'source' | 'result', offset: number) => {
    if (syncingScrollTargetRef.current !== target) return false
    const expectedOffset = syncingScrollOffsetRef.current
    syncingScrollTargetRef.current = null
    syncingScrollOffsetRef.current = null
    if (releaseScrollSyncTimerRef.current !== null) {
      window.clearTimeout(releaseScrollSyncTimerRef.current)
      releaseScrollSyncTimerRef.current = null
    }
    if (expectedOffset === null || Math.abs(offset - expectedOffset) < 1) {
      scheduleConnectorRefresh()
      return true
    }
    return false
  }, [scheduleConnectorRefresh])

  /**
   * 处理来源列表滚动，并同步结果列表到对应结果。
   *
   * @param offset - 来源列表当前滚动偏移。
   * @returns 无返回值。
   */
  const handleSourceScroll = useCallback((offset: number) => {
    const sourceIndex = Math.floor(offset / VIRTUAL_ROW_HEIGHT)
    currentSourceScrollIndexRef.current = sourceIndex
    if (releaseSynchronizedScroll('source', offset)) return

    clearHoveredSourcesForScroll()
    scheduleHoverRestoreAfterScroll()
    if (lastSourceScrollIndexRef.current === sourceIndex) return
    lastSourceScrollIndexRef.current = sourceIndex
    lastResultScrollIndexRef.current = null
    const resultIndex = resultIndexBySourceId.get(`source-${sourceIndex}`)
    if (resultIndex !== undefined) syncListToIndex(resultListRef, resultIndex, 'result')
  }, [clearHoveredSourcesForScroll, releaseSynchronizedScroll, resultIndexBySourceId, scheduleHoverRestoreAfterScroll, syncListToIndex])

  /**
   * 处理结果列表滚动，并同步来源列表到最近关联词条。
   *
   * @param offset - 结果列表当前滚动偏移。
   * @returns 无返回值。
   */
  const handleResultScroll = useCallback((offset: number) => {
    if (releaseSynchronizedScroll('result', offset)) return

    clearHoveredSourcesForScroll()
    scheduleHoverRestoreAfterScroll()
    const resultIndex = Math.floor(offset / VIRTUAL_ROW_HEIGHT)
    if (lastResultScrollIndexRef.current === resultIndex) return
    lastResultScrollIndexRef.current = resultIndex
    lastSourceScrollIndexRef.current = null
    const result = displayedResults[resultIndex]
    const sourceId = result ? getNearestSourceId(result) : undefined
    const sourceIndex = sourceId ? getSourceIndex(sourceId) : null
    if (sourceIndex !== null) syncListToIndex(sourceListRef, sourceIndex, 'source')
  }, [clearHoveredSourcesForScroll, displayedResults, getNearestSourceId, releaseSynchronizedScroll, scheduleHoverRestoreAfterScroll, syncListToIndex])

  /**
   * 激活来源词条并将结果列表滚动到对应结果。
   *
   * @param sourceId - 鼠标进入的来源词条 ID。
   * @param event - 用于记录当前视口坐标的鼠标事件。
   * @returns 无返回值。
   */
  const handleSourceMouseEnter = useCallback((
    sourceId: string,
    event: ReactMouseEvent<HTMLDivElement>,
  ) => {
    pointerPositionRef.current = { x: event.clientX, y: event.clientY }
    setHoveredSources([sourceId])
    const resultIndex = resultIndexBySourceId.get(sourceId)
    if (resultIndex !== undefined) syncListToIndex(resultListRef, resultIndex, 'result')
  }, [resultIndexBySourceId, setHoveredSources, syncListToIndex])

  /**
   * 激活结果关联的全部来源，并滚动到最近的来源词条。
   *
   * @param result - 鼠标进入的去重结果。
   * @param event - 用于记录当前视口坐标的鼠标事件。
   * @returns 无返回值。
   */
  const handleResultMouseEnter = useCallback((
    result: DeduplicatedCompanyMatch,
    event: ReactMouseEvent<HTMLDivElement>,
  ) => {
    pointerPositionRef.current = { x: event.clientX, y: event.clientY }
    setHoveredSources(result.sourceIds)
    const sourceId = getNearestSourceId(result)
    const sourceIndex = sourceId ? getSourceIndex(sourceId) : null
    if (sourceIndex !== null) syncListToIndex(sourceListRef, sourceIndex, 'source')
  }, [getNearestSourceId, setHoveredSources, syncListToIndex])

  /**
   * 持续记录鼠标在工作区内的最新视口坐标。
   *
   * @param event - 工作区触发的鼠标移动事件。
   * @returns 无返回值。
   */
  const handleWorkspaceMouseMove = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    pointerPositionRef.current = { x: event.clientX, y: event.clientY }
  }, [])

  /**
   * 清理离开工作区后的鼠标坐标、恢复任务和关联状态。
   *
   * @returns 无返回值。
   */
  const handleWorkspaceMouseLeave = useCallback(() => {
    pointerPositionRef.current = null
    if (connectorScrollEndTimerRef.current !== null) {
      window.clearTimeout(connectorScrollEndTimerRef.current)
      connectorScrollEndTimerRef.current = null
    }
    setHoveredSources([])
  }, [setHoveredSources])

  /**
   * 登记或移除当前已挂载的来源行元素。
   *
   * @param sourceId - 来源词条 ID。
   * @param element - 已挂载元素；传入 `null` 表示卸载。
   * @returns 无返回值。
   */
  const registerSourceItem = useCallback((sourceId: string, element: HTMLDivElement | null) => {
    if (element) sourceItemRefs.current.set(sourceId, element)
    else sourceItemRefs.current.delete(sourceId)
  }, [])

  /**
   * 按稳定结果键登记或移除当前已挂载的结果行元素。
   *
   * @param result - 结果行对应的去重匹配结果。
   * @param element - 已挂载元素；传入 `null` 表示卸载。
   * @returns 无返回值。
   */
  const registerResultItem = useCallback((result: DeduplicatedCompanyMatch, element: HTMLDivElement | null) => {
    const resultKey = getResultKey(result)
    if (element) resultItemRefs.current.set(resultKey, element)
    else resultItemRefs.current.delete(resultKey)
  }, [])

  useEffect(() => () => {
    if (releaseScrollSyncTimerRef.current !== null) window.clearTimeout(releaseScrollSyncTimerRef.current)
    if (connectorSettleTimerRef.current !== null) window.clearTimeout(connectorSettleTimerRef.current)
    if (connectorRevealTimerRef.current !== null) window.clearTimeout(connectorRevealTimerRef.current)
    if (connectorScrollEndTimerRef.current !== null) window.clearTimeout(connectorScrollEndTimerRef.current)
    if (connectorFrameRef.current !== null) cancelAnimationFrame(connectorFrameRef.current)
    sourceItemRefs.current.clear()
    resultItemRefs.current.clear()
  }, [])

  return {
    componentRootRef,
    workspaceRef,
    sourceListRef,
    resultListRef,
    activeSourceIds,
    connectorLayer,
    setHoveredSources,
    handleWorkspaceMouseMove,
    handleWorkspaceMouseLeave,
    handleSourceRenderedRangeChange,
    handleResultRenderedRangeChange,
    handleSourceScroll,
    handleResultScroll,
    handleSourceMouseEnter,
    handleResultMouseEnter,
    registerSourceItem,
    registerResultItem,
  }
}

export type CompanyMatchInteractions = ReturnType<typeof useCompanyMatchInteractions>
