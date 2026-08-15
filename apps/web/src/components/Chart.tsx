import { useEffect, useRef } from 'react'
import * as echarts from 'echarts'
import type { EChartsOption } from 'echarts'

interface ChartProps {
  /** ECharts 配置项 */
  option: EChartsOption
  /** 图表高度,默认 320 */
  height?: number | string
  /** 额外 className */
  className?: string
}

/**
 * 通用 ECharts 容器组件
 * 仅负责实例生命周期(初始化/更新/resize/销毁),不关心业务 option
 */
export default function Chart({ option, height = 320, className }: ChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  /*
   * React 哲学:引用稳定性(Stable References)
   *
   * 用 ref 持有 echarts 实例,跨渲染保留且不触发重渲染。
   * 实例本身不是视图数据,放进 state 会引发多余渲染;
   * ref 是"容器",不参与渲染输出,符合"非视图数据用 ref"的约定。
   */
  const chartRef = useRef<echarts.ECharts | null>(null)

  /*
   * React 哲学:单一职责(Single Responsibility)
   *
   * 把 echarts 的生命周期拆成两个独立 effect:
   *   - 这个 effect 空依赖:只在挂载时 init、卸载时 dispose,管"生命周期"
   *   - 下个 effect 依赖 option:option 变化时只调 setOption,管"数据更新"
   * 拆开的好处:init 逻辑不会被 option 变化反复执行,职责清晰。
   */
  useEffect(() => {
    if (!containerRef.current) return
    const instance = echarts.init(containerRef.current)
    chartRef.current = instance
    instance.setOption(option)

    /*
     * React 哲学:副作用隔离与资源生命周期
     *
     * resize 监听随组件卸载一起解绑,否则组件销毁后 window 上仍残留监听,
     * 造成内存泄漏与报错。cleanup 函数与 effect 一一对应。
     */
    const handleResize = () => instance.resize()
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      instance.dispose()
      chartRef.current = null
    }
  }, [])

  /* option 更新:依赖 option,引用变化时触发 */
  useEffect(() => {
    /*
     * React 哲学:显式优于隐式(Explicit over Implicit)
     *
     * setOption 第二参 true = notMerge,完全替换而非合并:
     * 保证 option 中删除的字段真的被移除,
     * 避免"上次有 series[1]、这次只传 series[0]"时残留旧 series。
     */
    chartRef.current?.setOption(option, true)
  }, [option])

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: '100%', height }}
    />
  )
}
