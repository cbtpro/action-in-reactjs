import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * StickyActions - 智能吸底操作栏组件
 *
 * 三种布局状态自动切换(开闭原则:新增状态只需扩展 StickyState 分支):
 * - hidden:  页面初次加载、用户尚未滚动 → 默认隐藏,释放首屏空间
 * - sticky:  用户滚动中,且底部锚点不在可视区域 → position:fixed 吸底
 * - inline:  滚动到底部附近,锚点进入可视区域 → 恢复为普通文档流排布
 *
 * 实现原理(分离关注):
 * - Placeholder: 留在原文档流中的占位锚点(0 高),仅用于 IntersectionObserver
 *   侦测"应该在什么位置普通显示"
 * - Floating:    position:fixed 直接在原位渲染(不 portal 到 body),
 *   配合祖先元素(.app-content)的 transform 创建包含块,使 fixed 相对于
 *   路由页面区域而非浏览器视口,实现"在路由页面区域内浮动"的效果
 */
export type StickyState = 'hidden' | 'sticky' | 'inline'

export interface StickyActionsProps {
  children: ReactNode
  /** 滚动容器选择器,不传则沿 DOM 向上找最近的 overflow:auto/scroll,兜底为 window */
  scrollContainer?: string
  /** 吸底时距底部的偏移,可用于适配 iOS 安全区 */
  bottomOffset?: number
  /** 吸底层级 */
  zIndex?: number
  /** 自定义根类名,用于覆盖样式 */
  className?: string
}

/**
 * 沿 DOM 向上查找最近的可滚动容器(overflow:auto 或 scroll)
 * 若未找到,返回 document.scrollingElement(兜底)或 document.documentElement
 */
function findScrollable(el: Element | null): Element | Window {
  let node: Element | null = el
  while (node && node !== document.documentElement) {
    const style = window.getComputedStyle(node)
    const overflowY = style.overflowY ?? style.overflow
    if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) {
      return node
    }
    node = node.parentElement
  }
  return window
}

/**
 * 安全区底部 inset(兼容 iOS Safari)
 * 单例取值:模块级 IIFE 只计算一次,避免每次渲染重复读取 CSS 变量
 */
const SAFE_AREA_BOTTOM: number = (() => {
  if (typeof window === 'undefined') return 0
  try {
    const raw = getComputedStyle(document.documentElement).getPropertyValue('--sat') || '0px'
    return parseInt(raw, 10) || 0
  } catch {
    return 0
  }
})()

