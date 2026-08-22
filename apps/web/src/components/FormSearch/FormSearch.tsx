/**
 * FormSearch.tsx
 * ------------------------------------------------------------------
 * 通用搜索表单容器:声明式搜索条件配置 + 输入即搜索 + debounce +
 * IME composition 期间抑制中间搜索请求。
 *
 * ================================================================
 *  架构(与 spec 章节最终架构图完全对齐)
 * ================================================================
 *
 * ┌────────────────────────────────────────────────────────────┐
 * │ FormSearch                                                 │
 * │  ┌────────────────────────────────────────────────────┐    │
 * │  │ scheduleSearch(opts) 统一入口                      │    │
 * │  │  ├ force=false / changedFields=[...]                │    │
 * │  │  │    ├ changed 字段在 composing? → return (跳过)  │    │
 * │  │  │    └ otherwise → debounce → flush onSearch      │    │
 * │  │  ├ force=true                                       │    │
 * │  │  │    ├ cancel timer                                 │    │
 * │  │  │    └ sync flush → onSearch                        │    │
 * │  └────────────────────────────────────────────────────┘    │
 * │                                                            │
 * │  IMEContext.Provider                                       │
 * │       ↓                                                    │
 * │  <Form layout="inline">                                    │
 * │       ↓                                                    │
 * │  children(SearchItem)                                      │
 * │       ↓ (Form.Item 下是 IMEInput/IMETextArea)             │
 * │  composition 事件 → IMEContext.startComposition / notify  │
 * │                                                            │
 * │  操作按钮栏:查询(submit → force=true) / 重置(force=true)   │
 * │                 + extra(业务自定义按钮)                    │
 * └────────────────────────────────────────────────────────────┘
 *
 * ================================================================
 *  三条链路如何走到 scheduleSearch(统一入口设计,避免重复请求)
 * ================================================================
 *
 * 链路 A: 输入即搜索 onValuesChange(普通字段变更 / IME 合成期 onChange)
 *    Object.keys(changedValues) → scheduleSearch(force=false, changedFields=keys)
 *
 * 链路 B: compositionend(用户选字完成)
 *    IMEInput → useIME → ctx.notifyCompositionEnd(name)
 *                         ↓ endComposition(name) +
 *                         ↓ queueMicrotask →
 *                           scheduleSearch(force=false, changedFields=[name])
 *
 * 链路 C: 查询按钮 submit / 重置 / 外部 imperative
 *    onFinish / handleReset → scheduleSearch(force=true) 立即 flush
 *
 * 所有三条链路都汇入同一个 debounceTimerRef,因此:
 *  - A+B 紧接触发时:两次 scheduleSearch 会合并为最后一次执行(debounce cancel
 *    前一次) → 不产生两次请求(解决 AC-R4 compositionend + onChange 重复搜索)。
 *  - C 打断 A 或 B 的等待:force=true 会取消待定的 timer,立即 flush。
 *
 * ================================================================
 *  精确字段级 IME Gating (Spec Q1 决策)
 * ================================================================
 * 之前简单策略「任一 composing 就禁止全部搜索」会导致:
 *   姓名 IME 输入中 → 用户顺手切换"角色"下拉 → 角色的正常 onChange 也被阻塞。
 *
 * 改为精确策略:
 *   只有当 changedFields.some(f => ime.isComposing(f)) 时才跳过本次调度。
 *   非 changed 的字段即使在 composing,也不影响其他字段的变更。
 *   changedFields === undefined 时退化为全局 hasComposing() 判断(兜底兼容)。
 *
 * ================================================================
 *  force=true (查询按钮 / 重置) 为什么要忽略 composing?
 * ================================================================
 * 如果用户点击「查询」按钮时,某个输入框恰好卡在 composition 中间态
 * (比如输入法忘选字就点了按钮),我们认为用户想"按当前页面输入框里展示的
 * 内容搜索"(而不是考虑 IME 状态)。按用户意志更重要 → force=true
 * 跳过 composing gating。
 *
 * ================================================================
 *  组件卸载清理 (AC-R8)
 * ================================================================
 * debounceTimerRef.current 在 useEffect return 里清理,避免:
 *   打开 /list → 立刻切走路由 → timer 到点后对已卸载组件 setState / 调 onSearch。
 */
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react'
import type { ReactNode } from 'react'
import { Button, Form, Space } from 'antd'
import type { FormInstance, FormProps } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import {
  IMEContext,
  createIMEController,
} from './contexts/IMEContext'

