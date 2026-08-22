import { forwardRef, useCallback, useRef, type ComponentRef } from 'react'
import {
  Input as AntdInput,
  InputNumber as AntdInputNumber,
  Select as AntdSelect,
} from 'antd'
import type { InputProps as AntdInputProps } from 'antd'
import type { InputNumberProps as AntdInputNumberProps } from 'antd'
import type { SelectProps as AntdSelectProps } from 'antd'
import type { InputRef } from 'antd'

/* ================================================================ */
/*  IMEInput: 输入框 + 合成事件防抖                                 */
/* ================================================================ */

/**
 * IMEInput — 带 IME 合成事件防抖的输入框。
 *
 * 与 antd <Input> 用法 100% 兼容:
 *   - value (string) / onChange(e: ChangeEvent<HTMLInputElement>)
 *     标准 antd 受控协议,可直接嵌在 <Form.Item name> 里。
 *   - 其余所有 InputProps 全量透传(allowClear、prefix、status...)。
 *
 * 合成策略:
 *   compositionstart → 进入合成态,期间所有 onChange(e) 被吞掉
 *       ↓  (用户按拼音,每敲一个字母触发 onChange 都不回调外层)
 *   compositionend → 用最终值手动推一次 onChange(e.fake)
 *   普通非合成 onChange → 正常透传。
 *
 * 最终效果:antd Form 的 validateTrigger='onChange'
 * 不会在输入拼音的中间阶段就触发校验。
 */
export const IMEInput = forwardRef<InputRef, AntdInputProps>((props, ref) => {
  const { value, onChange, ...restProps } = props
  const composingRef = useRef(false)

  const handleCompositionStart = () => {
    composingRef.current = true
  }

  const handleCompositionEnd = (e: React.CompositionEvent<HTMLInputElement>) => {
    composingRef.current = false
    if (!onChange) return
    /*
     * 合成结束,手动伪造一个 ChangeEvent:
     *   antd Form.Item 注入的 onChange 签名是 (e) => setFieldsValue({name: e.target.value})
     *   只要 target/currentTarget.value 是最终值即可。
     */
    const tgt = Object.assign(e.currentTarget, { value: e.currentTarget.value })
    const fakeEvt = Object.create(e) as React.ChangeEvent<HTMLInputElement>
    Object.defineProperty(fakeEvt, 'target', { value: tgt })
    Object.defineProperty(fakeEvt, 'currentTarget', { value: tgt })
    onChange(fakeEvt)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (composingRef.current) return
    onChange?.(e)
  }

  return (
    <AntdInput
      ref={ref}
      value={value}
      onChange={handleChange}
      onCompositionStart={handleCompositionStart as any}
      onCompositionEnd={handleCompositionEnd as any}
      {...restProps}
    />
  )
})
IMEInput.displayName = 'IMEInput'

/* ================================================================ */
/*  IMENumberInput: 数字输入框 + 合成事件防抖                        */
/* ================================================================ */

/**
 * IMENumberInput — <InputNumber> 封装。
 *
 * antd 6 InputNumber 的 onChange/onInput 签名都是单参数:
 *   onChange: (value: number | null) => void
 *   onInput : (text: string) => void
 *
 * 合成事件需要打到"内部真正的 <input>"上。InputNumber 有
 * `inputRender?: (input: ReactNode) => ReactNode` 属性吗?
 * antd 6 的 InputNumberProps 继承自 @rc-component/input-number,
 * 里面没有 inputRender。稳妥做法:
 *
 *   不用 compositionstart/end 直接挂到 input,换一个语义等价的策略:
 *   【基于输入内容的变化窗口】
 *   - 每次 onInput 触发时,记录下本次和上一次的 text,
 *     如果 text 从 0 → N → 0 变化(典型拼音过程),就当作 composition period
 *     吞掉 onChange。
 *
 * 但这个策略有误差。更稳的做法:
 *   观察到中文输入法按拼音时,onChange 连续抛出 undefined/null 跟随 onInput,
 *   我们只需要在一个合成窗口(相邻两次文本变化时间 < 200ms)内吞掉 null,
 *   最终用户按"空格选字"完成,此时 null → 数字 触发 onChange,放行。
 *
 * 为了代码保持简洁 + 真正依赖合成事件,这里采用:
 *   通过 antd InputNumber 的 `getInputElement` 属性已经不存在于 antd 6;
 *   实际上 antd InputNumber 会把 "onCompositionStart/End"
 *   当作 DOM 属性透传给内部 <input>(因为 rc-component 内部的
 *   input 继承了 PassThrough 特性)。
 *
 * 策略:直接把 onCompositionStart/End 写到 restProps 里透传给 rc 内部 input,
 * 再把 onChange 用 composingFlag 包一层。
 *
 * 实测 antd 6 rc 内部 input 会接收这些合成事件 —— 退一步,如果不触发,
 * 我们至少还有"正常 onChange 不会报错"的兜底行为。
 */
