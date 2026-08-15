import { useEffect, useMemo, useState } from 'react'
import {
  Button,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  message,
} from 'antd'
import type { ColumnsType, TableRowSelection } from 'antd/es/table/interface'
import {
  searchMentors,
  type MentorUser,
} from './services/mentor'

export interface MentorSelectModalProps {
  /** 是否打开弹窗 */
  open: boolean
  /** 关闭回调 */
  onCancel: () => void
  /**
   * 确定回调:返回选中的导师(完整对象)
   * 若未选择,组件会自行阻止关闭
   */
  onConfirm: (user: MentorUser) => void | Promise<void>
  /** 弹窗标题 */
  title?: string
  /** 确定按钮 loading 状态(可选,若 onConfirm 为异步组件内部已处理 loading) */
  confirmLoading?: boolean
}

interface SearchForm {
  name?: string
  department?: string
}

/**
 * MentorSelectModal - 选择导师弹窗(复用组件)
 *
 * 能力:
 * - 姓名 + 部门 搜索
 * - Table 行单选(使用 antd rowSelection.type = 'radio' 原生特性)
 * - 前端分页 + 后端分页查询
 * - 受控 props: open / onCancel / onConfirm
 *
 * 复用方式:
 *   const [open, setOpen] = useState(false)
 *   <MentorSelectModal
 *     open={open}
 *     onCancel={() => setOpen(false)}
 *     onConfirm={(user) => { console.log('选中:', user.id) }}
 *   />
 */
export default function MentorSelectModal({
  open,
  onCancel,
  onConfirm,
  title = '选择导师',
  confirmLoading,
}: MentorSelectModalProps) {
  const [searchForm] = Form.useForm<SearchForm>()
  const [data, setData] = useState<MentorUser[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [selectedKey, setSelectedKey] = useState<React.Key | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [messageApi, contextHolder] = message.useMessage()

  /*
   * React 哲学:副作用隔离
   *
   * 只在 open 变为 true 时或分页/搜索参数变化后触发查询,
   * 其他渲染不发请求。关闭时重置选中项,避免下次打开残留上一次的选择。
   */
  useEffect(() => {
    if (!open) {
      setSelectedKey(null)
      return
    }
    void (async () => {
      setLoading(true)
      try {
        const values = searchForm.getFieldsValue()
        const res = await searchMentors({
          name: values.name,
          department: values.department,
          page,
          pageSize,
        })
        setData(res.list)
        setTotal(res.total)
      } finally {
        setLoading(false)
      }
    })()
  }, [open, page, pageSize]) // eslint-disable-line react-hooks/exhaustive-deps

  /** 搜索(重置到第一页) */
  const handleSearch = () => {
    setPage(1)
    setLoading(true)
    void (async () => {
      try {
        const values = searchForm.getFieldsValue()
        const res = await searchMentors({
          name: values.name,
          department: values.department,
          page: 1,
          pageSize,
        })
        setData(res.list)
        setTotal(res.total)
      } finally {
        setLoading(false)
      }
    })()
  }

  /** 重置 */
  const handleReset = () => {
    searchForm.resetFields()
    handleSearch()
  }

  /**
   * React 哲学:声明式渲染 / Antd 原生能力优先
   *
   * 列表单选使用 antd Table 原生 rowSelection.type = 'radio',
   * 不要自己实现复选框/点击行逻辑。antd 内置:
   * - 单选按钮 UI
   * - 点击表头/行的选中态切换
   * - 受控 selectedRowKeys 与 onChange
   */
  const rowSelection: TableRowSelection<MentorUser> = useMemo(
    () => ({
      type: 'radio',
      selectedRowKeys: selectedKey ? [selectedKey] : [],
      onChange: (keys) => {
        setSelectedKey(keys.length ? keys[0] : null)
      },
      columnTitle: '选择',
    }),
    [selectedKey],
  )

  /** 表格列定义 */
  const columns: ColumnsType<MentorUser> = useMemo(
    () => [
      { title: '姓名', dataIndex: 'name', width: 120 },
      { title: '工号', dataIndex: 'employeeNo', width: 120 },
      { title: '部门', dataIndex: 'department', width: 160 },
      { title: '职称', dataIndex: 'title', width: 140 },
      { title: '手机号', dataIndex: 'phone', width: 140 },
      { title: '邮箱', dataIndex: 'email' },
    ],
    [],
  )

  /** 确定:校验选中项 → 调用 onConfirm → 关闭 / 失败提示 */
  const handleOk = async () => {
    if (!selectedKey) {
      messageApi.warning('请先选择一位导师')
      return
    }
    const user = data.find((u) => u.id === selectedKey)
    if (!user) return
    setSubmitting(true)
    try {
      await onConfirm(user)
    } catch (err) {
      console.error(err)
      messageApi.error('选择失败,请重试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      {contextHolder}
      <Modal
        title={title}
        open={open}
        onCancel={onCancel}
        onOk={handleOk}
        okButtonProps={{ loading: confirmLoading ?? submitting }}
        maskClosable={false}
        destroyOnHidden
        width={900}
      >
        {/* 搜索区 */}
        <Form<SearchForm>
          form={searchForm}
          layout="inline"
          style={{ marginBottom: 16 }}
          onFinish={handleSearch}
        >
          <Form.Item name="name" label="姓名">
            <Input placeholder="请输入姓名" allowClear style={{ width: 180 }} />
          </Form.Item>
          <Form.Item name="department" label="部门">
            <Select
              placeholder="请选择部门"
              allowClear
              style={{ width: 200 }}
              options={[
                { label: '技术部', value: '技术部' },
                { label: '产品部', value: '产品部' },
                { label: '市场部', value: '市场部' },
                { label: '运营部', value: '运营部' },
                { label: '人力资源部', value: '人力资源部' },
                { label: '财务部', value: '财务部' },
                { label: '设计部', value: '设计部' },
                { label: '研发中心', value: '研发中心' },
              ]}
            />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                查询
              </Button>
              <Button onClick={handleReset}>重置</Button>
            </Space>
          </Form.Item>
        </Form>

        {/* 列表 */}
        <Table<MentorUser>
          rowKey="id"
          size="middle"
          loading={loading}
          columns={columns}
          dataSource={data}
          rowSelection={rowSelection}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (t) => `共 ${t} 条`,
            onChange: (p, ps) => {
              setPage(p)
              setPageSize(ps)
            },
          }}
          scroll={{ y: 360 }}
        />
      </Modal>
    </>
  )
}
