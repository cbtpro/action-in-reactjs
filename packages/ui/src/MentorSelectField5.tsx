import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, Flex, Form, Table, Tooltip, App } from 'antd'
import type { ColumnsType } from 'antd/es/table/interface'
import type { Rule } from 'antd/es/form'
import { CloseOutlined, UserOutlined } from '@ant-design/icons'
import MentorSelectModal, { type MentorSelectMode } from './MentorSelectModal'
import { getMentorDetail, type MentorUser } from './services/mentor'

function toIdList(raw: string | string[] | undefined, mode: MentorSelectMode): string[] {
  if (!raw) return []
  if (mode === 'multiple') return Array.isArray(raw) ? raw.filter(Boolean) : []
  return typeof raw === 'string' ? [raw] : []
}

function normalizeModalValue(
  raw: string | string[] | undefined,
  mode: MentorSelectMode,
): string | string[] | null {
  if (!raw) return null
  if (mode === 'multiple') return Array.isArray(raw) && raw.length > 0 ? raw.filter(Boolean) : null
  return typeof raw === 'string' ? raw : null
}

export interface MentorSelectField5Props {
  /** Form 字段名,存储导师主键 id */
  name: string
  /** 表单项标签,默认"导师" */
  label?: React.ReactNode
  /** 是否必填,默认 true */
  required?: boolean
  /** 自定义校验规则,不传则按 required + mode 自动生成 */
  rules?: Rule[]
  /** 弹窗标题 */
  modalTitle?: string
  /** 是否开启点击行任意位置即选中导师,默认 true */
  clickRowToSelect?: boolean
  /** 选择模式:single 单选(默认) / multiple 多选 */
  mode?: MentorSelectMode
  /**
   * 是否启用自定义错误展示(Table 上方红底提示条)。
   * - true:隐藏 Form.Item 默认下方错误行,改由内部自定义 UI 展示 errors
   * - false:完全走 antd 默认外观(Form.Item 的下方错误 + help 文本)
   *
   * 默认 true,便于展示"Field 级错误驱动 UI"的核心能力。
   */
  customErrorDisplay?: boolean
}

/*
 * React 哲学:上下文驱动自定义 UI
 *
 * antd Form 提供的三条公开能力组合实现 FieldContext 语义:
 *   1. Form.Item.useStatus() — 拿到 errors/status(ValidateStatus)/warnings
 *      由外层 Form.Item(name + rules) 注入,是 antd 文档公开的子组件 Hook。
 *   2. Form.useFormInstance() — 拿到当前 Form 实例,做值写入(setFieldValue / setFields)。
 *   3. Form.useWatch(name, form) — 订阅当前字段最新值(等价于 value 直接读取)。
 *
 * 以前的实现尝试使用 Form.useFieldContext() 或 FormItemInputContext,
 * 但前者 antd 官方未暴露、后者需从单独的 context 子模块导入。
 * 而 Form.Item.useStatus() 是 Form.Item 的静态方法(antd v6 起),
 * 语义清晰且类型 100% 安全,是更稳妥的选择。
 *
 * 关键:Form.Item(name + rules) 会把 errors/status 注入子树,
 * 自定义子组件在 Form.Item children 中调用 Form.Item.useStatus(),
 * 直接消费这份状态,就能做出"错误区域在 Table 上方"的自定义 UI。
 */

/**
 * MentorSelectField5 — 复用的导师选择表单项(FieldContext 自定义控件版本)
 *
 * 核心能力:
 * - 自定义错误展示:通过 FormItemInputContext 读取 errors,渲染在 Table 上方红底提示区
 * - 读写独立通路:Form.useWatch 读值 / form.setFieldValue 写值
 * - label 按钮通过"共享 API 句柄"触发内部弹窗,避免跨层状态共享难题
 * - 即使 name 是路径数组(例如 Form.List 中),仍然 100% 安全
 *
 * 适用场景:
 * - 高度定制错误样式(企业设计规范要求错误展示位置与 antd 默认不同)
 * - 需要根据 errors/touched 组合状态驱动细粒度 UI 变化
 * - 做内部 UI 组件库时,需要把字段元信息用于控件外观(如高亮未通过校验的输入容器)
 *
 * 使用方式:
 *   <Form form={form}>
 *     <MentorSelectField5 name="mentorId" label="指导导师" customErrorDisplay />
 *   </Form>
 */