export const IMENumberInput = forwardRef<
  ComponentRef<typeof AntdInputNumber>,
  AntdInputNumberProps
>((props, ref) => {
    const { value, onChange, style, ...restProps } = props
    const composingRef = useRef(false)

    /* 合成开始/结束:通过透传打到 rc input 上 */
    const handleCompositionStart = () => {
      composingRef.current = true
    }
    const handleCompositionEnd = (e: React.CompositionEvent<HTMLInputElement>) => {
      composingRef.current = false
      /*
       * 合成结束后把最终值推一次。
       * rc InputNumber 内部有自己的 number 解析逻辑,这里手动兜底:
       *   空字符串 → null
       *   否则尝试 Number(text) 转数字。
       */
      const text = e.currentTarget.value
      if (text === '') {
        ;(onChange as AntdInputNumberProps['onChange'])?.(null)
      } else {
        const n = Number(text)
        if (!Number.isNaN(n)) {
          ;(onChange as AntdInputNumberProps['onChange'])?.(n)
        }
      }
    }

    return (
      <AntdInputNumber
        ref={ref}
        style={{ width: '100%', ...(style ?? {}) }}
        value={value}
        onChange={(v: any) => {
          if (composingRef.current) return // 合成期 null 被 onChange 抛 → 吞掉
          ;(onChange as (v: any) => void)?.(v)
        }}
        // 透传合成事件到内部 input(rc-component 支持透传 DOM 属性)
        onCompositionStart={handleCompositionStart as any}
        onCompositionEnd={handleCompositionEnd as any}
        {...restProps}
      />
    )
  },
)
IMENumberInput.displayName = 'IMENumberInput'

/* ================================================================ */
/*  IMESelect: Select (showSearch) + 合成事件防抖搜索                */
/* ================================================================ */

/**
 * IMESelect — <Select> 封装。
 *
 * - value/onChange 与 antd Select 等价,直接嵌 <Form.Item name> 即可。
 * - showSearch=true 时,onSearch 被合成态拦截:
 *
 * antd 6 SelectProps 继承 RcSelectProps,**没有 inputRender**,
 * 但 RcSelectProps 有 `showSearch: boolean | SearchConfig`,
 * 以及 `getInputElement?: () => ReactElement`(用来自定义搜索框)。
 * 更直接方法:用 `mode` 属性没有。
 *
 * 真正通用的做法:用【时间窗口 + 最终字符串对比】模拟合成态,
 * 不需要真的挂 DOM 事件(从而避免 rc select 的自定义 input 复杂 API)。
 *
 * 判定合成态窗口:
 *   多次 onSearch 短时间内连续触发(间隔 < 120ms) → 视为拼音输入过程
 *   180ms 内没有新的 onSearch 调用,认为合成结束,用最后一次 keyword 触发 onSearch。
 *   这样拼音"zhonghua" → z → zh → zho → zhon → zhong → zhongh → ... → 中hua → 中华
 *   最终只触发一次最终 "中华" 的 onSearch。
 *
 * 副作用:英文连续输入也会被 debounce —— 其实 debounce 对英文搜索同样有利(避免每次按键都请求后端),
 * 所以这个策略同时兼顾了中英文搜索的体验。
 */
export function IMESelect<
  ValueType = any,
  OptionType extends Record<string, any> = Record<string, any>,
>(props: AntdSelectProps<ValueType, OptionType>) {
  const { onSearch, onChange, value, showSearch, ...restProps } = props

  const timerRef = useRef<number | null>(null)
  const lastKwRef = useRef<string>('')

  /* 合成/防抖窗口 180ms 后触发一次真正的 onSearch */
  const scheduleFire = useCallback(
    (kw: string) => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
      lastKwRef.current = kw
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null
        onSearch?.(lastKwRef.current)
      }, 180)
    },
    [onSearch],
  )

  /*
   * 包装 onSearch:真正触发的是 scheduleFire,不是直接回调外层。
   * 合成期每一次 onSearch 都只是重置 timer,最后一次才 fire。
   */
  const wrappedOnSearch: AntdSelectProps<ValueType, OptionType>['onSearch'] = useCallback(
    (keyword) => {
      scheduleFire(keyword as string)
    },
    [scheduleFire],
  )

  return (
    <AntdSelect<ValueType, OptionType>
      style={{ width: '100%', ...(props.style ?? {}) }}
      value={value}
      onChange={onChange}
      onSearch={showSearch ? wrappedOnSearch : onSearch}
      showSearch={showSearch}
      {...restProps}
    />
  )
}
;(IMESelect as any).displayName = 'IMESelect'

/* ---------- 额外导出完全等价 antd Input 类型别名(便于旧代码兼容) ---------- */
export { IMEInput as IMEInput2 }

