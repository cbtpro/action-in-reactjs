import { useCallback, useRef, type ChangeEventHandler, type CompositionEventHandler } from 'react'

/**
 * useComposition —— 处理中文/日文等输入法的 IME 合成事件。
 *
 * 背景:
 *   当用户使用输入法输入中文时,浏览器会连续触发多轮 onChange(比如输入 "zhong"
 *   过程中会有多个中间拼音值)。如果 antd Form 的 validateTrigger='onChange',
 *   这些中间值会被当作有效值提交校验,导致"输入到一半就出现校验错误"。
 *
 *   合成事件(CompositionEvent)解决了这个问题:
 *   - compositionstart:用户开始按拼音(输入尚未最终确定)
 *   - compositionupdate:拼音变化
 *   - compositionend:用户按空格/回车选字、或点其他地方完成输入(值最终确定)
 *
 * 策略:
 *   compositionstart → 进入"合成态",期间所有 onChange 都吞掉不回调外层;
 *   compositionend → 退出"合成态",并立即用最终值回调一次 onChange(保证最终值上报);
 *   非合成态的普通 onChange → 正常透传。
 *
 * 返回值:
 *   - handlers: 对象包含 onCompositionStart / onCompositionEnd / onInputChange(包装后的 ChangeHandler)
 *     直接展开到原生 <input> 或派生组件上即可。
 *   - wrapOnChange:高阶包装器,接收任意 (value: string) => void,返回一个
 *     "合成态不触发"的新函数(适用于 antd Form.Item 注入的 onChange:它的参数是 string)。
 *   - isComposing:当前是否处于合成态(查询用,不推荐写进业务渲染)。
 *
 * 设计:
 *   - 纯 hook,不依赖组件库(antd 以外的任何 UI 库都能用)
 *   - 不接管 value,不影响受控/非受控两种模式(value 仍由父组件/Form 管)
 *   - 单一职责:只做 IME 合成防抖,不混入校验或格式化逻辑
 */
export function useComposition(initialOnChange?: (nextValue: string) => void) {
  /*
   * 合成态标记用 ref(不参与重渲染):
   *   - compositionstart 置 true
   *   - compositionend 置 false
   *   - 所有 onChange 先读 ref,合成期直接 return
   */
  const composingRef = useRef(false)
  const onChangeRef = useRef(initialOnChange)
  onChangeRef.current = initialOnChange

  /* ----- 1. 合成事件处理 ----- */

  const handleCompositionStart: CompositionEventHandler<HTMLElement> = useCallback(() => {
    composingRef.current = true
  }, [])

  const handleCompositionEnd: CompositionEventHandler<HTMLElement> = useCallback((e) => {
    composingRef.current = false
    /*
     * 合成结束后,把最终值主动推一次给外部 onChange:
     *   某些浏览器/输入法的 compositionend 触发后,
     *   对应的原生 input/change 事件可能不触发或顺序不一致,
     *   这里用 currentTarget.value 主动上报一次,保证永远不丢值。
     */
    const finalValue = (e.currentTarget as unknown as { value?: string }).value
    if (typeof finalValue === 'string') {
      onChangeRef.current?.(finalValue)
    }
  }, [])

  /* ----- 2. 包装原生 input 的 ChangeEventHandler(给 <input>/<textarea> 直接用) ----- */

  const onInputChange: ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement> = useCallback(
    (e) => {
      if (composingRef.current) return // 合成期吞掉
      onChangeRef.current?.(e.target.value)
    },
    [],
  )

  /* ----- 3. wrapOnChange:包装 (value: string) => void 类型的回调 ----- */

  const wrapOnChange = useCallback(function wrap<T extends (nextValue: string) => void>(
    fn: T | undefined,
  ): T | undefined {
    if (!fn) return fn
    return ((nextValue: string) => {
      if (composingRef.current) return
      fn(nextValue)
    }) as T
  }, [])

  /*
   * 语义化返回: handlers 直接 JSX 展开;wrapOnChange 用于 Form.Item 注入的 onChange(参数是 value);
   * onInputChange 用于原生 input 的 e.target.value 场景。
   */
  return {
    handlers: {
      onCompositionStart: handleCompositionStart,
      onCompositionEnd: handleCompositionEnd,
      onChange: onInputChange,
    },
    wrapOnChange,
    isComposing: () => composingRef.current,
  } as const
}