export default function MentorSelectField5({
  name,
  label = '导师',
  required = true,
  rules,
  modalTitle = '选择导师',
  clickRowToSelect,
  mode = 'single',
  customErrorDisplay = true,
}: MentorSelectField5Props) {
  /*
   * 共享 API 句柄:label 区的"添加导师"按钮需要触发 MentorFieldControlV5 内部的
   * modalOpen,但 label 在 Form.Item(name + rules) 之外,没有上下文,
   * 也无法直接读写内部 state。
   *
   * 经典解法:使用 ref/setState + onReady 模式。
   * 父组件维护一个 cmd 句柄对象(由子组件 onReady 回传),
   * label 按钮点击时调用 cmd.openModal(),子组件内部接收后打开弹窗。
   */
  const [cmd, setCmd] = useState<{ openModal: () => void } | null>(null)

  const mergedRules: Rule[] = rules ?? (
    required
      ? mode === 'multiple'
        ? [
            {
              type: 'array',
              required: true,
              min: 1,
              message: `请至少选择一位${typeof label === 'string' ? label : '导师'}`,
            },
          ]
        : [{ required: true, message: `请选择${typeof label === 'string' ? label : '导师'}` }]
      : []
  )

  return (
    <Form.Item
      name={name}
      label={
        <Flex justify="space-between" align="center" style={{ width: '100%' }}>
          <span>{label}</span>
          <Button
            type="primary"
            size="small"
            icon={<UserOutlined />}
            onClick={() => cmd?.openModal()}
            disabled={!cmd}
          >
            添加导师
          </Button>
        </Flex>
      }
      rules={mergedRules}
      /*
       * 自定义错误展示开关:
       * - customErrorDisplay=true:Form.Item 默认下方错误行不渲染(help 为空串)
       *   错误完全由内部 MentorFieldControlV5 通过 FormItemInputContext 读取并自定义 UI。
       * - false:完全走 antd 默认(不显示自定义区域)
       */
      help={customErrorDisplay ? '' : undefined}
      validateStatus={customErrorDisplay ? '' : undefined}
    >
      <MentorFieldControlV5
        modalTitle={modalTitle}
        clickRowToSelect={clickRowToSelect}
        customErrorDisplay={customErrorDisplay}
        onReady={setCmd}
        fieldName={name}
        mode={mode}
      />
    </Form.Item>
  )
}

/* ------------------------------------------------------------------ */
/*  自定义控件内部:消费公开 Context + 标准 Hook 组合实现 FieldContext 能力  */
/* ------------------------------------------------------------------ */

interface MentorFieldControlV5Props {
  modalTitle: string
  clickRowToSelect?: boolean
  customErrorDisplay: boolean
  fieldName: string
  mode: MentorSelectMode
  /** 挂载后把 openModal 指令句柄回传给父层,供 label 按钮调用 */
  onReady?: (api: { openModal: () => void }) => void
}

/**
 * MentorFieldControlV5
 *
 * 将"Field 元信息(来自 FormItemInputContext)" + "值读写(来自 useFormInstance + useWatch)"
 * 两条通道合并,实现高度自定义的字段控件 UI。
 */
