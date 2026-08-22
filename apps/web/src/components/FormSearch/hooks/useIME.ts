/**
 * useIME.ts
 * ------------------------------------------------------------------
 * 把 IMEContext 的合成事件 + 用户自定义事件包装成一组可直接
 * `<input onCompositionStart={...} onCompositionEnd={...} />` 展开
 * 的 handler 对。
 *
 * 【单一职责:不碰 onChange】(关键约束 C2 / AC-U4)
 * 此 Hook 只包装 composition 事件,不包装 onChange。
 * 设计原则:IME 合成期的中间值也要让 Form.Item 的 value 实时更新(保证
 * 用户输入一半时切换 tab 回来,拼音内容还在),所以**绝对不能**
 * `if (composing) return` 式 onChange 拦截。
 * 搜索调度的抑制在 FormSearch scheduleSearch 的 gating 逻辑中完成,
 * 不在此 Hook 层完成。(职责分离)
 *
 * 【两段式事件合并:先 ctx 再用户】(约束 C3)
 * 1. onCompositionStart:
 *      ime.startComposition(fieldName) → 再执行用户 onCompositionStart(e)
 * 2. onCompositionEnd:
 *      ime.notifyCompositionEnd(fieldName) → 再执行用户 onCompositionEnd(e)
 * 两段中间不吞异常:用户回调抛错时,仍保证 ctx 逻辑已执行(先调用 ctx 再
 * 调用用户)。但 ctx 自己是纯 Set 操作不会抛错。
 *
 * 【优雅降级:无 Provider 时也能跑】(NFR-2 鲁棒性 / T2-R3)
 * 有时 IMEInput / IMETextArea 会被单独拿出来用(不在 FormSearch 内,
 * 没有 IMEContext.Provider)。这时:
 *   - IME 功能(搜索调度抑制)无法启用(合理),
 *   - 但组件本身仍要正常挂载、用户合成事件回调仍正常执行(不能抛错)。
 * 实现方式:ctx === null 时返回的 handler 只执行用户回调。
 *
 * 【引用稳定性】
 * 返回的 onCompositionStart / onCompositionEnd 都用 useCallback 包装,
 * 依赖是 ctx、fieldName、用户回调。在 React.StrictMode 的双重 mount
 * 下也不会因为函数引用变化造成额外 effect。
 */
import { useCallback, useContext } from 'react'
import type { CompositionEventHandler } from 'react'
import { IMEContext } from '../contexts/IMEContext'

export interface UseIMEOptions<T extends HTMLInputElement | HTMLTextAreaElement> {
  /** 业务层 innerProps 传入的自定义合成开始回调 */
  onCompositionStart?: CompositionEventHandler<T>
  /** 业务层 innerProps 传入的自定义合成结束回调 */
  onCompositionEnd?: CompositionEventHandler<T>
}

export interface UseIMEResult<T extends HTMLInputElement | HTMLTextAreaElement> {
  onCompositionStart: CompositionEventHandler<T>
  onCompositionEnd: CompositionEventHandler<T>
}

/**
 * useIME —— 获取当前 fieldName 的 composition 事件处理器。
 *
 * @param fieldName 对应 Form.Item 的 name(已 normalize 后的值,字符串最佳)。
 *                  可以为 undefined;这时仅在 ctx 存在时按"空字段名"操作,
 *                  不会阻塞别的字段(因为 isComposing(undefined) 与其他字段隔离)。
 * @param opts      用户回调(来自 innerProps.onCompositionStart/End)。
 */
export function useIME<T extends HTMLInputElement | HTMLTextAreaElement>(
  fieldName: React.Key | undefined,
  opts: UseIMEOptions<T> = {},
): UseIMEResult<T> {
  const ctx = useContext(IMEContext)
  const { onCompositionStart: userStart, onCompositionEnd: userEnd } = opts

  /* ---------- onCompositionStart ---------- */
  const handleStart: CompositionEventHandler<T> = useCallback(
    (e) => {
      // 1) 更新 IME 状态
      if (ctx && fieldName !== undefined) {
        ctx.startComposition(fieldName)
      }
      // 2) 用户回调(如果有)——与 ctx 独立,不吞异常
      userStart?.(e)
    },
    [ctx, fieldName, userStart],
  )

  /* ---------- onCompositionEnd ---------- */
  const handleEnd: CompositionEventHandler<T> = useCallback(
    (e) => {
      // 1) 通知完成 + queueMicrotask 重新调度搜索(内部会 endComposition)
      if (ctx && fieldName !== undefined) {
        ctx.notifyCompositionEnd(fieldName)
      }
      // 2) 用户回调
      userEnd?.(e)
    },
    [ctx, fieldName, userEnd],
  )

  return {
    onCompositionStart: handleStart,
    onCompositionEnd: handleEnd,
  }
}
