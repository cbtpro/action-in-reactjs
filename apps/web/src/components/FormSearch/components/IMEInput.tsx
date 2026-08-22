/**
 * IMEInput.tsx
 * ------------------------------------------------------------------
 * antd <Input> 的薄包装,专为 FormSearch 场景下的 IME 合成事件处理。
 *
 * ================================================================
 * 【最重要的约束】:绝对不能重包装 onChange！                  =
 * ================================================================
 *
 * Form.Item(rc-field-form) 注入的 onChange 是 antd Form 受控协议的核心:
 *   <Form.Item name="keyword">
 *     <Input onChange={form_injected_onChange} />
 *   </Form.Item>
 *
 * form_injected_onChange 被 IMEInput 替换(或包一层`if (composing) return`)
 * 会导致 RCFieldFormStore 的 value 无法在合成期实时写入。
 * 表现:用户按了拼音"bei jing",中间"bei"的值无法留在输入框中(切tab回来就丢)
 * 或者光标位置异常/候选词消失。这是约束 C2 / AC-R2 / AC-U4 的红线。
 *
 * 因此 IMEInput 除了 composition 事件在末尾额外包一层 useIME 注入外,
 * onChange 100% 原样透传给 antd <Input>。
 *
 * 【IME 抑制在哪里做?】
 * 不在此组件做。FormSearch 的 scheduleSearch 在检查"本次 changed 字段
 * 是否处于合成中"时才决定是否跳过,不污染数据链路(职责分离)。
 *
 * 【事件合并 C3】
 * innerProps 可能传入 onCompositionStart / onCompositionEnd 自定义回调。
 * useIME 会先 ctx → 再 user callback(链式调用),保证两边都会执行。
 * 如果 innerProps 还传了 onChange?直接给 AntdInput—— 它会和
 * Form.Item 注入的 onChange 合并(antd Form.Item 的 onChange 机制会
 * 自动 merge inner onChange(通过 Form.Item 内部包装)。具体:
 *   antd <Form.Item> 在渲染子组件时会 cloneElement,把子组件原 onChange
 *   与 rc-field-form 真正的 store 写入组合成一个新 onChange,
 *   所以用户 innerProps.onChange 本来就会执行(Form.Item 保证),
 *   IMEInput 完全不用管。
 *
 * 【fieldName 显式传入(替代 FieldContext)】
 * 设计说明:之前方案打算用 rc-field-form 的 FieldContext.namePath 自动
 * 推断 namePath,但 rc-field-form 属于 antd 内部依赖,不保证作为公共 API
 * 可用。更稳的方式是, SearchItem 构造组件时显式把 normalizeName(name)
 * 作为 fieldName 传入。这样:
 *   - 不依赖 rc-field-form 内部 API,升级 antd 时无风险;
 *   - 代码更易读、可追溯;
 *   - IMEInput 独立使用时,调用方也清楚该传什么。
 * fieldName 缺失时:IME 功能静默退化(不启用 gating)但组件正常挂载。
 *
 * 【props 透传 & 不吞 UI 组件 props】
 * 遵循 "小公司不要盲目封装 UI 组件" 原则:除了我们的 IME 机制必须
 * 用到的 onCompositionStart / onCompositionEnd 在尾部通过 imeEvents
 * 覆盖, 其余 InputProps 100% 透传;不做任何默认 onChange/placeholder/style
 * 的赋值,避免覆盖业务传值。fieldName 单独剥离,不写入 antd Input
 * (会变成 DOM 多余属性 → 控制台 warning)。
 */
import { forwardRef } from 'react'
import { Input as AntdInput } from 'antd'
import type { InputProps as AntdInputProps, InputRef } from 'antd'
import { useIME } from '../hooks/useIME'

/**
 * 对外暴露的 Props。
 * - AntdInputProps: antd Input 全部属性(100% 透传)。
 * - fieldName?: 对应 Form.Item 的 name(归一化后字符串最佳,用于按字段维度 IME 标记)。
 */
export interface IMEInputProps extends AntdInputProps {
  /**
   * 对应 Form.Item 的 name(归一化后的形式)。
   * SearchItem 会自动把 `name` / `name.a.0` / `['name','a',0]` 统一成
   * 字符串后填入,这里无需业务层操心。
   */
  fieldName?: React.Key
}

export const IMEInput = forwardRef<InputRef, IMEInputProps>((props, ref) => {
  /*
   * 剥离:
   *   fieldName → 留给 useIME,不传给 antd Input(避免 DOM 属性警告)
   *   onCompositionStart/onCompositionEnd → 交给 useIME 合并 ctx + 用户
   *   onChange → 取出后显式传给 AntdInput(声明式,防止未来有人加 if(composing) return 包装)
   *   ...rest → antd Input 其余属性原样透传
   */
  const {
    fieldName,
    onCompositionStart,
    onCompositionEnd,
    onChange,
    ...rest
  } = props

  /* composition 事件:ctx + 用户 链式合并 */
  const imeEvents = useIME<HTMLInputElement>(fieldName, {
    onCompositionStart,
    onCompositionEnd,
  })

  return (
    <AntdInput
      ref={ref}
      // ---- antd 原生属性原样透传 ----
      {...rest}
      // ---- 显式 onChange:零包装(C2 / AC-U4 红线) ----
      onChange={onChange}
      // ---- composition 事件在末尾,保证 IME 包装生效 ----
      {...imeEvents}
    />
  )
})
IMEInput.displayName = 'IMEInput'
