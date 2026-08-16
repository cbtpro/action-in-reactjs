import { useEffect, useState } from 'react'
import { Button, Flex, Form, Table, Tooltip, App } from 'antd'
import type { ColumnsType } from 'antd/es/table/interface'
import type { Rule } from 'antd/es/form'
import { CloseOutlined, UserOutlined } from '@ant-design/icons'
import MentorSelectModal, { type MentorSelectMode } from './MentorSelectModal'
import { getMentorDetail, type MentorUser } from './services/mentor'

export interface MentorSelectField2Props {
  /** Form 字段名,存储导师主键 id(single=string, multiple=string[]) */
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
}

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

/**
 * MentorSelectField2 - 复用的导师选择表单项(无隐藏 Input 版本)
 *
 * 与 MentorSelectField 功能等价,差异在于字段绑定方式:
 * - v1: 外层 Form.Item 负责外观,内层 noStyle Form.Item + 隐藏 Input 承接 value/onChange
 * - v2: Form.Item 直接包裹受控子组件,通过 antd 原生 value/onChange 协议注入字段值
 */
export default function MentorSelectField2({
  name,
  label = '导师',
  required = true,
  rules,
  modalTitle = '选择导师',
  clickRowToSelect,
  mode = 'single',
}: MentorSelectField2Props) {
  const [modalOpen, setModalOpen] = useState(false)

  /** 默认校验规则:按 mode 分支 */
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
            onClick={() => setModalOpen(true)}
          >
            添加导师
          </Button>
        </Flex>
      }
      rules={mergedRules}
      /*
       * multiple 模式下 value 是数组,antd 默认 valuePropName='value' 可以正确承接;
       * 保持默认,不覆盖 valuePropName。
       */
    >
      <MentorFieldControl
        mode={mode}
        modalOpen={modalOpen}
        onModalClose={() => setModalOpen(false)}
        modalTitle={modalTitle}
        clickRowToSelect={clickRowToSelect}
      />
    </Form.Item>
  )
}

/* ------------------------------------------------------------------ */
/*  受控子组件:Form.Item 通过 value/onChange 协议与之通信              */
/* ------------------------------------------------------------------ */

interface MentorFieldControlProps {
  /** 当前字段值:single=string, multiple=string[] */
  value?: string | string[]
  /**
   * 值变更回调:
   * - single: onValueChange(id) / onValueChange(undefined)
   * - multiple: onValueChange(ids) / onValueChange([])
   */
  onChange?: (value: string | string[] | undefined) => void
  mode: MentorSelectMode
  modalOpen: boolean
  onModalClose: () => void
  modalTitle: string
  clickRowToSelect?: boolean
}

function MentorFieldControl({
  value,
  onChange,
  mode,
  modalOpen,
  onModalClose,
  modalTitle,
  clickRowToSelect,
}: MentorFieldControlProps) {
  const [details, setDetails] = useState<MentorUser[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const { message } = App.useApp()

  useEffect(() => {
    const ids = toIdList(value, mode)
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
  }, [mode, value, message])

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
      if (mode === 'single') {
        onChange?.(okList[0]!.id)
      } else {
        onChange?.(okList.map((u) => u.id))
      }
      onModalClose()
    } catch (err) {
      console.error(err)
      message.error('选择失败,请重试')
    } finally {
      setDetailLoading(false)
    }
  }

  /** single:清空; multiple:移除 id 对应的单个条目(保留其余) */
  const handleRemove = (id?: string) => {
    if (mode === 'single' || id === undefined) {
      onChange?.(mode === 'multiple' ? [] : undefined)
      setDetails([])
      message.info('已移除所选导师')
      return
    }
    const remainIds = toIdList(value, mode).filter((x) => x !== id)
    setDetails(details.filter((d) => d.id !== id))
    onChange?.(remainIds)
  }

  return (
    <>
      <MentorDisplayTable mode={mode} data={details} loading={detailLoading} onRemove={handleRemove} />
      <MentorSelectModal
        mode={mode}
        open={modalOpen}
        title={modalTitle}
        value={normalizeModalValue(value, mode)}
        clickRowToSelect={clickRowToSelect}
        onCancel={onModalClose}
        onConfirm={handleConfirm}
      />
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  内部子组件:已选导师展示表(支持单/多选移除)                          */
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
