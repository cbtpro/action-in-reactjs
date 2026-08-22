/**
 * SearchItem.tsx
 * ------------------------------------------------------------------
 * 基于 { type, name, formItemProps, innerProps } 声明式配置,渲染一个
 * 带 Form.Item 的搜索控件。
 *
 * ================================================================
 *  公共 API (约束 C1, 不新增 enableIME / composition 等属性)
 * ================================================================
 *
 *  interface SearchItemProps {
 *    type: SearchItemType               // input | textarea | select | date | range
 *    name: string | string[]            // Form.Item 的 name(嵌套用数组)
 *    formItemProps?: Form.Item 的 props
 *    innerProps?: Record<string, any>   // 传给真正 UI 控件(Input/Select/DatePicker...) 的 props
 *    children?: ReactNode              // 自定义渲染(优先级最高)
 *  }
 *
 * 业务层:
 *   <SearchItem type="input" name="keyword"
 *     innerProps={{ placeholder:'xxx', allowClear, onCompositionStart:fn }} />
 *
 * 无需传任何 IME 相关参数。SearchItem 会自动:
 *   1) 对于 type=input/textarea 自动使用 IMEInput/IMETextArea(内置 composition 处理)
 *   2) innerProps.onCompositionStart / onCompositionEnd / onChange 不会被吞
 *      (IMEInput 里 useIME 链式调用 + onChange 原样透传)
 *   3) select/date/range 等非文本控件不接 composition,无副作用
 *
 * ================================================================
 *  不吞 props 的承诺 (AC-U2 / "小公司不盲目封装 UI"原则)
 * ================================================================
 *
 * 原则:此组件**不写任何默认的 style/placeholder/options/onChange**去覆盖
 *      innerProps 里业务传入的值。所有 innerProps 100% spread 给真正 UI 控件。
 *
 * 反例(禁止):
 *   <Select {...innerProps} style={{ width: 140, ...innerProps.style }} />
 *   上面写法在业务传了 style.width 后合并顺序正确,但如果反过来写成
 *   <Select {...innerProps} style={{ width: 140 }} /> 就会吞掉业务 width。
 *   为了避免这种"不小心吞 props",我们完全不注入任何 UI 属性,让业务完全控制。
 *  如果业务需要某个 SearchItem 宽度固定,请在 innerProps 里写。
 *  这符合"只封装业务组件,不封装 UI 外壳组件"的最佳实践。
 *
 * ================================================================
 *  开闭原则 (NFR-1)
 * ================================================================
 * 新增 type 的成本 = 2 处修改:
 *   1) 顶部 SearchItemType 联合类型加一个成员
 *   2) renderControl 的 switch 加一行 case
 * 现有代码零改动。
 *
 * ================================================================
 *  Form.Item 不接 composition 事件 (C4 / AC-R7)
 * ================================================================
 * compositionstart/end 是 DOM 元素的事件,只有真实的
 * <input>/<textarea>/<select> 才会触发。Form.Item 是 React 组件不是
 * DOM,在它身上写 onCompositionStart/End **没有任何效果** 除了给 antd
 * Form.Item 报 unknown prop warning。所以此处 composition 事件都在
 * IMEInput/IMETextArea 层(真实控件上)绑定。
 */
import * as React from 'react'
import { Form, Select, DatePicker } from 'antd'
import type { FormItemProps } from 'antd'
import { IMEInput } from './components/IMEInput'
import { IMETextArea } from './components/IMETextArea'

/* ------------------------------------------------------------------ */
/*  类型定义                                                           */
/* ------------------------------------------------------------------ */

/**
 * 支持的搜索控件类型(开闭原则:新增类型只需扩展这里 + switch 分支)。
 */
export type SearchItemType =
  | 'input'
  | 'textarea'
  | 'select'
  | 'date'
  | 'range'

/**
 * 公共 Props(约束 C1,禁止新增 IME 维度的开关)。
 */