/* ------------------------------------------------------------------ */
/*  Props 类型                                                         */
/* ------------------------------------------------------------------ */

export interface FormSearchProps<T extends object = Record<string, any>> {
  /**
   * 外部传入 antd Form instance。不传入则内部 Form.useForm() 自动创建。
   * 典型用法:
   *   const [f] = Form.useForm<QueryForm>()
   *   <FormSearch<QueryForm> form={f} onSearch={() => ...}>...</FormSearch>
   *   const values = f.getFieldsValue()  // 其他地方可随时取 values
   */
  form?: FormInstance<T>

  /**
   * 搜索执行回调。当应该发起一次真实搜索时调用。
   * 注意:本组件自身不处理分页、不调用具体业务 API。
   *      搜索条件通过 values 形参直接给出,或业务侧 form.getFieldsValue() 拿。
   *
   * 例:
   *   onSearch={(values) => {
   *     console.log('搜索条件:', values)
   *     setPage(1)  // page 归位到 1,effect 中 [page, pageSize] 触发请求
   *   }}
   */
  onSearch: (values: T) => void

  /** 输入即搜索的 debounce 毫秒数(只影响 force=false 的路径)。默认 280ms。 */
  debounceMs?: number

  /**
   * true: onValuesChange → scheduleSearch(force=false)  (输入即搜索)
   * false: 仅查询按钮 / 重置按钮 → force=true 才搜索 (传统表单搜索)
   * 默认 true。
   */
  triggerOnChange?: boolean

  /** 查询按钮文案,默认 "查询"。 */
  submitText?: ReactNode

  /** 是否显示重置按钮,默认 true。 */
  showResetButton?: boolean

  /** 查询按钮(如果有)的额外 props(如 loading、disabled)。 */
  submitButtonProps?: React.ComponentProps<typeof Button>

  /** 重置按钮(如果有)的额外 props。 */
  resetButtonProps?: React.ComponentProps<typeof Button>

  /**
   * 操作按钮栏右侧自定义内容。常见用法:放「新增」「导出」按钮。
   *   extra={<Button type="primary" onClick={...}>新增</Button>}
   */
  extra?: ReactNode

  /**
   * 透传给 antd <Form> 的其余 props(layout 属性除外:强制 inline,避免排版破坏)。
   */
  formProps?: Omit<FormProps<T>, 'form' | 'onFinish' | 'onValuesChange' | 'layout'>
}

/* ------------------------------------------------------------------ */
/*  FormSearch 暴露给外部的 imperative handle                          */
/* ------------------------------------------------------------------ */

export interface FormSearchHandle<T extends object = Record<string, any>> {
  /** 触发一次 force=true 搜索(立即 flush,效果等同于点查询按钮)。 */
  submit: () => void
  /** 重置字段 + force 搜索。效果等同于点重置按钮。 */
  reset: () => void
  /** 透传 FormInstance。等价于把 form prop 从外部拿进来的引用。 */
  getForm: () => FormInstance<T>
}

/* ------------------------------------------------------------------ */
/*  主组件                                                             */
/* ------------------------------------------------------------------ */

interface FormSearchInnerProps<T extends object> extends FormSearchProps<T> {
  children?: ReactNode
  // 内部使用 Form.useForm 的结果:保证即使没有传 form prop,也能在 FC 顶层调用 hook
  // (按 React Hooks 规则,在条件里不能调用。所以我们在最外层非泛型包装里先调用)
  internalForm: FormInstance<T>
}

/**
 * 内层真实实现(非泛型包装在底部,用于满足 Form.useForm 在顶层调用 Hook 规则)。
 */
