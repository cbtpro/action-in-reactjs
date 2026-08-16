import { useEffect, useState } from 'react'
import { Button, Flex, Form, Table, Tooltip, App } from 'antd'
import type { ColumnsType } from 'antd/es/table/interface'
import type { Rule } from 'antd/es/form'
import { CloseOutlined, UserOutlined } from '@ant-design/icons'
import MentorSelectModal, { type MentorSelectMode } from './MentorSelectModal'
import { getMentorDetail, type MentorUser } from './services/mentor'

export interface MentorSelectField3Props {
  name: string
  label?: React.ReactNode
  required?: boolean
  rules?: Rule[]
  modalTitle?: string
  clickRowToSelect?: boolean
  mode?: MentorSelectMode
}

function toIdList(raw: string | string[] | undefined, mode: MentorSelectMode): string[] {
  if (!raw) return []
  if (mode === 'multiple') return Array.isArray(raw) ? raw.filter(Boolean) : []
  return typeof raw === 'string' ? [raw] : []
}

function normalizeForModal(
  raw: string | string[] | undefined,
  mode: MentorSelectMode,
): string | string[] | null {
  if (!raw) return null
  if (mode === 'multiple') return Array.isArray(raw) && raw.length > 0 ? raw.filter(Boolean) : null
  return typeof raw === 'string' ? raw : null
}

export default function MentorSelectField3({
  name,
  label = '导师',
  required = true,
  rules,
  modalTitle = '选择导师',
  clickRowToSelect,
  mode = 'single',
}: MentorSelectField3Props) {
  const [modalOpen, setModalOpen] = useState(false)
  const [details, setDetails] = useState<MentorUser[]>([])
  const [detailLoading, setDetailLoading] = useState(false)

  const { message } = App.useApp()
  const form = Form.useFormInstance()
  const rawValue = Form.useWatch<string | string[] | undefined>(name, form)

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
      form.setFieldValue(name, nextValue)
      form.setFields([{ name, errors: [] }])
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
      form.setFieldValue(name, mode === 'multiple' ? [] : undefined)
      setDetails([])
      message.info('已移除所选导师')
      return
    }
    const remain = details.filter((d) => d.id !== id)
    setDetails(remain)
    const ids = toIdList(form.getFieldValue(name), mode).filter((x) => x !== id)
    form.setFieldValue(name, ids)
    if (remain.length === 0) void form.validateFields([name]).catch(() => {})
  }

  const mergedRules: Rule[] = rules ?? (
    required
      ? mode === 'multiple'
        ? [{ type: 'array', required: true, min: 1, message: `请至少选择一位${typeof label === 'string' ? label : '导师'}` }]
        : [{ required: true, message: `请选择${typeof label === 'string' ? label : '导师'}` }]
      : []
  )

  return (
    <>
      <Form.Item
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
      >
        <MentorDisplayTable mode={mode} data={details} loading={detailLoading} onRemove={handleRemove} />
      </Form.Item>
      <Form.Item name={name} noStyle rules={mergedRules} />
      <MentorSelectModal
        mode={mode}
        open={modalOpen}
        title={modalTitle}
        value={normalizeForModal(rawValue, mode)}
        clickRowToSelect={clickRowToSelect}
        onCancel={() => setModalOpen(false)}
        onConfirm={handleConfirm}
      />
    </>
  )
}

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