export interface SearchItemProps {
  /** 决定内部真实渲染控件种类 */
  type: SearchItemType
  /** Form.Item 的 name。支持嵌套:['a','b',0] 对应 form 值路径 a.b[0] */
  name: string | number | (string | number)[]
  /** 透传给 antd Form.Item 的 props。如 label、rules、extra 等。 */
  formItemProps?: FormItemProps
  /**
   * 透传给内部真实控件的 props。
   * 例:
   *   - input → antd InputProps
   *   - select → antd SelectProps
   *   - date → antd DatePickerProps
   *   - range → antd RangePickerProps
   *
   * 支持 composition 事件/onChange 回调(不会被 SearchItem 覆盖,C3)。
   */
  innerProps?: Record<string, any>
  /**
   * 自定义渲染内容。如果传了 children,就完全忽略 type/innerProps,
   * 由业务自己提供 Form.Item 的 children。适用于:
   *   - 特殊组合控件(mentions、autoComplete 等扩展)
   *   - 需要包 PermissionGuard / Tooltip 的场景
   */
  children?: React.ReactNode
}

/* ------------------------------------------------------------------ */
/*  辅助工具                                                           */
/* ------------------------------------------------------------------ */

/**
 * name 归一化(转成字符串)。
 * 目的:给 IME 标记 Set<React.Key> 做统一维度 key,确保:
 *   - 'keyword'         → keyword
 *   - ['person', 'name']→ person.name
 *   - ['list', 0]      → list.0
 */
function normalizeName(
  name: string | number | (string | number)[],
): string {
  if (Array.isArray(name)) {
    return name.map(String).join('.')
  }
  return String(name)
}

/* ------------------------------------------------------------------ */
/*  主组件                                                             */
/* ------------------------------------------------------------------ */

/**
 * SearchItem — 声明式搜索条件配置组件。
 * 渲染结构:<Form.Item name={name} {...formItemProps}>{renderControl() 或 children}</Form.Item>
 */
export function SearchItem(props: SearchItemProps) {
  const { type, name, formItemProps, innerProps = {}, children } = props

  const normalizedName = normalizeName(name)

  /* ---------- 控件分发(开闭:新增 type 在这里加 case) ---------- */
  const renderControl = (): React.ReactNode => {
    switch (type) {
      case 'input':
        return <IMEInput fieldName={normalizedName} {...innerProps} />
      case 'textarea':
        return <IMETextArea fieldName={normalizedName} {...innerProps} />
      case 'select':
        return <Select {...innerProps} />
      case 'date':
        return <DatePicker {...innerProps} />
      case 'range':
        return <DatePicker.RangePicker {...innerProps} />
      default:
        // 未知类型: TypeScript 应该在编译期拦住(联合类型 exhaustiveness check)。
        // 运行时兜底:渲染 placeholder 提示开发者。
        // 注意:通过 import.meta.env.DEV(基于 Vite)替代 process.env,避免在非 Node
        // 类型配置下出现 Cannot find name 'process' 报错。
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const isDev = (import.meta as any)?.env?.DEV
        if (typeof isDev === 'boolean' && isDev) {
          // eslint-disable-next-line no-console
          console.warn(
            `[SearchItem] 未知 type="${type}",请在顶部联合类型与 switch 中增加对应分支。`,
          )
        }
        return null
    }
  }

  /*
   * 【AC-R7 保证】Form.Item 上绝对没有 onComposition* 事件。
   * 这是因为 formItemProps 在业务中如果传了,那也是业务自己的事,
   * 但设计文档明确约束我们不能在此组件上处理 composition ——
   * 因此 formItemProps 上即使有 onComposition 也由上层 Form.Item 原样处理
   * (antd Form.Item 会把未知属性透传下去,可能导致 antd warning,但这是业务
   * 传了不合适的属性的问题,不是 SearchItem 本身的 bug。)
   */
  return (
    <Form.Item name={name as FormItemProps['name']} {...formItemProps}>
      {children ?? renderControl()}
    </Form.Item>
  )
}
