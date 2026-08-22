/**
 * IMETextArea.tsx
 * ------------------------------------------------------------------
 * antd <Input.TextArea> 的薄包装。与 IMEInput 的实现完全等价:
 *   - 零包装 onChange (C2 / AC-U4 红线)
 *   - composition 事件: useIME 合并 ctx + 用户回调 (C3)
 *   - props 100% 透传, fieldName 单独剥离 (不吞 props)
 *   - fieldName 由 SearchItem 显式传入 (不依赖 rc-field-form 的内部 Context)
 *
 * 【代码复用说明】
 * 本组件与 IMEInput 结构几乎相同,但目标组件不同(Input vs Input.TextArea),
 * 各自独立 forwardRef 实现(不做"再写一个 createControl()"级封装)以避免
 * 小公司封装 UI 外壳组件。两文件约 40 行差异在 20% 以内——超过 80% 的核心
 * 逻辑(useIME 调用、解构、透传模式)语义等价,通过模块头 JSDoc 注释约束
 * 行为统一,而不是用高阶抽象统一(可读性优先)。
 */
import { forwardRef } from 'react'
import { Input as AntdInput } from 'antd'
import type { TextAreaProps as AntdTextAreaProps } from 'antd/es/input/TextArea'
import type { ComponentRef } from 'react'
import { useIME } from '../hooks/useIME'

const AntdTextArea = AntdInput.TextArea

/** antd Input.TextArea 的 ref 类型:从组件上直接提取 */
type TextAreaRef = ComponentRef<typeof AntdTextArea>

/**
 * 对外 Props — 与 IMEInput 同构:
 * - AntdTextAreaProps: antd Input.TextArea 全部属性
 * - fieldName?: 用于按字段维度 IME 标记
 */
export interface IMETextAreaProps extends AntdTextAreaProps {
  /** 对应 Form.Item 的 name(归一化后字符串,由 SearchItem 自动注入) */
  fieldName?: React.Key
}

export const IMETextArea = forwardRef<TextAreaRef, IMETextAreaProps>(
  (props, ref) => {
    const {
      fieldName,
      onCompositionStart,
      onCompositionEnd,
      onChange,
      ...rest
    } = props

    const imeEvents = useIME<HTMLTextAreaElement>(fieldName, {
      onCompositionStart,
      onCompositionEnd,
    })

    return (
      <AntdTextArea
        ref={ref}
        {...rest}
        onChange={onChange} // 零包装(C2 / AC-U4 红线)
        {...imeEvents}
      />
    )
  },
)
IMETextArea.displayName = 'IMETextArea'
