import { useEffect, useMemo, useState } from 'react'
import {
  Button,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tooltip,
  message,
} from 'antd'
import type { ColumnsType, TableRowSelection } from 'antd/es/table/interface'
import {
  searchMentors,
  type MentorUser,
} from './services/mentor'

export type MentorSelectMode = 'single' | 'multiple'

export interface MentorSelectModalProps {
  /** 是否打开弹窗 */
  open: boolean
  /** 关闭回调 */
  onCancel: () => void
  /**
   * 确定回调:
   * - mode='single'  时参数为单个 MentorUser
   * - mode='multiple'时参数为 MentorUser[]
   * 若未选择,组件会自行阻止关闭
   */
  onConfirm: (user: MentorUser | MentorUser[]) => void | Promise<void>
  /** 弹窗标题 */
  title?: string
  /** 确定按钮 loading 状态(可选,若 onConfirm 为异步组件内部已处理 loading) */
  confirmLoading?: boolean
  /**
   * 选择模式:
   * - 'single'   单选(antd radio 列),默认
   * - 'multiple' 多选(antd checkbox 列),支持跨分页保留选中态
   */
  mode?: MentorSelectMode
  /**
   * 当前已选中的导师主键(回填用)。
   * 受控模式:外部传入后,弹窗打开时会自动回显选中态,
   * 即使切换到其它分页再回来,选中态也会跟随 value 保持一致。
   * - mode='single'  接受 string | null
   * - mode='multiple'接受 string[] | null
   */
  value?: string | string[] | null
  /**
   * 是否启用"点击整行即选中"。默认 true,
   * 单击行任意单元格 = 选中/切换该行,与选择列(radio/checkbox)同一真源:
   * - single: 行点击直接替换选中项
   * - multiple:行点击 toggle 该行(不影响其它已选项)
   */
  clickRowToSelect?: boolean
}

interface SearchForm {
  name?: string
  department?: string
}

/* ------------------------------------------------------------------ */
/*  辅助:统一把外部 value 规范化成 Key[]                                */
/* ------------------------------------------------------------------ */
function normalizeValue(value: string | string[] | null | undefined): React.Key[] {
  if (value == null) return []
  if (Array.isArray(value)) return value.filter(Boolean) as React.Key[]
  return [value]
}

/**
 * MentorSelectModal - 选择导师弹窗(复用组件)
 *
 * 能力:
 * - 姓名 + 部门 搜索
 * - Table 单/多选(通过 mode prop 切换,使用 antd rowSelection 原生特性)
 * - 前端分页 + 后端分页查询(多选支持跨分页保留选中态)
 * - 受控 props: open / onCancel / onConfirm / value
 * - clickRowToSelect 默认开启:行点击与选择列共用 selectedKeys 单一真源
 *
 * 复用方式:
 *   const [open, setOpen] = useState(false)
 *   <MentorSelectModal
 *     mode="multiple"
 *     open={open}
 *     onCancel={() => setOpen(false)}
 *     onConfirm={(users) => { console.log('选中:', users) }}
 *   />
 */