function FormSearchInner<T extends object>(
  props: FormSearchInnerProps<T>,
  ref: React.ForwardedRef<FormSearchHandle<T>>,
) {
  const {
    internalForm: form,
    onSearch,
    debounceMs = 280,
    triggerOnChange = true,
    submitText = '查询',
    showResetButton = true,
    submitButtonProps,
    resetButtonProps,
    extra,
    formProps,
    children,
  } = props

  /* ---------- debounce 调度基础设施 ---------- */
  const debounceTimerRef = useRef<number | null>(null)
  const composingFieldsRef = useRef<Set<React.Key>>(new Set())

  /*
   * 【循环依赖破局说明】
   *   scheduleSearch 依赖 IME 状态做 gating,而 IMEContext.notifyCompositionEnd
   *   依赖 scheduleSearch 做合成完成后的重新调度。
   * 解法:把 IME 状态(Set<React.Key>)和 scheduleSearch 都放到同一层闭包里,
   * 通过 composingFieldsRef 共享 IME 状态。IMEContext 的 startComposition /
   * endComposition / notifyCompositionEnd 直接操作 composingFieldsRef 并在
   * notifyCompositionEnd 内部调用 scheduleSearch。这样就不需要两个对象互相持有引用。
   *
   * composingFieldsRef 是 Set,变更不会触发 React re-render → 零重渲染性能保证。
   */

  const scheduleSearch = useCallback(
    function scheduleSearch(opts: {
      force: boolean
      changedFields?: React.Key[]
    }): void {
      const { force, changedFields } = opts

      /*
       * ---- 1) IME gating (仅 force=false 生效) ----
       * 按 Spec Q1 精确字段级判断:changedFields 里任意一个 composing 才跳过。
       * 目的: A 字段正在 IME 中,B 字段正常 Select → B 变更应正常触发搜索。
       */
      if (!force) {
        const composingSet = composingFieldsRef.current
        if (changedFields && changedFields.length > 0) {
          const anyInIME = changedFields.some((f) => composingSet.has(f))
          if (anyInIME) return
        } else if (composingSet.size > 0) {
          // 兜底:没有 changedFields 信息时保守跳过(理论路径上不会发生)。
          return
        }
      }

      /* ---- 2) debounce 处理 ---- */
      // 先清掉上次待定的 timer(避免两条链路紧接触发时执行两次)。
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }

      // flush 闭包:调用 form.getFieldsValue(true) + onSearch(values)
      // 放在此处声明,确保取到的值是 debounce delay 到期那一刻的最新值。
      const flush: () => void = () => {
        const values = form.getFieldsValue(true) as T
        onSearch(values)
      }

      if (force) {
        // force: 查询按钮 / 重置 / imperative submit,立即 flush
        flush()
        return
      }

      // 非 force: 输入即搜索 / compositionend 重新调度,统一走 debounce
      const delay = Math.max(0, debounceMs | 0)
      if (delay === 0) {
        flush()
        return
      }
      debounceTimerRef.current = window.setTimeout(() => {
        debounceTimerRef.current = null
        flush()
      }, delay)
    },
    [form, onSearch, debounceMs],
  )

  /* ---------- IME 控制器(操作共享的 composingFieldsRef + 调 scheduleSearch) ---------- */
  const imeController = useMemo<ReturnType<typeof createIMEController>>(() => {
    const defer =
      typeof queueMicrotask === 'function'
        ? queueMicrotask.bind(undefined)
        : (fn: () => void) => window.setTimeout(fn, 0)
    return {
      startComposition(name) {
        composingFieldsRef.current.add(name)
      },
      endComposition(name) {
        composingFieldsRef.current.delete(name)
      },
      isComposing(name) {
        return composingFieldsRef.current.has(name)
      },
      hasComposing() {
        return composingFieldsRef.current.size > 0
      },
      notifyCompositionEnd(name) {
        /*
         * 时序保证:先 endComposition(name),再 defer → scheduleSearch
         * 如果在 defer 之后才 endComposition, scheduleSearch gating 时
         * composingSet.has(name) 仍然为 true → 本次调度被吞掉,严重 bug。
         */
        composingFieldsRef.current.delete(name)
        defer(() => {
          scheduleSearch({ force: false, changedFields: [name] })
        })
      },
    }
  }, [scheduleSearch])

  /* ---------- 卸载清理:清理待定 debounce timer ---------- */
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }
    }
  }, [])

  /* ---------- Form 三条链路回调 ---------- */

  const handleValuesChange = useCallback<
    NonNullable<FormProps<T>['onValuesChange']>
  >(
    (_changedValues, _allValues) => {
      if (!triggerOnChange) return
      // changedFields:顶层 key 足够(不深入嵌套对象的内部 key,因为 IME 输入只在顶层字段)。
      const changedFields: React.Key[] = Object.keys(_changedValues as object)
      scheduleSearch({ force: false, changedFields })
    },
    [scheduleSearch, triggerOnChange],
  )

  const handleFinish = useCallback(() => {
    scheduleSearch({ force: true })
  }, [scheduleSearch])

  const handleReset = useCallback(() => {
    form.resetFields()
    scheduleSearch({ force: true })
  }, [form, scheduleSearch])

  /* ---------- imperative handle 暴露给父组件 ---------- */
  useImperativeHandle(
    ref,
    (): FormSearchHandle<T> => ({
      submit: handleFinish,
      reset: handleReset,
      getForm: () => form,
    }),
    [handleFinish, handleReset, form],
  )

  /* ---------- 渲染 ---------- */
  return (
    <IMEContext.Provider value={imeController}>
      <Form<T>
        form={form}
        layout="inline"
        onValuesChange={handleValuesChange}
        onFinish={handleFinish}
        {...(formProps as FormProps<T>)}
      >
        {children}

        {/* 操作按钮栏:固定在 Form 最后。外层 <Form.Item> 套一下,与其他
            SearchItem 的 Form.Item 间距对齐(layout=inline 时它们会自动流式排列) */}
        <Form.Item>
          <Space size="middle" wrap>
            <Button
              type="primary"
              htmlType="submit"
              {...submitButtonProps}
            >
              {submitText}
            </Button>
            {showResetButton && (
              <Button
                onClick={handleReset}
                icon={<ReloadOutlined />}
                {...resetButtonProps}
              >
                重置
              </Button>
            )}
            {extra}
          </Space>
        </Form.Item>
      </Form>
    </IMEContext.Provider>
  )
}

