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
  /**
   * 滚动到指定数据索引。
   *
   * @param index - 目标数据的零基索引。
   * @returns 实际滚动偏移；列表尚未挂载时返回 `null`。
   */
  scrollToIndex: (index: number) => number | null
  /**
   * 滚动到指定纵向偏移。
   *
   * @param offset - 期望的纵向滚动偏移。
   * @returns 经过边界限制后的实际偏移；列表尚未挂载时返回 `null`。
   */
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
 *
 * @param props - 列表数据、固定行高、渲染函数和滚动回调。
 * @param ref - 提供按索引或偏移滚动能力的外部引用。
 * @returns 仅挂载可见范围及缓冲行的虚拟列表。
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

    /** 读取列表真实高度并同步虚拟窗口尺寸。 */
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

  /**
   * 将列表滚动到安全范围内的目标偏移。
   *
   * @param offset - 期望的纵向滚动偏移。
   * @returns 实际采用的偏移；列表尚未挂载时返回 `null`。
   */
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

  /**
   * 同步用户滚动产生的偏移并通知调用方。
   *
   * @param event - 虚拟列表视口的滚动事件。
   * @returns 无返回值。
   */
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

/** 支持泛型数据和受限滚动句柄的固定行高虚拟列表。 */
export const VirtualList = forwardRef(VirtualListInner) as <T>(
  props: VirtualListProps<T> & { ref?: Ref<VirtualListHandle> },
) => ReactElement
