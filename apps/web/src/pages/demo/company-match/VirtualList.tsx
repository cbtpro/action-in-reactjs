import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type {
  ForwardedRef,
  ReactElement,
  ReactNode,
  Ref,
  UIEvent,
} from 'react'

export interface VirtualListHandle {
  scrollToIndex: (index: number) => number | null
  scrollToOffset: (offset: number) => number | null
}

interface VirtualListProps<T> {
  items: T[]
  height: number
  itemHeight: number
  overscan?: number
  className?: string
  ariaLabel?: string
  empty?: ReactNode
  getKey: (item: T, index: number) => string
  renderItem: (item: T, index: number) => ReactNode
  onScrollOffset?: (offset: number) => void
  onRenderedRangeChange?: (count: number) => void
}

/**
 * 固定行高虚拟列表。
 *
 * 列表只负责窗口计算和滚动，不感知企业数据。不同业务列表通过 renderItem
 * 组合内容，后续可直接复用在联系人、专利等批量匹配场景。
 */
function VirtualListInner<T>(
  {
    items,
    height,
    itemHeight,
    overscan = 5,
    className,
    ariaLabel,
    empty,
    getKey,
    renderItem,
    onScrollOffset,
    onRenderedRangeChange,
  }: VirtualListProps<T>,
  ref: ForwardedRef<VirtualListHandle>,
) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(height)

  /*
   * 外层可以通过 flex 把列表撑高。监听真实高度后重新计算窗口范围，
   * 避免视觉容器已经变高、虚拟列表却仍只按初始高度渲染而留下空白。
   */
  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    const updateHeight = () => {
      const nextHeight = viewport.clientHeight
      if (nextHeight > 0) setViewportHeight(nextHeight)
    }

    updateHeight()
    if (typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver(updateHeight)
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [height, items.length])

  const visibleRange = useMemo(() => {
    const visibleCount = Math.ceil(viewportHeight / itemHeight)
    const maxStart = Math.max(0, items.length - visibleCount)
    const start = Math.min(
      maxStart,
      Math.max(0, Math.floor(scrollTop / itemHeight) - overscan),
    )
    const end = Math.min(items.length, start + visibleCount + overscan * 2)
    return { start, end }
  }, [itemHeight, items.length, overscan, scrollTop, viewportHeight])

  const visibleItems = items.slice(visibleRange.start, visibleRange.end)

  useLayoutEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    const actualViewportHeight = viewport.clientHeight || viewportHeight
    const maxOffset = Math.max(0, items.length * itemHeight - actualViewportHeight)
    const nextOffset = Math.min(viewport.scrollTop, maxOffset)
    if (Math.abs(viewport.scrollTop - nextOffset) >= 0.5) {
      viewport.scrollTop = nextOffset
    }
    setScrollTop((current) =>
      Math.abs(current - nextOffset) < 0.5 ? current : nextOffset,
    )
  }, [itemHeight, items.length, viewportHeight])

  useEffect(() => {
    onRenderedRangeChange?.(visibleItems.length)
  }, [
    onRenderedRangeChange,
    visibleItems.length,
    visibleRange.end,
    visibleRange.start,
  ])

  const scrollToOffset = useCallback(
    (offset: number) => {
      const viewport = viewportRef.current
      if (!viewport) return null
      const maxOffset = Math.max(0, items.length * itemHeight - viewportHeight)
      const nextOffset = Math.max(0, Math.min(offset, maxOffset))
      if (Math.abs(viewport.scrollTop - nextOffset) >= 0.5) {
        viewport.scrollTop = nextOffset
      }
      setScrollTop((current) =>
        Math.abs(current - nextOffset) < 0.5 ? current : nextOffset,
      )
      return nextOffset
    },
    [itemHeight, items.length, viewportHeight],
  )

  useImperativeHandle(
    ref,
    () => ({
      scrollToOffset,
      scrollToIndex(index: number) {
        return scrollToOffset(index * itemHeight)
      },
    }),
    [itemHeight, scrollToOffset],
  )

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    const offset = event.currentTarget.scrollTop
    setScrollTop(offset)
    onScrollOffset?.(offset)
  }

  return (
    <div
      ref={viewportRef}
      className={`virtual-list${className ? ` ${className}` : ''}`}
      style={{ height }}
      role="list"
      aria-label={ariaLabel}
      onScroll={handleScroll}
    >
      {items.length ? (
        <div className="virtual-list__spacer" style={{ height: items.length * itemHeight }}>
          <div
            className="virtual-list__window"
            style={{ transform: `translateY(${visibleRange.start * itemHeight}px)` }}
          >
            {visibleItems.map((item, offset) => {
              const index = visibleRange.start + offset
              return (
                <div
                  key={getKey(item, index)}
                  className="virtual-list__row"
                  style={{ height: itemHeight }}
                  role="listitem"
                >
                  {renderItem(item, index)}
                </div>
              )
            })}
          </div>
        </div>
      ) : empty}
    </div>
  )
}

export const VirtualList = forwardRef(VirtualListInner) as <T>(
  props: VirtualListProps<T> & { ref?: Ref<VirtualListHandle> },
) => ReactElement
