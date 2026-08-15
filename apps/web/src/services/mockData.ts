/**
 * 时间粒度视图
 * - second: 秒级(模拟时间每点推进 1 秒)
 * - minute: 分钟级(每点推进 1 分钟)
 * - hour: 小时级(每点推进 1 小时)
 * - day: 天级(每点推进 1 天)
 *
 * 真实追加频率固定为 1 秒/点,模拟时间按 stepMs 推进,
 * 使不同视图下 X 轴时间标签呈现合理跨度
 *
 * React 哲学:关注点分离
 *
 * 真实追加频率恒为 1s/点(符合"流式"直觉),
 * 模拟时间按 stepMs 虚拟推进,秒级 +1s、天级 +1d。
 * 把"数据以多快的频率到来"和"X 轴显示什么时间"两件事解耦,
 * 切换粒度不必等真实时间流逝,演示效率高。
 */
export type ChartView = 'second' | 'minute' | 'hour' | 'day'

/** 单个流式数据点 */
export interface StreamPoint {
  /** 模拟时间戳(ms) */
  time: number
  /** 数值 */
  value: number
}

interface ViewConfig {
  /** 视图标签 */
  label: string
  /** 滚动窗口大小(保留最近 N 个点) */
  window: number
  /** 每追加一个点,模拟时间推进的毫秒数 */
  stepMs: number
  /** 时间戳格式化 */
  format: (ts: number) => string
}

const pad = (n: number) => n.toString().padStart(2, '0')

/**
 * React 哲学:开闭原则(对扩展开放,对修改关闭)
 *
 * 用配置表驱动:新增"周"视图只需在此追加一个 key,
 * 所有消费方(Object.keys 遍历、读取属性)无需任何改动;
 * 若改成 switch/case 或散落的 if-else,每加一种粒度都要改多处。
 *
 * React 哲学:类型驱动设计
 *
 * Record<ChartView, ViewConfig> 而非 Partial:
 * 强制每种 ChartView 都有对应配置,新增枚举值时编译器会报缺漏,
 * 把"漏配置"的错误提前到编译期。
 */
export const VIEW_META: Record<ChartView, ViewConfig> = {
  second: {
    label: '秒',
    window: 60,
    stepMs: 1_000,
    format: (t) => {
      const d = new Date(t)
      return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
    },
  },
  minute: {
    label: '分钟',
    window: 60,
    stepMs: 60_000,
    format: (t) => {
      const d = new Date(t)
      return `${pad(d.getHours())}:${pad(d.getMinutes())}`
    },
  },
  hour: {
    label: '小时',
    window: 24,
    stepMs: 3_600_000,
    format: (t) => {
      const d = new Date(t)
      return `${pad(d.getHours())}:00`
    },
  },
  day: {
    label: '天',
    window: 30,
    stepMs: 86_400_000,
    format: (t) => {
      const d = new Date(t)
      return `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    },
  },
}

/**
 * 生成单个随机数据点(模拟实时采集)
 * 返回数值,便于未来替换为真实接口
 *
 * React 哲学:关注点分离
 *
 * Mock 数据出口收敛到单一函数:
 * 真实接口接入时,只需把 generateValue() 换成 await fetchValue(),
 * ChartsPage 中其他逻辑(追加/窗口/视图切换)完全不动。
 * 把"数据从哪来"这种易变的关注点,与"数据怎么用"分离。
 */
export function generateValue(): number {
  return Math.floor(Math.random() * 200) + 50
}