export default function MentorSelectModal({
  open,
  onCancel,
  onConfirm,
  title = '选择导师',
  confirmLoading,
  mode = 'single',
  value,
  clickRowToSelect = true,
}: MentorSelectModalProps) {
  const [searchForm] = Form.useForm<SearchForm>()
  const [data, setData] = useState<MentorUser[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  /*
   * React 哲学:单一真源
   *
   * 不论 mode 是 single / multiple,内部统一以 selectedKeys: React.Key[] 表达选中态,
   * 由 single 模式下最多长度为 1、multiple 模式下允许任意长度。
   * rowSelection.onChange、行点击、外部 value 回填,
   * 所有入口都只操作这一个 state,避免出现"radio 选中了但行点击状态不同步"的分裂。
   */
  const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([])
  const [submitting, setSubmitting] = useState(false)

  const [messageApi, contextHolder] = message.useMessage()

  /*
   * React 哲学:依赖驱动渲染 + 回填真源唯一
   *
   * 选中态同步策略:
   * 1. 关闭弹窗:selectedKeys 清空,避免下次打开残留临时选择
   * 2. 打开弹窗且外部有 value:用 value(规范化后)初始化 selectedKeys
   * 3. 打开期间 value 发生变化(如父级 resetFields / setFieldsValue):同步覆盖
   */
  useEffect(() => {
    if (!open) {
      setSelectedKeys([])
      return
    }
    setSelectedKeys(normalizeValue(value))
  }, [open, value])

  useEffect(() => {
    if (!open) return
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
   * 当前最终选中 keys(外部回填 value 与内部临时态 selectedKeys 的统一决策):
   * - 打开弹窗且外部有 value → 以外部 value 为真源(保证重置/回填响应)
   * - 否则 → 以内部临时态 selectedKeys 为真源
   */
  const currentKeys: React.Key[] = useMemo(() => {
    const v = normalizeValue(value)
    return v.length > 0 ? v : selectedKeys
  }, [value, selectedKeys])

  /**
   * React 哲学:Antd 原生能力优先 / 配置驱动
   *
   * rowSelection 的 type 直接由 mode 派生,radio / checkbox 切分支零耦合。
   * 所有选中变更只走统一的 onChange → setSelectedKeys,避免"点框/点行"逻辑分叉。
   */
  const rowSelection: TableRowSelection<MentorUser> = useMemo(
    () => ({
      type: mode === 'multiple' ? 'checkbox' : 'radio',
      selectedRowKeys: currentKeys,
      preserveSelectedRowKeys: mode === 'multiple', // 多选跨分页保留选择
      onChange: (keys) => {
        if (mode === 'single') {
          // 单选:最多保留一个(antd radio 本身已限制,这里做防御性裁剪)
          setSelectedKeys(keys.slice(-1))
        } else {
          setSelectedKeys(keys)
        }
      },
      columnTitle: '选择',
    }),
    [mode, currentKeys],
  )

  /**
   * 行点击(受控于 clickRowToSelect = 默认 true)
   *
   * 单一真源策略:不直接改 DOM / 不自己造状态,
   * 而是通过同一 setSelectedKeys 入口改写选中态,保证:
   * - 行点击选中 ←→ 选择列(radio/checkbox)选中,永远同值
   * - single 模式:直接替换为当前行 id
   * - multiple 模式:toggle 当前行 id(与 antd checkbox 列自然语义一致)
   */
  const handleRow = (record: MentorUser) => {
    if (!clickRowToSelect) return {}
    return {
      style: { cursor: 'pointer' },
      onClick: () => {
        const id = record.id
        if (mode === 'single') {
          setSelectedKeys([id])
        } else {
          setSelectedKeys((prev) => {
            const exists = prev.includes(id)
            return exists ? prev.filter((k) => k !== id) : [...prev, id]
          })
        }
      },
    }
  }

  /**
   * 表格列定义(声明式配置驱动)
   */
  const columns: ColumnsType<MentorUser> = useMemo(
    () => [
      { title: '姓名', dataIndex: 'name', width: 100, ellipsis: { showTitle: false }, render: (v: string) => <Tooltip title={v}>{v}</Tooltip> },
      { title: '工号', dataIndex: 'employeeNo', width: 120 },
      { title: '部门', dataIndex: 'department', width: 160, ellipsis: { showTitle: false }, render: (v: string) => <Tooltip title={v}>{v}</Tooltip> },
      { title: '职称', dataIndex: 'title', width: 120, ellipsis: { showTitle: false }, render: (v: string) => <Tooltip title={v}>{v}</Tooltip> },
      { title: '手机号', dataIndex: 'phone', width: 130 },
      { title: '邮箱', dataIndex: 'email', width: 220, ellipsis: { showTitle: false }, render: (v: string) => <Tooltip title={v}>{v}</Tooltip> },
    ],
    [],
  )

  /**
   * 确定:按 mode 校验 → 收集完整对象 → 调用对外 onConfirm
   *
   * 多选场景:当前页 data + 跨页已选(不在当前页)合并去重后全量回传,
   * 调用方无需关心分页边界,回传结构直接 Promise.all 查询详情即可。
   */
  const handleOk = async () => {
    if (currentKeys.length === 0) {
      messageApi.warning(mode === 'single' ? '请先选择一位导师' : '请至少选择一位导师')
      return
    }
    const pageMap = new Map(data.map((u) => [u.id, u]))
    // 优先用当前页对象(字段完整)
    const chosen: MentorUser[] = currentKeys
      .map((k) => {
        const id = String(k)
        return pageMap.get(id) ?? ({ id } as MentorUser)
      })
    setSubmitting(true)
    try {
      if (mode === 'single') {
        await onConfirm(chosen[0]!)
      } else {
        await onConfirm(chosen)
      }
    } catch (err) {
      console.error(err)
      messageApi.error('选择失败,请重试')
    } finally {
      setSubmitting(false)
    }
  }

  /*
   * 响应式宽度(上下限钳制策略)
   */
  const modalStyle = useMemo(
    () => ({ minWidth: 760, maxWidth: 900, width: '90vw' }),
    [],
  )

  return (
    <>
      {contextHolder}
      <Modal
        title={title}
        open={open}
        onCancel={onCancel}
        onOk={handleOk}
        okButtonProps={{ loading: confirmLoading ?? submitting }}
        mask={{ closable: false }}
        destroyOnHidden
        style={modalStyle}
      >
        <Form<SearchForm>
          form={searchForm}
          layout="inline"
          style={{ marginBottom: 16, rowGap: 8 }}
          onFinish={handleSearch}
        >
          <Form.Item name="name" label="姓名">
            <Input placeholder="请输入姓名" allowClear style={{ minWidth: 160, width: 'auto' }} />
          </Form.Item>
          <Form.Item name="department" label="部门">
            <Select
              placeholder="请选择部门"
              allowClear
              style={{ minWidth: 180 }}
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
              {mode === 'multiple' && (
                <Tooltip title="仅清空本次弹窗内临时选择;外部已回填 value 不受影响">
                  <Button
                    onClick={() => setSelectedKeys([])}
                    disabled={currentKeys.length === 0}
                  >
                    清空选择({currentKeys.length})
                  </Button>
                </Tooltip>
              )}
            </Space>
          </Form.Item>
        </Form>

        <Table<MentorUser>
          rowKey="id"
          size="middle"
          loading={loading}
          columns={columns}
          dataSource={data}
          rowSelection={rowSelection}
          onRow={handleRow}
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
          scroll={{ x: 900, y: 360 }}
        />
      </Modal>
    </>
  )
}
