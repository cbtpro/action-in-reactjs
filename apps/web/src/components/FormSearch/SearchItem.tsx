/**
 * SearchItem.tsx
 * ------------------------------------------------------------------
 * 基于 { type, name, formItemProps, innerProps } 声明式配置,渲染一个
 * 带 Form.Item 的搜索控件。
 *
 * ================================================================
 *  2026-08-22 重构(对齐用户简化后的 IME 组件)
 * ================================================================
 *
 * 【之前的 IME 处理思路(已废弃)】
 *   - 自己包一层 IMEInput / IMETextArea,内部只捕 compositionstart/end 事件,
 *     把事件上报给 FormSearch 内部的 IMEContext (per-field Set<Key>)。
 *   - onChange 零包装,Form value 会实时写入拼音中间态。
 *   - 由 FormSearch scheduleSearch 的 Gating 逻辑(精确字段级 Set.has())
 *     在调度层跳过 composing 字段产生的中间请求。
 *
 * 【现在的 IME 处理思路(对齐用户重构的 withComposition)】
 *   - 使用用户简化后的公共组件:
 *       @/components/IMEInput   (withComposition 包装的 antd Input)
 *       @/components/IMETextArea (withComposition 包装的 antd Input.TextArea)
 *       @/components/IMENumberInput (useIMEComposition 包装的 antd InputNumber)
 *   - 新组件的核心:在 **组件内部** 通过 useIMEComposition 状态机自己拦截
 *     onChange:
 *         compositionstart → composingRef=true,清空 debounce
 *         onInput onChange → 只 setInputValue(实时显示拼音,不触发外部 onChange)
 *         compositionend → endComposition:commit(event) → 唯一一次触发外部 onChange
 *     等价效果:Form.Item 注入的 onChange 在合成期完全不会被通知,
 *     所以 Form onValuesChange → FormSearch scheduleSearch 自然只收到
 *     最终值的一次变更。
 *
 * 【带来的简化点(体现在此文件 + FormSearch.tsx 中)】
 *  1) SearchItem 不再需要 fieldName / normalizeName:新组件不依赖外层
 *     IMEContext,不需要按字段维度上报 IME 状态。
 *  2) FormSearch 不再需要 IMEContext.Provider、composingFieldsRef、
 *     per-field Gating 逻辑。Scheduler 只剩 debounce + force flush。
 *  3) 支持 composition 事件(onCompositionStart / onCompositionEnd)
 *     和 debounced 操作(onDebouncedChange),withComposition 内部都会
 *     链式合并用户回调,业务 innerProps 直接传即可。
 *
 * ================================================================
 *  公共 API (SearchItemType 新增 number 对应 IMENumberInput)
 * ================================================================
 *
 *  interface SearchItemProps {
 *    type: SearchItemType        // input | number | textarea | select | date | range
 *    name: string | string[]
 *    formItemProps?: Form.Item 的 props
 *    innerProps?: Record<string, any>
 *      - 对 input/textarea/number: 额外支持 { debounce, onDebouncedChange }
 *        (withComposition / IMENumberInput 自动识别)
 *    children?: ReactNode
 *  }
 *
 * 【C1 保证】: 对外没有新增任何 enableIME / composition prop, IME 能力透明。
 * 【C3 保证】: 用户 onComposition* / onChange / onDebouncedChange 全部执行。
 * 【不吞 props 保证】: 所有 innerProps 原样 spread,不写任何默认 UI 属性。
 * 【开闭保证】: 新增 type 仍只需改 2 处(类型联合 + switch case)。
 */
import * as React from 'react'
import { Form, Select, DatePicker } from 'antd'
import type { FormItemProps } from 'antd'
import { IMEInput } from '@/components/IMEInput'
import { IMETextArea } from '@/components/IMETextArea'
import { IMENumberInput } from '@/components/IMENumberInput'

/* ------------------------------------------------------------------ */
/*  类型定义                                                           */
/* ------------------------------------------------------------------ */

/**
 * 支持的搜索控件类型(开闭原则:新增类型只需扩展这里 + switch 分支)。
 * 2026-08 新增 'number' → IMENumberInput。
 */
export type SearchItemType =
  | 'input'
  | 'number'
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
   *   - input    → antd InputProps   + { debounce?, onDebouncedChange? }
   *   - number   → antd InputNumberProps + { debounce?, onDebouncedChange? }
   *   - textarea → antd TextAreaProps + { debounce?, onDebouncedChange? }
   *   - select   → antd SelectProps
   *   - date     → antd DatePickerProps
   *   - range    → antd RangePickerProps
   *
   * 说明:
   *   debounce / onDebouncedChange 由 withComposition / IMENumberInput 内部
   *   useIMEComposition 支持, 业务可以直接用 innerProps={{ debounce:200,
   *   onDebouncedChange:v => ... }} 来做"搜索/远程校验"等非 Form 同步操作,
   *   而不需要再用 FormSearch 的输入即搜索。
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
/*  主组件                                                             */
/* ------------------------------------------------------------------ */

/**
 * SearchItem — 声明式搜索条件配置组件。
 *
 * 渲染结构:
 *   <Form.Item name={name} {...formItemProps}>
 *     { children ?? renderControl() }
 *   </Form.Item>
 */
export function SearchItem(props: SearchItemProps) {
  const { type, name, formItemProps, innerProps = {}, children } = props

  /* ---------- 控件分发(开闭:新增 type 在这里加 case) ---------- */
  const renderControl = (): React.ReactNode => {
    switch (type) {
      case 'input':
        // IMEInput = withComposition<HTMLInputElement, InputProps>(Input)
        // 业务 innerProps 里的 debounce / onDebouncedChange / onComposition*
        // 都由 withComposition 自身处理,全部透传。
        return <IMEInput {...innerProps} />
      case 'number':
        // IMENumberInput = 手写 useIMEComposition 封装的 InputNumber。
        // 透传 debounce / onDebouncedChange / onComposition*。
        return <IMENumberInput {...innerProps} />
      case 'textarea':
        // IMETextArea = withComposition<HTMLTextAreaElement, TextAreaProps>(Input.TextArea)
        return <IMETextArea {...innerProps} />
      case 'select':
        return <Select {...innerProps} />
      case 'date':
        return <DatePicker {...innerProps} />
      case 'range':
        return <DatePicker.RangePicker {...innerProps} />
      default:
        // 未知类型: TypeScript 应该在编译期拦住(联合类型 exhaustiveness check)。
        // 运行时兜底:开发环境 console.warn,生产环境返回 null。
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const isDev = (import.meta as any)?.env?.DEV
        if (typeof isDev === 'boolean' && isDev) {
          // eslint-disable-next-line no-console
          console.warn(
            `[SearchItem] 未知 type="${type}",请在 SearchItemType 联合类型与 switch 中增加对应分支。`,
          )
        }
        return null
    }
  }

  /*
   * 【AC-R7 保证】Form.Item 上绝对没有 onComposition* 事件。
   * composition 事件都在 IMEInput / IMETextArea / IMENumberInput
   * (真实 DOM 控件层)绑定,不污染 Form.Item。
   */
  return (
    <Form.Item name={name as FormItemProps['name']} {...formItemProps}>
      {children ?? renderControl()}
    </Form.Item>
  )
}
