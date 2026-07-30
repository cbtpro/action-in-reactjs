import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ChartCard from '@/components/ChartCard'
import {
  generateValue,
  VIEW_META,
  type ChartView,
  type StreamPoint,
} from '@/services/mockData'
import type { EChartsOption } from 'echarts'

/** 流式追加间隔(ms) */
const APPEND_INTERVAL = 1000

/**
 * ECharts 演示页
 *
 * 页面职责:
 * - 流式追加:每秒新增一个数据点(非整体刷新)
 * - 滚动窗口:超过窗口大小自动丢弃最旧点
 * - 视图切换(秒/分钟/小时/天):改变时间粒度,切换时重置游标与数据
 *
 * 数据来自 mockData,便于在 React DevTools 观察 state 变化、
 * 在 Components 面板观察 ChartCard 的 props 变化
 */
export default function ChartsPage() {
  /* 视图粒度:演示 state 变更触发副作用 */
  const [view, setView] = useState<ChartView>('second')
  /* 是否开启流式追加:演示开关型 state */
  const [streaming, setStreaming] = useState(true)
  /* 已采集的数据点(滚动窗口):每秒追加,演示数组 state 的不可变更新 */
  const [points, setPoints] = useState<StreamPoint[]>([])

  /*
   * React 哲学:副作用隔离
   *
   * setInterval 的回调只捕获首次渲染的 view,后续 view 更新后回调仍读到旧值
   * (这是 React 闭包陷阱的典型表现)。
   *
   * 用 ref 镜像 state,在每次渲染时同步 viewRef.current = view,
   * 定时器回调读取 viewRef.current 即可始终拿到最新值;
   * 同时 appendOne 可保持空依赖,引用稳定,避免定时器反复重建。
   */
  const viewRef = useRef(view)
  viewRef.current = view

  /*
   * React 哲学:显式状态分离
   *
   * 真实追加频率固定 1s/点,但若 X 轴也只推进 1s,
   * 切到"天/小时"粒度时需要等数小时才能看出曲线趋势。
   *
   * 用 cursorRef 按 stepMs 虚拟推进,秒级 +1s、分钟级 +1min、天级 +1d,
   * 既能保留"每秒一个点"的真实流式感,又能让不同粒度的 X 轴标签跨度合理。
   */
  const cursorRef = useRef<number>(Date.now())
  const timerRef = useRef<number | null>(null)

  /*
   * React 哲学:状态不可变 + 单一职责
   *
   * 1) setPoints(prev => ...) 不依赖外部 points,避免把 points 加入依赖导致回调重建
   * 2) 用 [...prev, point] 不可变追加(不可直接 push,否则 React 检测不到变化)
   * 3) 超过窗口时用 slice 裁剪,而非每次 shift;
   *    slice 创建新数组但一次裁剪到底,比逐次 shift 触发多次重渲染更优
   */
  const appendOne = useCallback(() => {
    const config = VIEW_META[viewRef.current]
    cursorRef.current += config.stepMs
    const point: StreamPoint = {
      time: cursorRef.current,
      value: generateValue(),
    }
    setPoints((prev) => {
      const next = [...prev, point]
      return next.length > config.window
        ? next.slice(next.length - config.window)
        : next
    })
  }, [])

  /*
   * React 哲学:关注点分离
   *
   * 切粒度只关心"重置",不关心"追加";追加逻辑由独立的定时器 effect 负责。
   * 职责单一,后续修改追加逻辑不会误伤重置逻辑。
   */
  useEffect(() => {
    cursorRef.current = Date.now()
    setPoints([])
  }, [view])

  /*
   * React 哲学:副作用隔离与资源生命周期
   *
   * streaming 变化时自动重建/清理定时器;
   * cleanup 函数保证组件卸载时一定 clearInterval,杜绝内存泄漏
   * (即使开发时 hot reload 也不会残留定时器)。
   */
  useEffect(() => {
    if (!streaming) return
    appendOne()
    timerRef.current = window.setInterval(appendOne, APPEND_INTERVAL)
    return () => {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [streaming, appendOne])

  /* 手动追加:依赖 appendOne(其引用稳定),故 handleAdd 也稳定 */
  const handleAdd = useCallback(() => {
    appendOne()
  }, [appendOne])

  /*
   * React 哲学:引用稳定性(Stable References)
   *
   * useCallback 的真实目的是保持函数引用稳定,而非"缓存结果"。
   * [] 表示该回调不依赖任何 state/props:
   *   - cursorRef 是 useRef 返回,引用恒定
   *   - setPoints 是 useState 的 setter,React 保证引用稳定
   * 故依赖为空是正确的;稳定引用让该回调被传给子组件或作为 effect 依赖时
   * 不会触发无谓更新。
   */
  const handleClear = useCallback(() => {
    cursorRef.current = Date.now()
    setPoints([])
  }, [])

  /*
   * React 哲学:派生状态缓存
   *
   * points 每秒变化 → 若每次渲染都构造 option 对象,
   * 会导致 Chart 的 option useEffect 频繁触发;
   * useMemo 使 option 引用仅在 points/config 真正变化时才更新。
   */
  const config = VIEW_META[view]
  const lineOption = useMemo<EChartsOption | null>(() => {
    /*
     * React 哲学:显式优于隐式
     *
     * points 为空时返回 null,配合下方 {lineOption && <ChartCard />}
     * 避免向 Chart 传入空 option,边界处理在数据源而非渲染层。
     */
    if (points.length === 0) return null
    return {
      title: { text: '实时数据流', left: 'center' },
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'category',
        /* boundaryGap:false 让折线从 Y 轴起点开始,流式场景更自然 */
        boundaryGap: false,
        data: points.map((p) => config.format(p.time)),
      },
      yAxis: { type: 'value' },
      series: [
        {
          name: 'PV',
          type: 'line',
          smooth: true,
          /* 关闭 symbol,避免高频追加时数据点圆圈密集重叠 */
          showSymbol: false,
          areaStyle: {},
          data: points.map((p) => p.value),
        },
      ],
      /*
       * 流式场景关闭 echarts 内置动画:
       * 每秒追加点会触发动画,默认过渡反而让曲线"抖动",
       * 关闭后新点直接衔接,视觉更稳定。
       */
      animation: false,
    }
  }, [points, config])

  return (
    <section className="page">
      <h1>ECharts 示例</h1>
      <p className="page__desc">
        流式追加:每秒新增一个数据点,横轴为时间。
        切换粒度或开关流式,可在 React DevTools 观察 state 与 props 变化。
      </p>

      {/* 控件区 */}
      <div className="controls">
        <div className="segmented" role="tablist" aria-label="时间粒度">
          {(Object.keys(VIEW_META) as ChartView[]).map((key) => (
            <button
              key={key}
              role="tab"
              aria-selected={view === key}
              className={`segmented__item${view === key ? ' is-active' : ''}`}
              onClick={() => setView(key)}
            >
              {VIEW_META[key].label}
            </button>
          ))}
        </div>

        <label className="switch">
          <input
            type="checkbox"
            checked={streaming}
            onChange={(e) => setStreaming(e.target.checked)}
          />
          <span>流式追加(1s)</span>
        </label>

        <button type="button" className="link" onClick={handleAdd}>
          追加一个点
        </button>

        <button type="button" className="link" onClick={handleClear}>
          清空
        </button>
      </div>

      <p className="meta">
        已采集 {points.length} / {config.window} 个点 · {config.label}级窗口滚动
      </p>

      <div className="charts">
        {lineOption && (
          <ChartCard title="实时数据流" option={lineOption} />
        )}
      </div>
    </section>
  )
}
