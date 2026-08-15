import Chart from '@/components/Chart'
import type { EChartsOption } from 'echarts'

interface ChartCardProps {
  /** 卡片标题 */
  title: string
  /** ECharts 配置项 */
  option: EChartsOption
  /** 是否加载中 */
  loading?: boolean
  /** 图表高度 */
  height?: number | string
}

/**
 * 图表卡片(纯展示组件)
 * 仅依赖 props,不关心数据来源,便于在 React DevTools 中观察 props 变化
 *
 * React 哲学:组合 / 容器与展示组件分层
 *
 * 父组件 ChartsPage 负责取数与状态(容器),ChartCard 只负责"怎么画"(展示)。
 * 这类组件无内部 state,易于测试、复用,且在 DevTools 中可清晰看到 props 流向;
 * 数据来源变化时,展示组件无需任何改动。
 */
export default function ChartCard({
  title,
  option,
  /*
   * React 哲学:显式优于隐式
   *
   * 参数默认值即简化的"未传参"处理:
   * 等价于 loading = loading === undefined ? false : loading。
   * 大多数调用方不需要 loading 态,默认值降低使用成本;
   * 需要的调用方显式传 loading={true} 即可。
   */
  loading = false,
  height = 320,
}: ChartCardProps) {
  return (
    <div className="charts__item">
      <h2 className="charts__title">{title}</h2>
      {/*
       * React 哲学:声明式渲染(Declarative)
       *
       * 用三元表达式声明"loading ? 骨架屏 : 图表",而不是命令式地
       * "先显示骨架再切到图表"。React 根据 state 自动推导视图,
       * 骨架屏作为同一位置的占位,避免 echarts 实例在空数据上闪烁。
       *
       * aria-hidden 标记骨架屏为装饰性元素,屏幕阅读器会跳过,
       * 避免无障碍冗余。
       */}
      {loading ? (
        <div className="charts__skeleton" style={{ height }} aria-hidden />
      ) : (
        <Chart option={option} height={height} />
      )}
    </div>
  )
}
