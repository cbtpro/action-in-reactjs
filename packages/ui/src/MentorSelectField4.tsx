import { useEffect, useState } from 'react'
import { Button, Flex, Form, Table, Tooltip, App } from 'antd'
import type { ColumnsType } from 'antd/es/table/interface'
import type { FormInstance, Rule } from 'antd/es/form'
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

export interface MentorSelectField4Props {
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
   * 可选:额外的订阅策略(rc-field-form ShouldUpdate 官方类型)。
   * - true: 整个表单任何字段变化都会重渲染整个区块(最灵活,但有重渲染冗余)
   * - (prevValues, nextValues) => boolean: 自定义比较,返回 true 时触发重渲染
   *
   * **默认**自动合并"name 字段变化"的比较,保证即使不传入 shouldUpdate,
   * 初始值/外部 setFieldsValue/resetFields 依然能驱动重渲染。
   *
   * 级联场景示例(所属部门变化时也重渲染):
   *   shouldUpdate={(prev, cur) => prev?.department !== cur?.department}
   */
  shouldUpdate?: boolean | ((prev: any, next: any) => boolean)
}

/**
 * MentorSelectField4 — 复用的导师选择表单项(shouldUpdate 联动版本)
 *
 * 核心机制:
 * - 使用 <Form.Item shouldUpdate> + 函数式 children(不带 name,只承担 "render-trigger" 职责)
 * - 真正的字段校验仍然通过独立的 noStyle Form.Item(name + rules) 挂到校验树
 * - name 对应的值仍然用标准 API Form.useWatch(name, form) 读取,
 *   不依赖 Field 的 render-prop 签名,避免类型陷阱。
 * - shouldUpdate 的作用是:当兄弟字段变化时(例如 department),
 *   强制整个 render-prop 重渲染,让父层可以读取 form.getFieldValue('department')
 *   进而做级联逻辑。
 *
 * 为什么不直接依赖 Field render-prop 的 control/meta/form?
 *   因为 rc-field-form 的签名是 `(control, meta, form)`,
 *   但 antd Form.Item 在 name + noStyle 之间对 children 类型有额外限制,
 *   直接用函数式 children 容易触发 TS 类型不匹配。
 *   本实现把 "shouldUpdate 触发重渲染" 和 "值读写" 两条链路拆成两个 Form.Item,
 *   既保留联动能力,又保持类型安全与 API 清晰。
 *
 * 适用场景:
 * - 需要跨字段订阅、级联联动的复杂表单(如先选部门,再选该部门下的导师)
 * - 偏好 "UI = f(values)" 声明式心智,不写 useWatch + useEffect 的手动订阅
 *
 * 使用方式:
 *   <Form form={form}>
 *     <Form.Item name="department" label="所属部门"><Select /></Form.Item>
 *     <MentorSelectField4
 *       name="mentorId"
 *       label="指导导师"
 *       shouldUpdate={(p, c) => p?.department !== c?.department}
 *     />
 *   </Form>
 */
