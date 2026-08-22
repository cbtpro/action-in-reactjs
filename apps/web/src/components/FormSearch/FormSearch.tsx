/**
 * FormSearch.tsx
 * ------------------------------------------------------------------
 * 通用搜索表单容器:声明式搜索条件配置 + 输入即搜索 + debounce +
 * 标准操作按钮栏(查询 / 重置 / extra)。
 *
 * ================================================================
 *  2026-08-22 重构(对齐用户简化后的 IME 组件)
 * ================================================================
 *
 * 【之前的 Scheduler 架构(已废弃)】
 *   ┌──────────────┐       compositionstart/end      ┌───────────────┐
 *   │ IMEInput 等 │ ──────────────────────────────▶ │  IMEContext   │
 *   │ 仅捕事件    │    (per-field namePath)          │  Set<Key> 状态│
 *   └──────────────┘                                 └───────────────┘
 *            Form.Item onChange 仍实时写(拼音中间态也写 store)
 *              ↓
 *         Form.onValuesChange → scheduleSearch
 *              ↓
 *         Q1 精确字段级 Gating: changedFields.some(composingSet.has)
 *              ↓ 是 → 跳过
 *              ↓ 否 → debounce → onSearch
 *         compositionend → notifyCompositionEnd → queueMicrotask → scheduleSearch
 *
 *  核心痛点:
 *   - 5 文件(IMEContext / useIME / IMEInput / IMETextArea / FormSearch)
 *     协同,理解与维护成本高。
 *   - 循环依赖破局需要共享 ref 间接访问,代码读起来绕。
 *
 * 【现在的架构(对齐用户 withComposition)】
 *   ┌──────────────────────────────────────────────────────┐
 *   │ IMEInput / IMETextArea / IMENumberInput              │
 *   │ 内部 useIMEComposition 状态机自己拦截 onChange:       │
 *   │  composition 期间 → 不调用外部 onChange(Form value   │
 *   │                       停留在上次最终值)                │
 *   │  compositionend     → 调用外部 onChange 一次(最终值)  │
 *   └──────────────────────────────────────────────────────┘
 *            ↓ 最终 onChange 才会通知 Form.Item
 *         Form.onValuesChange → scheduleSearch
 *              ↓
 *         本文件 Scheduler:只做 debounce + force flush → onSearch
 *
 *  简化结果:
 *   - 本文件 **不再需要 IMEContext Provider、composingFieldsRef、
 *     Gating 逻辑、queueMicrotask 时序处理、notifyCompositionEnd**。
 *   - 多字段 / Select 变更 / composition 并发的正确性由 withComposition
 *     在源头上保证(合成期字段本身就"没产生 onValuesChange"),完全不需要
 *     per-field Set 精确调度。
 *   - 代码量: 约 450 → 约 260 行,可读性 ↑、圈复杂度 ↓。
 *
 * ================================================================
 *  Scheduler 设计(简化版)
 * ================================================================
 *
 *  统一入口: scheduleSearch({ force })
 *
 *   1) force=false 路径(输入即搜索 / 控件自身 onDebouncedChange):
 *      → 若有待定 timer,取消 → 设置新 setTimeout(debounceMs) → flush
 *   2) force=true 路径(查询按钮 / 重置 / imperative .submit())
 *      → 若有待定 timer,取消 → 同步 flush
 *
 *  flush = form.getFieldsValue(true) + onSearch(values)
 *
 *  两条链路都通过同一 timer → 不会重复触发 onSearch(同之前的去重保证)。
 *
 * ================================================================
 *  Props / 对外 imperative
 * ================================================================
 *  - Props 与重构前保持一致(公共 API 零变化):
 *      form? / onSearch / debounceMs?=280 / triggerOnChange?=true /
 *      submitText? / showResetButton?=true / submitButtonProps? /
 *      resetButtonProps? / extra? / formProps?
 *  - ref 暴露 FormSearchHandle<T>: { submit, reset, getForm }
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

/* ------------------------------------------------------------------ */
/*  Props 类型                                                         */
/* ------------------------------------------------------------------ */

export interface FormSearchProps<T extends object = Record<string, any>> {
  /** 外部传入 antd Form instance;不传则内部自动创建。 */
  form?: FormInstance<T>

  /**
   * 搜索执行回调。form.getFieldsValue(true) 同步最新值后调用。
   * 典型用法:onSearch={values => { setQuery(values); setPage(1) }}
   */
  onSearch: (values: T) => void

  /** force=false(输入即搜索)的 debounce 毫秒数。默认 280。 */
  debounceMs?: number

  /** true(默认): onValuesChange → scheduleSearch(force=false)。 false: 仅按钮触发。 */
  triggerOnChange?: boolean

  /** 查询按钮文案,默认 "查询"。 */
  submitText?: ReactNode

  /** 是否显示重置按钮,默认 true。 */
  showResetButton?: boolean

  /** 查询按钮额外 props(如 loading / disabled)。 */
  submitButtonProps?: React.ComponentProps<typeof Button>

  /** 重置按钮额外 props。 */
  resetButtonProps?: React.ComponentProps<typeof Button>

  /** 操作按钮栏右侧自定义内容(如:新增、导出按钮)。 */
  extra?: ReactNode

  /**
   * 透传给 antd <Form> 的其余 props。
   * 注: layout 强制 inline(保证 SearchItem 操作栏横向流式排列,不在此开放)。
   */
  formProps?: Omit<
    FormProps<T>,
    'form' | 'onFinish' | 'onValuesChange' | 'layout'
  >
}

