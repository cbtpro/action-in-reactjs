import { useEffect, useState } from 'react'
import {
  Button,
  Card,
  Form,
  Input,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  App,
} from 'antd'
import type { ColumnsType } from 'antd/es/table/interface'
import { Link, useNavigate } from 'react-router-dom'
import { EyeOutlined, PlusOutlined, SearchOutlined, ReloadOutlined } from '@ant-design/icons'
import { queryFormRecords, type FormRecord } from '@/services/formRecord'

const { Title, Text } = Typography

interface QueryForm {
  keyword?: string
  role?: string
  status?: FormRecord['status']
}

const STATUS_COLOR_MAP: Record<NonNullable<FormRecord['status']>, string> = {
  草稿: 'default',
  已提交: 'blue',
  审核中: 'orange',
  已通过: 'green',
}

const ROLE_LABEL_MAP: Record<string, string> = {
  personal: '个人用户',
  employee: '企业员工',
  admin: '管理员',
}

/**
 * ListPage —— 表单记录列表页
 *
 * 功能:
 * - 顶部搜索区(关键字、角色、状态、重置)
 * - 表格展示:编号、用户名(可点击跳转详情)、邮箱、角色、状态、创建时间、操作(查看)
 * - 分页 + 右上角"新增"按钮(跳转 /form 不带 id = 新增模式)
 *
 * 设计遵循:
 * - 职责单一:只负责搜索 + 展示 + 跳转,不承载表单编辑逻辑
 * - 声明式:分页/筛选变化触发 useEffect 重新查询
 */
export default function ListPage() {
  const [queryForm] = Form.useForm<QueryForm>()
  const [data, setData] = useState<FormRecord[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const navigate = useNavigate()
  const { message } = App.useApp()

  /*
   * React 哲学:依赖驱动渲染
   * 任何查询条件(page / pageSize / 搜索条件表单被用户提交)变化 → 重新拉取列表。
   * 搜索通过 handleSearch 重置到 page=1 后再触发本 effect,链路清晰单一。
   */
  useEffect(() => {
    const values = queryForm.getFieldsValue()
    setLoading(true)
    void (async () => {
      try {
        const res = await queryFormRecords({ ...values, page, pageSize })
        setData(res.list)
        setTotal(res.total)
      } catch (err) {
        console.error(err)
        message.error('加载列表失败')
      } finally {
        setLoading(false)
      }
    })()
  }, [page, pageSize, queryForm, message])

  const handleSearch = () => {
    setPage(1)
    /* setPage(1) 会触发 useEffect 重新查询 */
  }

  const handleReset = () => {
    queryForm.resetFields()
    setPage(1)
  }

  const columns: ColumnsType<FormRecord> = [
    {
      title: '编号',
      dataIndex: 'id',
      width: 120,
      render: (v: string) => <Text copyable>{v}</Text>,
    },
    {
      title: '用户名',
      dataIndex: 'username',
      width: 180,
      /*
       * 名称列可点击跳转详情 —— 默认是详情模式(表单页默认根据 id 进入详情模式)。
       * 使用 Link 保持可复制链接、可新标签打开。
       */
      render: (v: string, record) => (
        <Link
          to={`/form?id=${encodeURIComponent(record.id)}`}
          style={{ fontWeight: 600 }}
        >
          {v}
        </Link>
      ),
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      width: 220,
      ellipsis: true,
    },
    {
      title: '角色',
      dataIndex: 'role',
      width: 120,
      render: (v: string) => ROLE_LABEL_MAP[v] ?? v,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: (v: FormRecord['status']) =>
        v ? <Tag color={STATUS_COLOR_MAP[v]}>{v}</Tag> : <span>-</span>,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 180,
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      align: 'center',
      fixed: 'right',
      render: (_: unknown, record) => (
        <Button
          type="link"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => navigate(`/form?id=${encodeURIComponent(record.id)}`)}
        >
          查看
        </Button>
      ),
    },
  ]

  return (
    <section className="page">
      <Title level={2}>表单记录</Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
        点击「用户名」或右侧「查看」跳转到详情页(默认只读),点击右上角「新增」可创建新记录。
      </Text>

      <Card style={{ width: '100%' }}>
        {/*
         * 搜索区:inline 布局、横向排列。
         * 回车(提交) → 调 handleSearch;点查询按钮等同效果。
         */}
        <Form<QueryForm>
          form={queryForm}
          layout="inline"
          style={{ marginBottom: 16, rowGap: 8 }}
          onFinish={handleSearch}
        >
          <Form.Item name="keyword" label="关键字">
            <Input
              placeholder="编号/用户名/邮箱"
              allowClear
              style={{ minWidth: 220 }}
              prefix={<SearchOutlined />}
            />
          </Form.Item>
          <Form.Item name="role" label="角色">
            <Select
              placeholder="全部"
              allowClear
              style={{ minWidth: 140 }}
              options={[
                { label: '个人用户', value: 'personal' },
                { label: '企业员工', value: 'employee' },
                { label: '管理员', value: 'admin' },
              ]}
            />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select
              placeholder="全部"
              allowClear
              style={{ minWidth: 140 }}
              options={[
                { label: '草稿', value: '草稿' },
                { label: '已提交', value: '已提交' },
                { label: '审核中', value: '审核中' },
                { label: '已通过', value: '已通过' },
              ]}
            />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                查询
              </Button>
              <Button onClick={handleReset} icon={<ReloadOutlined />}>
                重置
              </Button>
            </Space>
          </Form.Item>

          {/*
           * 右侧「新增记录」按钮:
           * 走 /form (不带 id) = 空表单,默认是编辑模式(新建)。
           */}
          <Form.Item style={{ marginLeft: 'auto' }}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/form')}
            >
              新增记录
            </Button>
          </Form.Item>
        </Form>

        <Table<FormRecord>
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={data}
          scroll={{ x: 1100 }}
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
        />
      </Card>
    </section>
  )
}