export default function MentorSelectField4({
  name,
  label = '导师',
  required = true,
  rules,
  modalTitle = '选择导师',
  clickRowToSelect,
  mode = 'single',
  shouldUpdate,
}: MentorSelectField4Props) {
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
    <>
      {/*
       * 外层 Form.Item —— 只负责 label 外观 + 按钮占位,不带 name,
       * 避免对子元素产生 value/onChange 注入,也不会有"单受控子元素"限制。
       */}
      <Form.Item
        label={
          <Flex justify="space-between" align="center" style={{ width: '100%' }}>
            <span>{label}</span>
            <span style={{ visibility: 'hidden' }}>占位</span>
          </Flex>
        }
      >
        {/*
         * React 哲学:组合优于继承 / 单一职责
         *
         * 用 <Form.Item noStyle shouldUpdate render-prop> 作为"响应式渲染壳",
         * antd v6 的 RenderChildren 签名: (form: FormInstance) => ReactNode。
         * 在此壳内:
         *  - 当 shouldUpdate 命中时,整个闭包重渲染,
         *    子组件 MentorFieldShell 可在 effect/事件回调中读到最新兄弟字段值;
         *  - MentorFieldShell 仍然用标准 useWatch 读取 name 自身值,两条路互不干扰。
         */}
        <Form.Item
          noStyle
          shouldUpdate={(prev, next) => {
            // 自动合并: name 自身值变化时也要重渲染(保证 initialValues/setFieldsValue 能驱动)
            const selfChanged = getValueByPath(prev, name) !== getValueByPath(next, name)
            if (selfChanged) return true
            // 叠加调用方的自定义订阅
            if (typeof shouldUpdate === 'boolean') return shouldUpdate
            if (typeof shouldUpdate === 'function') return shouldUpdate(prev, next)
            return false
          }}
        >
          {(form: FormInstance) => (
            <MentorFieldShell
              form={form}
              fieldName={name}
              modalTitle={modalTitle}
              clickRowToSelect={clickRowToSelect}
              mode={mode}
            />
          )}
        </Form.Item>
      </Form.Item>

      {/*
       * 独立 noStyle Form.Item(name + rules):纯校验注册,与渲染/联动彻底解耦。
       * 开闭原则:未来新增自定义规则、动态 rules、validateTrigger 等,
       * 只改这里,不影响联动逻辑。
       */}
      <Form.Item name={name} noStyle rules={mergedRules} />
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  辅助:根据 name 路径(字符串或字符串数组)取对象上的值                  */
/* ------------------------------------------------------------------ */

function getValueByPath(values: any, namePath: string | string[]): any {
  if (!values) return undefined
  const paths = Array.isArray(namePath) ? namePath : [namePath]
  let cur: any = values
  for (const p of paths) {
    if (cur == null) return undefined
    cur = cur[p]
  }
  return cur
}

/* ------------------------------------------------------------------ */
/*  内部:shouldUpdate render-prop 壳内的实际业务组件                     */
/* ------------------------------------------------------------------ */

interface MentorFieldShellProps {
  form: FormInstance
  fieldName: string
  modalTitle: string
  clickRowToSelect?: boolean
  mode: MentorSelectMode
}

/**
 * MentorFieldShell
 *
 * 职责:把"字段值(来自 useWatch) → 展示 Table + 弹窗交互"串起来。
 * 仍然用标准的 useWatch 读取字段值,不依赖 Field control 对象,
 * 这样 shouldUpdate 只负责驱动"重渲染时机",值管道是另一条独立通路。
 */
function MentorFieldShell({
  form,
  fieldName,
  modalTitle,
  clickRowToSelect,
  mode,
}: MentorFieldShellProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const [details, setDetails] = useState<MentorUser[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const { message } = App.useApp()

  /*
   * 标准值读取: Form.useWatch(name, form)
   * shouldUpdate 已经保证了联动字段变化时这里重渲染,
   * 所以如果内部有逻辑要读 form.getFieldValue('department') 做联动,
   * 直接在下面的 useEffect/事件回调中读取即可,永远拿到最新值。
   */
  const rawValue = Form.useWatch<string | string[] | undefined>(fieldName, form)

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

  const handleConfirm = async (user: MentorUser | MentorUser[]) => {
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
  }

  const handleRemove = (id?: string) => {
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
  }

  return (
    <>
      <div style={{ marginBottom: 8 }}>
        <Button
          type="primary"
          size="small"
          icon={<UserOutlined />}
          onClick={() => setModalOpen(true)}
        >
          添加导师
        </Button>
        <span style={{ marginLeft: 8, color: 'var(--text-muted, #6b7280)', fontSize: 12 }}>
          选择后将自动回填到下方表格{mode === 'multiple' ? '(可多选)' : ''}
        </span>
      </div>

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
            ? '暂未选择导师,请点击上方"添加导师"按钮(可多选)'
            : '暂未选择导师,请点击上方"添加导师"按钮',
      }}
      scroll={{ x: 910 }}
    />
  )
}