export default function StickyActions({
  children,
  scrollContainer,
  bottomOffset = 0,
  zIndex = 100,
  className = '',
}: StickyActionsProps) {
  /*
   * React 哲学:引用稳定性(useRef 承载不驱动渲染的值)
   * hasScrolledRef 用于判定"用户是否已经发生过滚动行为",
   * 避免首屏立即出现吸底按钮(违背"默认隐藏"的需求)。
   */
  const placeholderRef = useRef<HTMLDivElement | null>(null)
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const hasScrolledRef = useRef(false)

  /*
   * state: 当前展示模式 —— hidden / sticky / inline
   * 用 useState 驱动渲染,useRef 存"是否滚过"这种事件型标记。
   */
  const [state, setState] = useState<StickyState>('hidden')

  /* 副作用:绑定滚动监听 + IntersectionObserver */
  useEffect(() => {
    /* ---------- 1. 解析滚动容器 ---------- */
    let scroller: Element | Window | null = null
    if (scrollContainer) {
      scroller = document.querySelector(scrollContainer)
    }
    if (!scroller && wrapperRef.current) {
      scroller = findScrollable(wrapperRef.current)
    }
    if (!scroller) scroller = window

    /* ---------- 2. 滚动监听:标记"用户已滚动",触发状态重算 ---------- */
    const onScroll = () => {
      hasScrolledRef.current = true
      recompute()
    }

    /* ---------- 3. IntersectionObserver:监听锚点是否进入视口 ---------- */
    /*
     * root 为滚动容器(Element)时,IO 会以该容器的可视边界为判定基准;
     * 若 scroller 是 window,则传 null,使用浏览器默认 viewport。
     */
    const ioRoot: Element | null = scroller instanceof Element ? scroller : null

    let anchorVisible = false

    const io =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(
            (entries) => {
              for (const entry of entries) {
                if (entry.target === placeholderRef.current) {
                  anchorVisible = entry.isIntersecting
                  recompute()
                }
              }
            },
            {
              root: ioRoot,
              /*
               * threshold:0 表示"只要出现 1px 就算进入"。
               * 搭配 rootMargin 可以做"提前一点进入/延迟一点离开",
               * 这里使用默认 0,保证锚点真正进入视口才切 inline。
               */
              threshold: 0,
            },
          )
        : null

    if (placeholderRef.current && io) io.observe(placeholderRef.current)

    /* ---------- 4. 状态重算(单一真源:anchorVisible + hasScrolledRef) ---------- */
    function recompute() {
      if (placeholderRef.current == null) return

      if (anchorVisible) {
        // 锚点进入视口 → 普通底部排布
        setState('inline')
      } else if (hasScrolledRef.current) {
        // 锚点不在视口 + 用户已滚动 → 吸底
        setState('sticky')
      } else {
        // 用户从未滚动 → 默认隐藏
        setState('hidden')
      }
    }

    /* 首次挂载时也执行一次(防止锚点初始就在可视区域但没切 inline) */
    // 下一帧再跑,确保 layout 已稳定
    const rafId = requestAnimationFrame(() => {
      recompute()
    })

    /* ---------- 5. 绑定事件 ---------- */
    scroller.addEventListener('scroll', onScroll as EventListener, { passive: true })

    return () => {
      cancelAnimationFrame(rafId)
      scroller.removeEventListener('scroll', onScroll as EventListener)
      io?.disconnect()
    }
    /*
     * 依赖空数组:此副作用只在"挂载/卸载"时跑一次绑定与解绑。
     * 内部读取的 ref / state 都通过闭包+回调方式按需访问,无需重绑。
     */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollContainer])

  /* ---------- 渲染层 ---------- */

  /*
   * 公共内容:保证吸底版和 inline 版 DOM 结构完全一致,
   * 切换状态时不会出现按钮"消失再出现"的闪烁。
   */
  const content = (
    <div className={`sticky-actions__inner ${className}`.trim()}>
      {children}
    </div>
  )

  const finalBottom = bottomOffset + SAFE_AREA_BOTTOM

  return (
    <div ref={wrapperRef} className="sticky-actions">
      {/* 占位锚点:0 高度、留在原文档流中,仅用于 IO 侦测位置 */}
      <div ref={placeholderRef} className="sticky-actions__anchor" aria-hidden />

      {/*
       * inline 模式:普通静态排布,与锚点处于同一上下文,
       * 滚动到底部自然出现在页面底部。
       */}
      {state === 'inline' && (
        <div className="sticky-actions__slot sticky-actions__slot--inline">
          {content}
        </div>
      )}

      {/*
       * sticky 模式:position:fixed 直接在原位渲染(不 portal 到 body)。
       *
       * 关键:祖先元素 .app-content 设置了 transform: translateZ(0),
       * 它会成为 fixed 定位的包含块(containing block),
       * 因此 left:0 / right:0 / bottom:0 相对于 .app-content 的 padding box,
       * 而不是浏览器视口 —— 实现"仅在路由页面区域内浮动"。
       *
       * 不用 createPortal 的原因:
       * 1. 避免 fixed 挂到 body 后脱离路由页面区域,变成全浏览器浮动
       * 2. 祖先 transform 包含块方案天然解决 overflow:hidden 裁剪问题
       */}
      {state === 'sticky' && (
        <div
          className="sticky-actions__slot sticky-actions__slot--sticky"
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: finalBottom,
            zIndex,
          }}
        >
          {content}
        </div>
      )}
    </div>
  )
}
