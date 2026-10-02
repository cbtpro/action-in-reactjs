import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react'
import type { RefObject } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Drawer,
  Empty,
  Input,
  Popover,
  Progress,
  Space,
  Steps,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table/interface'
import {
  ArrowRightOutlined,
  CheckCircleFilled,
  EditOutlined,
  FileSearchOutlined,
  SearchOutlined,
  ExperimentOutlined,
  LeftOutlined,
  RightOutlined,
  WarningFilled,
} from '@ant-design/icons'
import { COMPANY_DIRECTORY, MODEL_MATCH_TEST_NAMES } from './companyData'
import { companyMatcher } from './matcher'
import type { Company, CompanyMatch } from './types'
import { VirtualList } from './VirtualList'
import type { VirtualListHandle } from './VirtualList'
import { createPerformanceCompanyNames } from './performanceData'
import { deduplicateCompanyMatches } from './deduplicateMatches'
import type { DeduplicatedCompanyMatch } from './deduplicateMatches'
import './company-match.css'

const { Text, Title } = Typography
const VIRTUAL_LIST_HEIGHT = 460
const VIRTUAL_ROW_HEIGHT = 84
const DEFAULT_INPUT = [
  ...MODEL_MATCH_TEST_NAMES.slice(0, 10),
  '北京未来星科技有限公司',
].join('\n')

const parseCompanyNames = (value: string) =>
  value
    .split(/[\n,，;；]+/)
    .map((item) => item.trim())
    .filter(Boolean)

const MATCH_KIND_LABEL: Record<CompanyMatch['kind'], string> = {
  exact: '全称命中',
  alias: '简称命中',
  normalized: '智能命中',
  manual: '人工匹配',
  unmatched: '未匹配',
}

interface CandidatePickerProps {
  sourceName: string
  onSelect: (company: Company) => void
}

interface ConnectorPath {
  id: string
  d: string
}

interface ConnectorLayer {
  width: number
  height: number
  paths: ConnectorPath[]
}

const getResultKey = (result: DeduplicatedCompanyMatch) =>
  result.company?.id ?? result.sourceId

const getSourceIndex = (sourceId: string) => {
  const match = /^source-(\d+)$/.exec(sourceId)
  return match ? Number(match[1]) : null
}