/* ------------------------------------------------------------------ */
/*  FormSearch 暴露给外部的 imperative handle                          */
/* ------------------------------------------------------------------ */

export interface FormSearchHandle<T extends object = Record<string, any>> {
  /** 触发一次 force=true 搜索(立即 flush,效果同「查询」按钮)。 */
  submit: () => void
  /** resetFields + force 搜索(效果同「重置」按钮)。 */
  reset: () => void
  /** 透传 FormInstance。等价于业务层从 prop 传入 form 时拿到的同一引用。 */
  getForm: () => FormInstance<T>
}

/* ------------------------------------------------------------------ */
/*  内层实现(方便 forwardRef + 泛型)                                    */
/* ------------------------------------------------------------------ */

interface FormSearchInnerProps<T extends object> extends FormSearchProps<T> {
  children?: ReactNode
  /** 外层 wrapper 保证:未传 form prop 时通过 Form.useForm 初始化后填入。 */
  internalForm: FormInstance<T>
}

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

  /* ---------- 调度基础设施:单 timer 统一调度 ---------- */
  const debounceTimerRef = useRef<number | null>(null)

  /*
   * scheduleSearch — 所有三条链路的统一入口。
   *
   * 链路 A(输入即搜索 / onValuesChange) → scheduleSearch({ force:false })
   *   注:输入即搜索收到的 onValuesChange 已经是 withComposition 过滤后的最终值,
   *      合成期的临时 value 不会走到这里 → 无需额外 gating。
   * 链路 B(查询按钮 / onFinish)         → scheduleSearch({ force:true  })
   * 链路 C(重置 / imperative)            → scheduleSearch({ force:true  })
   */
  const scheduleSearch = useCallback(
    function scheduleSearch(opts: { force: boolean }) {
      const { force } = opts

      // 1) 统一先清掉待定 timer → 保证无论哪条链路都不会重复执行 flush。
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }

      /*
       * flush 闭包取此刻 form 最新值:
       *  - force=true:同步取 → 立即执行
       *  - force=false:debounce delay 到时取(取到时的值才是最终业务值,
       *    比闭包外层捕获的值更可靠)。
       */
      const flush: () => void = () => {
        const values = form.getFieldsValue(true) as T
        onSearch(values)
      }

      if (force) {
        flush()
        return
      }

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

  /* ---------- 卸载清理:防止路由切走后 timer 回调到已卸载组件 ---------- */
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
    () => {
      // withComposition 已经过滤合成期 onChange,这里只要 triggerOnChange=true
      // 就直接调度(不再需要 changedFields 精确 Gating)。
      if (!triggerOnChange) return
      scheduleSearch({ force: false })
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

  /* ---------- imperative handle ---------- */
  useImperativeHandle(
    ref,
    (): FormSearchHandle<T> => ({
      submit: handleFinish,
      reset: handleReset,
      getForm: () => form,
    }),
    [handleFinish, handleReset, form],
  )

  /* ---------- 渲染 ----------
   * 注:与重构前不同,**不再需要 IMEContext.Provider 包裹**。
   * IME 能力完全在 SearchItem 的控件层自洽,不依赖外层上下文。
   */
  const operationButtons = useMemo(
    () => (
      <Space size="middle" wrap>
        <Button type="primary" htmlType="submit" {...submitButtonProps}>
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
    ),
    [
      submitButtonProps,
      submitText,
      showResetButton,
      handleReset,
      resetButtonProps,
      extra,
    ],
  )

  return (
    <Form<T>
      form={form}
      layout="inline"
      onValuesChange={handleValuesChange}
      onFinish={handleFinish}
      {...(formProps as FormProps<T>)}
    >
      {children}
      {/* 操作按钮栏:独立 Form.Item 包裹,使其与其他 SearchItem 的 inline 布局对齐 */}
      <Form.Item>{operationButtons}</Form.Item>
    </Form>
  )
}

/* ---------- forwardRef + 泛型断言(与重构前同) ---------- */
const FormSearchInnerForwardRaw = forwardRef(FormSearchInner)
const FormSearchInnerForward = FormSearchInnerForwardRaw as <
  T extends object,
>(
  props: FormSearchInnerProps<T> & {
    ref?: React.ForwardedRef<FormSearchHandle<T>>
  },
) => ReturnType<typeof FormSearchInner>
;((FormSearchInnerForwardRaw as unknown as { displayName?: string }).displayName =
  'FormSearchInner')

/* ------------------------------------------------------------------ */
/*  外层泛型包装: Form.useForm 必须在组件顶层调用(Hook 规则)           */
/* ------------------------------------------------------------------ */

/**
 * FormSearch — 通用搜索表单容器。
 *
 * 功能:
 *  - 声明式 SearchItem 配置搜索字段(input/number/textarea/select/date/range)
 *  - 输入即搜索 + debounce(合成期中间值自动被 IME* 控件过滤,不会产生请求)
 *  - 查询 / 重置 / 自定义 extra 按钮标准操作栏
 *  - force flush:按钮点击立即查询,不等待 debounce
 *  - 卸载清理 debounce timer,避免路由切换后残留回调
 */
export function FormSearch<T extends object = Record<string, any>>(
  props: FormSearchProps<T> & {
    children?: ReactNode
    ref?: React.ForwardedRef<FormSearchHandle<T>>
  },
) {
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