function MentorFieldControlV5({
  modalTitle,
  clickRowToSelect,
  customErrorDisplay,
  fieldName,
  mode,
  onReady,
}: MentorFieldControlV5Props) {
  /*
   * React 哲学:上下文即真源
   *
   * Form.Item(name=fieldName) 写入校验结果后,
   * 其子组件内部可以通过 Form.Item.useStatus() 直接拿到最新 errors/status/warnings。
   * 这是 antd 官方暴露的公开 Hook(Form.Item 子组件专属),不需要任何未公开 Context。
   */
  const { errors = [] } = Form.Item.useStatus()
  const touched = errors.length > 0 // 简化:有错误即视为触达/已校验

  const form = Form.useFormInstance()
  const rawValue = Form.useWatch<string | string[] | undefined>(fieldName, form)

  const [modalOpen, setModalOpen] = useState(false)
  const [details, setDetails] = useState<MentorUser[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const { message } = App.useApp()

  /* 避免 onReady 在父组件中引发无限重渲染:使用 ref 缓存句柄函数引用 */
  const onReadyRef = useRef(onReady)
  useEffect(() => {
    onReadyRef.current = onReady
  }, [onReady])

  /*
   * 生命周期钩子:挂载后把 openModal 指令句柄回传给父层。
   * React 哲学:副作用隔离
   *   —— 跨层指令发送(父层按钮触发子层状态变更)这种组件树外的通信必须在
   *   useEffect 中完成,保证渲染阶段是纯函数。
   */
  useEffect(() => {
    const api = { openModal: () => setModalOpen(true) }
    onReadyRef.current?.(api)
    return () => {
      onReadyRef.current?.({ openModal: () => {} })
    }
  }, [])

  /*
   * React 哲学:依赖驱动渲染
   *
   * rawValue 变化 → 拉取详情列表 → 渲染展示 Table。
   * 通道单一、来源清晰,不需要额外的手动订阅。
   */
  useEffect(() => {
    const ids = toIdList(rawValue, mode)
    if (ids.length === 0) {
      setDetails([])
      return
    }
    let active = true
    setDetailLoading(true)
    void (async () => {
      try {
        const list = await Promise.all(ids.map((id) => getMentorDetail(id)))
        if (active) setDetails(list.filter(Boolean) as MentorUser[])
      } catch (err) {
        console.error(err)
        if (active) message.error('获取导师详情失败')
      } finally {
        if (active) setDetailLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [mode, rawValue, message])

  /**
   * 确定写值:走 form.setFieldValue 实例 API 安全写回字段。
   * 即使 name 是 List 内的深层数组路径也 100% 正确(Form 实例内部按 NamePath 路由)。
   */
  const handleConfirm = useCallback(async (user: MentorUser | MentorUser[]) => {
    try {
      setDetailLoading(true)
      const users = Array.isArray(user) ? user : [user]
      const fullList = await Promise.all(users.map((u) => getMentorDetail(u.id)))
      const okList = fullList.filter(Boolean) as MentorUser[]
      if (okList.length === 0) {
        message.error('未查询到导师详情')
        return
      }
      setDetails(okList)
      const nextValue = mode === 'single' ? okList[0]!.id : okList.map((u) => u.id)
      form.setFieldValue(fieldName, nextValue)
      form.setFields([{ name: fieldName, errors: [] }])
      setModalOpen(false)
    } catch (err) {
      console.error(err)
      message.error('选择失败,请重试')
    } finally {
      setDetailLoading(false)
    }
  }, [fieldName, form, message, mode])

  /** 移除清空/单项移除:仍然通过 form.setFieldValue 统一入口 */
  const handleRemove = useCallback((id?: string) => {
    if (mode === 'single' || id === undefined) {
      form.setFieldValue(fieldName, mode === 'multiple' ? [] : undefined)
      setDetails([])
      message.info('已移除所选导师')
      return
    }
    const remain = details.filter((d) => d.id !== id)
    setDetails(remain)
    const ids = toIdList(form.getFieldValue(fieldName), mode).filter((x) => x !== id)
    form.setFieldValue(fieldName, ids)
    if (remain.length === 0) void form.validateFields([fieldName]).catch(() => {})
  }, [details, fieldName, form, message, mode])

  const fieldEmpty = toIdList(rawValue, mode).length === 0

  return (
    <>
      {customErrorDisplay && errors.length > 0 && (
        /*
         * 自定义错误区域:放在 Table 上方,使用红底浅描边。
         * 语义化 role=alert,方便读屏软件。
         * 渲染时通过 touched(或简化:存在错误即显示)控制出现时机。
         */
        <div
          role="alert"
          style={{
            color: '#ff4d4f',
            fontSize: 12,
            lineHeight: '20px',
            padding: '4px 10px',
            marginBottom: 8,
            background: 'rgba(255,77,79,0.06)',
            border: '1px solid rgba(255,77,79,0.2)',
            borderRadius: 4,
          }}
        >
          {touched || fieldEmpty
            ? errors.map((e, i) => (
                <span key={i} style={{ display: 'block' }}>
                  {typeof e === 'string' ? e : String(e)}
                </span>
              ))
            : null}
        </div>
      )}

      <MentorDisplayTable mode={mode} data={details} loading={detailLoading} onRemove={handleRemove} />

      <MentorSelectModal
        mode={mode}
        open={modalOpen}
        title={modalTitle}
        value={normalizeModalValue(rawValue, mode)}
        clickRowToSelect={clickRowToSelect}
        onCancel={() => setModalOpen(false)}
        onConfirm={handleConfirm}
      />
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  内部子组件:已选导师展示表(只读 + 移除操作)                          */
/* ------------------------------------------------------------------ */

interface MentorDisplayTableProps {
  mode: MentorSelectMode
  data: MentorUser[]
  loading: boolean
  onRemove: (id?: string) => void
}

function MentorDisplayTable({ mode, data, loading, onRemove }: MentorDisplayTableProps) {
  const columns: ColumnsType<MentorUser> = [
    { title: '姓名', dataIndex: 'name', width: 100, ellipsis: { showTitle: false }, render: (v: string) => <Tooltip title={v}>{v}</Tooltip> },
    { title: '工号', dataIndex: 'employeeNo', width: 120 },
    { title: '部门', dataIndex: 'department', width: 160, ellipsis: { showTitle: false }, render: (v: string) => <Tooltip title={v}>{v}</Tooltip> },
    { title: '职称', dataIndex: 'title', width: 120, ellipsis: { showTitle: false }, render: (v: string) => <Tooltip title={v}>{v}</Tooltip> },
    { title: '手机号', dataIndex: 'phone', width: 130 },
    { title: '邮箱', dataIndex: 'email', width: 200, ellipsis: { showTitle: false }, render: (v: string) => <Tooltip title={v}>{v}</Tooltip> },
    {
      title: '操作',
      key: 'action',
      width: 80,
      align: 'center',
      fixed: 'right',
      render: (_: unknown, record) => (
        <Button
          type="text"
          danger
          size="small"
          icon={<CloseOutlined />}
          onClick={() => onRemove(mode === 'single' ? undefined : record.id)}
        >
          移除
        </Button>
      ),
    },
  ]

  return (
    <Table<MentorUser>
      rowKey="id"
      size="small"
      loading={loading}
      columns={columns}
      dataSource={data}
      pagination={false}
      locale={{
        emptyText:
          mode === 'multiple'
            ? '暂未选择导师,请点击右上角"添加导师"按钮(可多选)'
            : '暂未选择导师,请点击右上角"添加导师"按钮',
      }}
      scroll={{ x: 910 }}
    />
  )
}
