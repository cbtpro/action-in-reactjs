import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  Button,
  Card,
  Form,
  Input,
  Pagination,
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
 * ListPage —— 表单记录列表页(一页铺完,表体滚动,分页常驻底部)
 *
 * 布局契约(分离关注):
 *  - 外层 section: flex:1 + min-height:0,占满内容区(flex 链自动分配),
 *    不触发外层 app-content__body 滚动;高度随顶部自适应,无需硬编码
 *  - 顶部标题/描述(flex 0)
 *  - 中间 Card(flex 1 1 auto + min-height:0):Card 内部再 flex column
 *     ├── Search Form(flex 0)
 *     ├── Table 容器(flex 1 1 auto + min-height:0):通过 ResizeObserver
 *     │   实时测量可用高度 → 写入 antd Table scroll.y,使表头固定、表体内部滚动
 *     └── 独立 Pagination 栏(flex 0):常驻 Card 底部,不跟随表体滚动
 *
 * 单一高度权威(防止 经验 564623/1469959 提到的正反馈环与多处覆盖冲突):
 *  - scroll.y 唯一来源:ResizeObserver 读取 tableWrapRef.clientHeight
 *  - 不再通过 CSS 强行写 ant-table-body.style.height
 *  - Table pagination={false} + 独立 <Pagination />,天然将分页移出滚动区域
 *    (经验 564623 Failure 2:若用 Table 内置分页,则无法保证其"脱离滚动容器")
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
   * Table 容器 ref + 动态 scroll.y。
   * scroll.y 决定 antd Table 表体(.ant-table-body)的滚动高度:
   * 值就是"当前分配给 Table 可见区域的像素高度",表头固定在其上方,
   * 内容多出的行在表体内部滚动,不会推动外层页面滚动。
   */
  const tableWrapRef = useRef<HTMLDivElement>(null)
  const [scrollY, setScrollY] = useState<number>(400)

  /*
   * React 哲学:副作用隔离(窗口/容器尺寸变化属于外部事件,effect 内处理并清理)
   *
   * useLayoutEffect 先于浏览器 paint 计算初始高度,
   * 避免 ResizeObserver 第一次回调前出现瞬间错高。
   */
  useLayoutEffect(() => {
    const el = tableWrapRef.current
    if (!el) return

    const measure = () => {
      if (el.clientHeight > 0) setScrollY(el.clientHeight)
    }
    measure()

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => measure())
      ro.observe(el)
      return () => ro.disconnect()
    }
    // 退化:窗口 resize 时量一次(极端场景无 ResizeObserver 的运行时)
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  /*
   * 依赖驱动渲染:任何查询条件变化 → 重新拉取列表。
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
    <section
      className="page"
      style={{ flex: 1, minHeight: 0, gap: 16 }}
    >
      {/* 标题/描述:高度固定,flex 0,不参与剩余空间分配 */}
      <div style={{ flexShrink: 0 }}>
        <Title level={2} style={{ marginBottom: 4 }}>表单记录</Title>
        <Text type="secondary">
          点击「用户名」或右侧「查看」跳转到详情页(默认只读),点击右上角「新增」可创建新记录。
        </Text>
      </div>

      {/*
       * Card: flex 1 1 auto + min-height:0
       *
       * min-height:0 是 flex-column 子项在 flex 容器里的关键约束(经验 1469959):
       * 若不加,内容撑高时会把 Card 推高,从而继续撑破外层,触发 app-content__body 滚动条。
       *
       * 内部也必须是 flex column,将 Search / Table / Pagination 三段分列:
       * - Search flex 0
       * - Table 容器 flex 1 1 auto, min-height:0(表体滚动区)
       * - Pagination flex 0(分页固定在底部)
       */}
      <Card
        style={{
          width: '100%',
          flex: '1 1 auto',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
        styles={{
          body: {
            flex: '1 1 auto',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            padding: 16,
            gap: 16,
          },
        }}
      >
        {/* 顶部搜索区(flex 0) */}
        <Form<QueryForm>
          form={queryForm}
          layout="inline"
          style={{ marginBottom: 0, rowGap: 8, flexShrink: 0 }}
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

        {/*
         * Table 容器:表体滚动唯一区域。
         * flex 1 + min-height:0 → 被 flex 分配高度,超出部分内部滚动。
         * overflow:hidden → 防止 antd Table 在某些情况下撑破容器产生双滚动条。
         * ref 交给 ResizeObserver,动态测量 → 更新 scroll.y。
         */}
        <div
          ref={tableWrapRef}
          style={{
            flex: '1 1 auto',
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          <Table<FormRecord>
            rowKey="id"
            loading={loading}
            columns={columns}
            dataSource={data}
            scroll={{ x: 1100, y: scrollY }}
            pagination={false}
          />
        </div>

        {/*
         * 独立 Pagination 栏:在 Card 底部、flex 0、永远可见。
         * 不跟随表体滚动 → 用户不用每次翻页都滚到页面底部(用户的核心诉求)。
         */}
        <div
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            paddingTop: 8,
            borderTop: '1px solid var(--border-muted, rgba(0,0,0,0.06))',
          }}
        >
          <Pagination
            current={page}
            pageSize={pageSize}
            total={total}
            showSizeChanger
            showQuickJumper
            showTotal={(t) => `共 ${t} 条`}
            onChange={(p, ps) => {
              setPage(p)
              setPageSize(ps)
            }}
          />
        </div>
      </Card>
    </section>
  )
}
