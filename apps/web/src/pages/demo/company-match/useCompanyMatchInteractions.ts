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
import { getResultKey, getSourceIndex } from './companyMatchViewModel'

const ROW_HEIGHT = 84
const CONNECTOR_REVEAL_DELAY = 300
const HOVER_RESTORE_DELAY = 80

interface CompanyMatchInteractionsOptions {
  displayedResults: DeduplicatedCompanyMatch[]
  resultIndexBySourceId: Map<string, number>
  resultByKey: Map<string, DeduplicatedCompanyMatch>
  hasResult: boolean
  isSourceInputCollapsed: boolean
  onRenderedSourceCountChange: (count: number) => void
  onRenderedResultCountChange: (count: number) => void
}

/**
 * 管理两个虚拟列表之间的交互关系。
 *
 * 这个 hook 统一处理双向滚动、悬停恢复、DOM 节点登记和 SVG 路径测量，
 * 并通过稳定的事件处理器把这些能力交给页面。业务匹配模型无需感知 DOM。
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

  const scheduleConnectorReveal = useCallback(() => {
    if (connectorRevealTimerRef.current !== null) {
      window.clearTimeout(connectorRevealTimerRef.current)
    }
    connectorRevealTimerRef.current = window.setTimeout(() => {
      connectorRevealTimerRef.current = null
      if (activeSourceIdsRef.current.length) setIsConnectorVisible(true)
    }, CONNECTOR_REVEAL_DELAY)
  }, [])

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

  const clearHoveredSourcesForScroll = useCallback(() => {
    activeSourceIdsRef.current = []
    setActiveSourceIds((current) => current.length ? [] : current)
    hideConnectorImmediately()
  }, [hideConnectorImmediately])

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

  const scheduleConnectorUpdate = useCallback(() => {
    if (connectorFrameRef.current !== null) {
      cancelAnimationFrame(connectorFrameRef.current)
    }
    connectorFrameRef.current = requestAnimationFrame(() => {
      connectorFrameRef.current = null
      updateConnectorPaths()
    })
  }, [updateConnectorPaths])

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

  const handleSourceRenderedRangeChange = useCallback((count: number) => {
    onRenderedSourceCountChange(count)
    scheduleConnectorRefresh()
  }, [onRenderedSourceCountChange, scheduleConnectorRefresh])

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

  const restoreHoverAtPointer = useCallback(() => {
    const workspace = workspaceRef.current
    const pointerPosition = pointerPositionRef.current
    if (!workspace || !pointerPosition || !document.elementFromPoint) return

    const pointedElement = document.elementFromPoint(pointerPosition.x, pointerPosition.y)
    if (!(pointedElement instanceof Element) || !workspace.contains(pointedElement)) return

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

  const scheduleHoverRestoreAfterScroll = useCallback(() => {
    if (connectorScrollEndTimerRef.current !== null) {
      window.clearTimeout(connectorScrollEndTimerRef.current)
    }
    connectorScrollEndTimerRef.current = window.setTimeout(() => {
      connectorScrollEndTimerRef.current = null
      restoreHoverAtPointer()
    }, HOVER_RESTORE_DELAY)
  }, [restoreHoverAtPointer])

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

  const handleSourceScroll = useCallback((offset: number) => {
    const sourceIndex = Math.floor(offset / ROW_HEIGHT)
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

  const handleResultScroll = useCallback((offset: number) => {
    if (releaseSynchronizedScroll('result', offset)) return

    clearHoveredSourcesForScroll()
    scheduleHoverRestoreAfterScroll()
    const resultIndex = Math.floor(offset / ROW_HEIGHT)
    if (lastResultScrollIndexRef.current === resultIndex) return
    lastResultScrollIndexRef.current = resultIndex
    lastSourceScrollIndexRef.current = null
    const result = displayedResults[resultIndex]
    const sourceId = result ? getNearestSourceId(result) : undefined
    const sourceIndex = sourceId ? getSourceIndex(sourceId) : null
    if (sourceIndex !== null) syncListToIndex(sourceListRef, sourceIndex, 'source')
  }, [clearHoveredSourcesForScroll, displayedResults, getNearestSourceId, releaseSynchronizedScroll, scheduleHoverRestoreAfterScroll, syncListToIndex])

  const handleSourceMouseEnter = useCallback((
    sourceId: string,
    event: ReactMouseEvent<HTMLDivElement>,
  ) => {
    pointerPositionRef.current = { x: event.clientX, y: event.clientY }
    setHoveredSources([sourceId])
    const resultIndex = resultIndexBySourceId.get(sourceId)
    if (resultIndex !== undefined) syncListToIndex(resultListRef, resultIndex, 'result')
  }, [resultIndexBySourceId, setHoveredSources, syncListToIndex])

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

  const handleWorkspaceMouseMove = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    pointerPositionRef.current = { x: event.clientX, y: event.clientY }
  }, [])

  const handleWorkspaceMouseLeave = useCallback(() => {
    pointerPositionRef.current = null
    if (connectorScrollEndTimerRef.current !== null) {
      window.clearTimeout(connectorScrollEndTimerRef.current)
      connectorScrollEndTimerRef.current = null
    }
    setHoveredSources([])
  }, [setHoveredSources])

  const registerSourceItem = useCallback((sourceId: string, element: HTMLDivElement | null) => {
    if (element) sourceItemRefs.current.set(sourceId, element)
    else sourceItemRefs.current.delete(sourceId)
  }, [])

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