function CandidatePicker({ sourceName, onSelect }: CandidatePickerProps) {
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

export default function CompanyMatchDemoPage() {
  const [rawInput, setRawInput] = useState(DEFAULT_INPUT)
  const [matches, setMatches] = useState<CompanyMatch[]>([])
  const [activeSourceIds, setActiveSourceIds] = useState<string[]>([])
  const [editingSourceId, setEditingSourceId] = useState<string | null>(null)
  const [resultOpen, setResultOpen] = useState(false)
  const [matchDuration, setMatchDuration] = useState<number | null>(null)
  const [renderedSourceCount, setRenderedSourceCount] = useState(0)
  const [renderedResultCount, setRenderedResultCount] = useState(0)
  const [keepImportOrder, setKeepImportOrder] = useState(false)
  const [hideUnmatchedResults, setHideUnmatchedResults] = useState(false)
  const [isSourceInputCollapsed, setIsSourceInputCollapsed] = useState(false)
  const [isConnectorVisible, setIsConnectorVisible] = useState(false)
  const [connectorLayer, setConnectorLayer] = useState<ConnectorLayer>({
    width: 0,
    height: 0,
    paths: [],
  })
  const [isPending, startTransition] = useTransition()
  const workspaceRef = useRef<HTMLDivElement>(null)
  const connectorFrameRef = useRef<number | null>(null)
  const connectorSettleTimerRef = useRef<number | null>(null)
  const connectorRevealTimerRef = useRef<number | null>(null)
  const connectorScrollEndTimerRef = useRef<number | null>(null)
  const activeSourceIdsRef = useRef<string[]>([])
  const pointerPositionRef = useRef<{ x: number; y: number } | null>(null)
  const sourceItemRefs = useRef(new Map<string, HTMLDivElement>())
  const resultItemRefs = useRef(new Map<string, HTMLDivElement>())
  const sourceListRef = useRef<VirtualListHandle>(null)
  const resultListRef = useRef<VirtualListHandle>(null)
  const syncingScrollTargetRef = useRef<'source' | 'result' | null>(null)
  const syncingScrollOffsetRef = useRef<number | null>(null)
  const releaseScrollSyncTimerRef = useRef<number | null>(null)
  const lastSourceScrollIndexRef = useRef<number | null>(null)
  const lastResultScrollIndexRef = useRef<number | null>(null)
  const currentSourceScrollIndexRef = useRef(0)
  const sourceNames = useMemo(() => parseCompanyNames(rawInput), [rawInput])
  const matchedCount = matches.filter((item) => item.company).length
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
  const resultByKey = useMemo(() => new Map(
    displayedResults.map((result) => [getResultKey(result), result]),
  ), [displayedResults])
  const duplicateCount = matchedCount - uniqueMatchedResults.length

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
      if (activeSourceIdsRef.current.length) {
        setIsConnectorVisible(true)
      }
    }, 300)
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
    if (activeResultIndex === undefined) {
      setConnectorLayer((current) =>
        current.paths.length ? { ...current, paths: [] } : current,
      )
      return
    }

    const workspaceRect = workspace.getBoundingClientRect()
    const activeResult = displayedResults[activeResultIndex]
    const resultElement = activeResult
      ? resultItemRefs.current.get(getResultKey(activeResult))
      : undefined
    if (!resultElement) {
      setConnectorLayer((current) =>
        current.paths.length ? { ...current, paths: [] } : current,
      )
      return
    }

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
    setRenderedSourceCount(count)
    scheduleConnectorRefresh()
  }, [scheduleConnectorRefresh])

  const handleResultRenderedRangeChange = useCallback((count: number) => {
    setRenderedResultCount(count)
    scheduleConnectorRefresh()
  }, [scheduleConnectorRefresh])

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
    // scroll 事件可能晚于当前动画帧到达；短暂屏蔽目标列表的回传事件，
    // 避免两侧互相把对方拉回行首而产生抖动。
    releaseScrollSyncTimerRef.current = window.setTimeout(() => {
      if (syncingScrollTargetRef.current === target) {
        syncingScrollTargetRef.current = null
        syncingScrollOffsetRef.current = null
      }
      releaseScrollSyncTimerRef.current = null
      if (activeSourceIdsRef.current.length) {
        scheduleConnectorRefresh()
      }
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

    const pointedElement = document.elementFromPoint(
      pointerPosition.x,
      pointerPosition.y,
    )
    if (!(pointedElement instanceof Element) || !workspace.contains(pointedElement)) {
      return
    }

    const sourceElement = pointedElement.closest<HTMLElement>('[data-source-id]')
    const sourceId = sourceElement?.dataset.sourceId
    if (sourceId) {
      const resultIndex = resultIndexBySourceId.get(sourceId)
      setHoveredSources([sourceId])
      if (resultIndex !== undefined) {
        syncListToIndex(resultListRef, resultIndex, 'result')
      }
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
    if (sourceIndex !== null) {
      syncListToIndex(sourceListRef, sourceIndex, 'source')
    }
  }, [getNearestSourceId, resultByKey, resultIndexBySourceId, setHoveredSources, syncListToIndex])

  const scheduleHoverRestoreAfterScroll = useCallback(() => {
    if (connectorScrollEndTimerRef.current !== null) {
      window.clearTimeout(connectorScrollEndTimerRef.current)
    }
    connectorScrollEndTimerRef.current = window.setTimeout(() => {
      connectorScrollEndTimerRef.current = null
      restoreHoverAtPointer()
    }, 80)
  }, [restoreHoverAtPointer])

  const handleSourceScroll = useCallback((offset: number) => {
    const sourceIndex = Math.floor(offset / VIRTUAL_ROW_HEIGHT)
    currentSourceScrollIndexRef.current = sourceIndex
    if (syncingScrollTargetRef.current === 'source') {
      const expectedOffset = syncingScrollOffsetRef.current
      if (expectedOffset === null || Math.abs(offset - expectedOffset) < 1) {
        syncingScrollTargetRef.current = null
        syncingScrollOffsetRef.current = null
        if (releaseScrollSyncTimerRef.current !== null) {
          window.clearTimeout(releaseScrollSyncTimerRef.current)
          releaseScrollSyncTimerRef.current = null
        }
        scheduleConnectorRefresh()
        return
      }

      syncingScrollTargetRef.current = null
      syncingScrollOffsetRef.current = null
      if (releaseScrollSyncTimerRef.current !== null) {
        window.clearTimeout(releaseScrollSyncTimerRef.current)
        releaseScrollSyncTimerRef.current = null
      }
    }

    clearHoveredSourcesForScroll()
    scheduleHoverRestoreAfterScroll()
    if (lastSourceScrollIndexRef.current === sourceIndex) return
    lastSourceScrollIndexRef.current = sourceIndex
    lastResultScrollIndexRef.current = null
    const resultIndex = resultIndexBySourceId.get(`source-${sourceIndex}`)
    if (resultIndex !== undefined) {
      syncListToIndex(resultListRef, resultIndex, 'result')
    }
  }, [clearHoveredSourcesForScroll, resultIndexBySourceId, scheduleConnectorRefresh, scheduleHoverRestoreAfterScroll, syncListToIndex])

  const handleResultScroll = useCallback((offset: number) => {
    if (syncingScrollTargetRef.current === 'result') {
      const expectedOffset = syncingScrollOffsetRef.current
      if (expectedOffset === null || Math.abs(offset - expectedOffset) < 1) {
        syncingScrollTargetRef.current = null
        syncingScrollOffsetRef.current = null
        if (releaseScrollSyncTimerRef.current !== null) {
          window.clearTimeout(releaseScrollSyncTimerRef.current)
          releaseScrollSyncTimerRef.current = null
        }
        scheduleConnectorRefresh()
        return
      }

      syncingScrollTargetRef.current = null
      syncingScrollOffsetRef.current = null
      if (releaseScrollSyncTimerRef.current !== null) {
        window.clearTimeout(releaseScrollSyncTimerRef.current)
        releaseScrollSyncTimerRef.current = null
      }
    }

    clearHoveredSourcesForScroll()
    scheduleHoverRestoreAfterScroll()
    const resultIndex = Math.floor(offset / VIRTUAL_ROW_HEIGHT)
    if (lastResultScrollIndexRef.current === resultIndex) return
    lastResultScrollIndexRef.current = resultIndex
    lastSourceScrollIndexRef.current = null
    const result = displayedResults[resultIndex]
    const sourceId = result ? getNearestSourceId(result) : undefined
    if (!sourceId) return

    const sourceIndex = getSourceIndex(sourceId)
    if (sourceIndex !== null) syncListToIndex(sourceListRef, sourceIndex, 'source')
  }, [clearHoveredSourcesForScroll, displayedResults, getNearestSourceId, scheduleConnectorRefresh, scheduleHoverRestoreAfterScroll, syncListToIndex])

  const handleSourceMouseEnter = useCallback((sourceId: string) => {
    setHoveredSources([sourceId])
    const resultIndex = resultIndexBySourceId.get(sourceId)
    if (resultIndex !== undefined) {
      syncListToIndex(resultListRef, resultIndex, 'result')
    }
  }, [resultIndexBySourceId, setHoveredSources, syncListToIndex])

  const handleResultMouseEnter = useCallback((
    result: DeduplicatedCompanyMatch,
  ) => {
    setHoveredSources(result.sourceIds)
    const sourceId = getNearestSourceId(result)
    const sourceIndex = sourceId ? getSourceIndex(sourceId) : null
    if (sourceIndex !== null) syncListToIndex(sourceListRef, sourceIndex, 'source')
  }, [getNearestSourceId, setHoveredSources, syncListToIndex])

  useEffect(() => () => {
    if (releaseScrollSyncTimerRef.current !== null) {
      window.clearTimeout(releaseScrollSyncTimerRef.current)
    }
    if (connectorSettleTimerRef.current !== null) {
      window.clearTimeout(connectorSettleTimerRef.current)
    }
    if (connectorRevealTimerRef.current !== null) {
      window.clearTimeout(connectorRevealTimerRef.current)
    }
    if (connectorScrollEndTimerRef.current !== null) {
      window.clearTimeout(connectorScrollEndTimerRef.current)
    }
    if (connectorFrameRef.current !== null) {
      cancelAnimationFrame(connectorFrameRef.current)
    }
    sourceItemRefs.current.clear()
    resultItemRefs.current.clear()
  }, [])

  const handleInputChange = (value: string) => {
    setRawInput(value)
    setMatches([])
    setHoveredSources([])
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

  const outputColumns: ColumnsType<DeduplicatedCompanyMatch> = [
    {
      title: '原始词条来源',
      width: 240,
      render: (_, record) => (
        <Space size={6} wrap>
          <span>{record.sourceNames.slice(0, 2).join('、')}{record.sourceNames.length > 2 ? ' 等' : ''}</span>
          {record.sourceCount > 1 && <Tag>合并 {record.sourceCount} 条</Tag>}
        </Space>
      ),
    },
    {
      title: '匹配企业',
      render: (_, record) => record.company?.name,
    },
    {
      title: '地区',
      width: 130,
      render: (_, record) => record.company?.region,
    },
    {
      title: '统一社会信用代码',
      width: 190,
      render: (_, record) => record.company?.creditCode,
    },
    {
      title: '匹配方式',
      width: 110,
      render: (_, record) => <Tag color={record.kind === 'manual' ? 'purple' : 'blue'}>{MATCH_KIND_LABEL[record.kind]}</Tag>,
    },
  ]

  return (
    <section className="company-match-page">
      <header className="company-match-hero">
        <div>
          <Title level={2}>批量匹配公司</Title>
          <Text type="secondary">粘贴企业名单，自动校准为工商企业全称，人工处理未命中项后统一输出。</Text>
        </div>
        <div className="company-match-hero__summary">
          <div><strong>{sourceNames.length}</strong><span>待处理</span></div>
          <div><strong>{matchedCount}</strong><span>已匹配</span></div>
          <div className={unmatchedCount > 0 ? 'has-warning' : ''}><strong>{hasResult ? unmatchedCount : 0}</strong><span>待确认</span></div>
        </div>
      </header>

      <Steps
        className="company-match-steps"
        current={hasResult ? (unmatchedCount ? 1 : 2) : 0}
        items={[
          { title: '录入名单', content: '一行一家企业' },
          { title: '自动匹配', content: '确认异常词条' },
          { title: '输出结果', content: '生成标准名单' },
        ]}
      />

      <div className="company-match-benchmark">
        <div className="company-match-benchmark__intro">
          <ExperimentOutlined />
          <div>
            <strong>虚拟列表性能验证</strong>
            <span>生成大批量数据，列表始终只渲染视口附近约 20 行</span>
          </div>
        </div>
        <Space wrap>
          <Button onClick={() => handleCreateTestData(1000)}>载入 1,000 条</Button>
          <Button onClick={() => handleCreateTestData(10000)}>载入 10,000 条</Button>
          {matchDuration !== null && (
            <Tag color="processing">匹配耗时 {matchDuration.toFixed(1)} ms</Tag>
          )}
          {hasResult && <Tag color="success">去重后 {uniqueMatchedResults.length} 家</Tag>}
          <Tag>单列 DOM 行数 {Math.max(renderedSourceCount, renderedResultCount)}</Tag>
        </Space>
      </div>

      <div
        ref={workspaceRef}
        className="company-match-workspace"
        onMouseMove={(event: ReactMouseEvent<HTMLDivElement>) => {
          pointerPositionRef.current = { x: event.clientX, y: event.clientY }
        }}
        onMouseLeave={() => {
          pointerPositionRef.current = null
          if (connectorScrollEndTimerRef.current !== null) {
            window.clearTimeout(connectorScrollEndTimerRef.current)
            connectorScrollEndTimerRef.current = null
          }
          setHoveredSources([])
        }}
      >
        <svg
          className="company-match-connectors"
          viewBox={`0 0 ${connectorLayer.width} ${connectorLayer.height}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {connectorLayer.paths.map((path) => (
            <g key={path.id}>
              <path className="company-match-connector__outline" d={path.d} />
              <path className="company-match-connector__ants" d={path.d} />
            </g>
          ))}
        </svg>
        <section className="company-match-panel company-match-panel--source">
          <div className="company-match-panel__header">
            <div>
              <span className="company-match-panel__index">01</span>
              <div><h3>原始企业名单</h3><p>支持换行、逗号或分号分隔</p></div>
            </div>
            <Badge count={sourceNames.length} showZero color="#5b67f1" />
          </div>
          <div className={`company-source-layout${isSourceInputCollapsed ? ' is-input-collapsed' : ''}`}>
            <div className="company-source-input-pane">
              <div className="company-source-pane__header">
                <span>原始输入</span>
                <Tooltip title={isSourceInputCollapsed ? '展开原始企业名单' : '向左收起原始企业名单'}>
                  <Button
                    type="text"
                    size="small"
                    icon={isSourceInputCollapsed ? <RightOutlined /> : <LeftOutlined />}
                    onClick={() => setIsSourceInputCollapsed((collapsed) => !collapsed)}
                    aria-label={isSourceInputCollapsed ? '展开原始企业名单' : '收起原始企业名单'}
                  />
                </Tooltip>
              </div>
              {!isSourceInputCollapsed && (
                <Input.TextArea
                  className="company-match-input"
                  value={rawInput}
                  onChange={(event) => handleInputChange(event.target.value)}
                  placeholder="请输入公司名称，每行一家"
                />
              )}
            </div>

            <div className="company-source-list-pane">
              <div className="company-source-pane__header">
                <span>解析词条</span>
                <span className="company-source-pane__count">{sourceNames.length} 条</span>
              </div>
              <VirtualList
                ref={sourceListRef}
                className="company-source-list"
                ariaLabel="已解析企业词条"
                items={sourceNames}
                height={VIRTUAL_LIST_HEIGHT}
                itemHeight={VIRTUAL_ROW_HEIGHT}
                getKey={(name, index) => `${name}-${index}`}
                onRenderedRangeChange={handleSourceRenderedRangeChange}
                onScrollOffset={handleSourceScroll}
                renderItem={(name, index) => {
                  const sourceId = `source-${index}`
                  const result = matches[index]
                  const isActive = activeSourceIds.includes(sourceId)
                  return (
                    <div
                      ref={(element) => {
                        if (element) sourceItemRefs.current.set(sourceId, element)
                        else sourceItemRefs.current.delete(sourceId)
                      }}
                      data-source-id={sourceId}
                      className={`company-source-item${isActive ? ' is-active' : ''}${result?.kind === 'unmatched' ? ' is-unmatched' : ''}`}
                      onMouseEnter={(event) => {
                        pointerPositionRef.current = {
                          x: event.clientX,
                          y: event.clientY,
                        }
                        handleSourceMouseEnter(sourceId)
                      }}
                      onMouseLeave={() => setHoveredSources([])}
                    >
                      <span className="company-source-item__number">{String(index + 1).padStart(2, '0')}</span>
                      <span className="company-source-item__name">{name}</span>
                      {result && (
                        <span className={`company-source-item__confidence${result.company ? '' : ' is-unmatched'}`}>
                          {Math.round(result.confidence * 100)}%
                        </span>
                      )}
                      {result?.company && <CheckCircleFilled className="company-source-item__check" />}
                      {result?.kind === 'unmatched' && <WarningFilled className="company-source-item__warning" />}
                    </div>
                  )
                }}
              />
            </div>
          </div>
        </section>

        <div className="company-match-action">
          <span className="company-match-action__line" />
          <Tooltip title={sourceNames.length ? '运行全部匹配策略' : '请先输入企业名称'}>
            <Button
              className="company-match-action__button"
              type="primary"
              shape="circle"
              size="large"
              icon={<ArrowRightOutlined />}
              disabled={!sourceNames.length}
              onClick={handleMatch}
              loading={isPending}
              aria-label="开始匹配"
            />
          </Tooltip>
          <span className="company-match-action__label">智能匹配</span>
          <span className="company-match-action__line" />
        </div>

        <section className="company-match-panel company-match-panel--result">
          <div className="company-match-panel__header">
            <div>
              <span className="company-match-panel__index">02</span>
              <div><h3>标准企业结果</h3><p>悬停任一词条可查看对应关系</p></div>
            </div>
            {hasResult && <Tag color={unmatchedCount ? 'warning' : 'success'}>{displayedResults.length} 个结果 · {unmatchedCount} 个待确认</Tag>}
          </div>

          {hasResult && (
            <div className="company-result-toolbar" aria-label="匹配结果排序和过滤">
              <Checkbox
                checked={keepImportOrder}
                onChange={(event) => setKeepImportOrder(event.target.checked)}
              >
                按导入顺序
              </Checkbox>
              <Checkbox
                checked={hideUnmatchedResults}
                onChange={(event) => setHideUnmatchedResults(event.target.checked)}
              >
                过滤匹配失败项
              </Checkbox>
            </div>
          )}

          {!hasResult ? (
            <div className="company-match-empty">
              <FileSearchOutlined />
              <strong>等待匹配</strong>
              <span>点击中间按钮，结果会在这里逐条对齐</span>
            </div>
          ) : (
            <VirtualList
              ref={resultListRef}
              className="company-result-list"
              ariaLabel="企业匹配结果"
              items={displayedResults}
              height={VIRTUAL_LIST_HEIGHT}
              itemHeight={VIRTUAL_ROW_HEIGHT}
              empty={(
                <div className="company-result-filter-empty">
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="匹配失败项已过滤"
                  />
                </div>
              )}
              getKey={getResultKey}
              onRenderedRangeChange={handleResultRenderedRangeChange}
              onScrollOffset={handleResultScroll}
              renderItem={(result) => {
                const isActive = result.sourceIds.some((sourceId) => activeSourceIds.includes(sourceId))
                const unmatched = !result.company
                const shortName = result.company?.shortName ?? ''
                return (
                  <div
                    ref={(element) => {
                      const resultKey = getResultKey(result)
                      if (element) resultItemRefs.current.set(resultKey, element)
                      else resultItemRefs.current.delete(resultKey)
                    }}
                    data-result-key={getResultKey(result)}
                    className={`company-result-item${isActive ? ' is-active' : ''}${unmatched ? ' is-unmatched' : ''}`}
                    onMouseEnter={(event) => {
                      pointerPositionRef.current = {
                        x: event.clientX,
                        y: event.clientY,
                      }
                      handleResultMouseEnter(result)
                    }}
                    onMouseLeave={() => setHoveredSources([])}
                  >
                    <div className="company-result-item__status">
                      {unmatched ? (
                        <WarningFilled />
                      ) : result.company?.logo.src ? (
                        <img
                          className="company-result-item__logo"
                          src={result.company.logo.src}
                          alt={`${result.company.name} Logo`}
                        />
                      ) : (
                        <span
                          className="company-result-item__logo"
                          style={{
                            background: result.company?.logo.background,
                            color: result.company?.logo.foreground,
                          }}
                          role="img"
                          aria-label={`${result.company?.name} Logo`}
                        >
                          {shortName.length > 2 ? (
                            <>
                              <span className="company-result-item__logo-line">
                                {shortName.slice(0, 2)}
                              </span>
                              <span className="company-result-item__logo-line">
                                {shortName.slice(2)}
                              </span>
                            </>
                          ) : shortName}
                        </span>
                      )}
                    </div>
                    <div className="company-result-item__content">
                      <span className="company-result-item__source">
                        {result.sourceCount > 1 ? `${result.sourceCount} 个词条：` : ''}
                        {result.sourceNames.join('、')}
                      </span>
                      {result.company ? (
                        <div className="company-result-item__company">
                          <strong>{result.company.name}</strong>
                          <span>{result.company.region} · {result.strategyLabel} · {Math.round(result.confidence * 100)}%</span>
                        </div>
                      ) : (
                        <div className="company-result-item__company company-result-item__company--missing">
                          <strong>未找到匹配企业</strong>
                          <span>请人工选择正确的工商主体</span>
                        </div>
                      )}
                    </div>
                    {unmatched && (
                      <Popover
                        trigger="click"
                        placement="bottomRight"
                        open={editingSourceId === result.sourceId}
                        onOpenChange={(open) => setEditingSourceId(open ? result.sourceId : null)}
                        content={
                          <CandidatePicker
                            sourceName={result.sourceName}
                            onSelect={(company) => handleManualMatch(result.sourceId, company)}
                          />
                        }
                      >
                        <Tooltip title="选择匹配企业">
                          <Button
                            className="company-result-item__edit"
                            type="text"
                            icon={<EditOutlined />}
                            aria-label={`编辑 ${result.sourceName} 的匹配企业`}
                          />
                        </Tooltip>
                      </Popover>
                    )}
                  </div>
                )
              }}
            />
          )}
        </section>
      </div>

      <footer className="company-match-footer">
        <div className="company-match-footer__progress">
          <Progress percent={hasResult ? Math.round((matchedCount / matches.length) * 100) : 0} showInfo={false} />
          <span>{hasResult ? `已完成 ${matchedCount} 条，${unmatchedCount} 条待确认` : '匹配后可生成标准企业名单'}</span>
        </div>
        <Space>
          {unmatchedCount > 0 && <Text type="warning">未匹配项不会进入输出名单</Text>}
          <Button
            type="primary"
            size="large"
            disabled={!matchedCount}
            onClick={() => setResultOpen(true)}
          >
            下一步 · 生成名单
          </Button>
        </Space>
      </footer>

      <Drawer
        size={920}
        open={resultOpen}
        onClose={() => setResultOpen(false)}
        title="标准企业名单（已去重）"
        extra={<Tag color="success">{uniqueMatchedResults.length} 家企业</Tag>}
      >
        {duplicateCount > 0 && (
          <Alert
            showIcon
            type="success"
            title={`已按企业 ID 合并 ${duplicateCount} 条重复匹配结果`}
            style={{ marginBottom: 16 }}
          />
        )}
        {unmatchedCount > 0 && (
          <Alert
            showIcon
            type="warning"
            title={`${unmatchedCount} 个未匹配词条已跳过，可返回继续人工匹配`}
            style={{ marginBottom: 16 }}
          />
        )}
        <Table<DeduplicatedCompanyMatch>
          rowKey="sourceId"
          size="middle"
          pagination={false}
          columns={outputColumns}
          dataSource={uniqueMatchedResults}
          virtual
          scroll={{ x: 850, y: 620 }}
        />
      </Drawer>
    </section>
  )
}