const FormSearchInnerForwardRaw = forwardRef(FormSearchInner)
const FormSearchInnerForward = FormSearchInnerForwardRaw as <
  T extends object,
>(
  props: FormSearchInnerProps<T> & {
    ref?: React.ForwardedRef<FormSearchHandle<T>>
  },
) => ReturnType<typeof FormSearchInner>
;((
  FormSearchInnerForwardRaw as unknown as { displayName?: string }
).displayName = 'FormSearchInner')

/* ------------------------------------------------------------------ */
/*  外层泛型包装:保证 Form.useForm 在 Hook 顶层调用                    */
/* ------------------------------------------------------------------ */

/**
 * FormSearch — 通用搜索表单容器。
 *
 * 功能:
 *  - 声明式 SearchItem 配置搜索字段
 *  - 输入即搜索 + debounce
 *  - 中文 IME composition 期间抑制中间请求,compositionend 后 1 次请求
 *  - 查询 / 重置 / 新增按钮(extra)标准操作栏
 *  - force flush:按钮点击立即查询,不等待 debounce
 *  - 精确字段级 IME gating:不阻塞其他字段正常变更触发的搜索
 */
export function FormSearch<T extends object = Record<string, any>>(
  props: FormSearchProps<T> & { children?: ReactNode; ref?: React.ForwardedRef<FormSearchHandle<T>> },
) {
  // React Hook 规则:必须在顶层调用。这里始终调用,内部判断没传 form prop 时就用这个内部实例。
  const [internalForm] = Form.useForm<T>()
  const effectiveForm = props.form ?? internalForm

  return (
    <FormSearchInnerForward<T>
      {...props}
      internalForm={effectiveForm}
      ref={props.ref}
    />
  )
}
FormSearch.displayName = 'FormSearch'
