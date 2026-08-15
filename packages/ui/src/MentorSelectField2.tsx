import { useEffect, useState } from 'react'
import { Button, Flex, Form, Table, App } from 'antd'
import type { ColumnsType } from 'antd/es/table/interface'
import type { Rule } from 'antd/es/form'
import { CloseOutlined, UserOutlined } from '@ant-design/icons'
import MentorSelectModal from './MentorSelectModal'
import { getMentorDetail, type MentorUser } from './services/mentor'

export interface MentorSelectField2Props {
  /** Form 字段名,存储导师主键 id */
  name: string
  /** 表单项标签,默认"导师" */
  label?: React.ReactNode
  /** 是否必填,默认 true */
  required?: boolean
  /** 自定义校验规则,不传则按 required 自动生成 */
  rules?: Rule[]
  /** 弹窗标题 */
  modalTitle?: string
}

/**
 * MentorSelectField2 - 复用的导师选择表单项(无隐藏 Input 版本)
 *
 * 与 MentorSelectField 功能等价,差异在于字段绑定方式:
 * - v1: 外层 Form.Item 负责外观,内层 noStyle Form.Item + 隐藏 Input 承接 value/onChange
 * - v2: Form.Item 直接包裹受控子组件,通过 antd 原生 value/onChange 协议注入字段值
 *
 * 设计遵循:
 * - 开闭原则:对外 API 与 v1 保持一致,使用方无需感知内部实现差异
 * - 单一职责:MentorFieldControl 只做"受控展示 + 值变更通知",
 *   外层组件只做"label + 弹窗状态 + 校验规则"的编排
 * - 分离关注:Table(展示层)、Modal(交互层)、services(数据层)各司其职
 *
 * 使用方式(任何 antd Form 中直接嵌入即可):
 *   <Form form={form}>
 *     <MentorSelectField2 name="mentorId" label="指导导师" />
 *   </Form>
 *
 * 父级表单通过 form.getFieldValue('mentorId') 即可拿到选中的导师主键。
 */
export default function MentorSelectField2({
  name,
  label = '导师',
  required = true,
  rules,
  modalTitle = '选择导师',
}: MentorSelectField2Props) {
  const [modalOpen, setModalOpen] = useState(false)

  /** 默认校验规则:必填 */
  const mergedRules: Rule[] = rules ?? (
    required
      ? [{ required: true, message: `请选择${typeof label === 'string' ? label : '导师'}` }]
      : []
  )

  /*
   * React 哲学:受控组件模式
   *
   * Form.Item 携带 name 后,会通过 cloneElement 向子组件注入 value 与 onChange:
   * - value: 当前字段值(即 mentorId)
   * - onChange: 调用后自动更新表单字段值并触发校验
   *
   * 无需隐藏 Input —— 子组件本身就是受控表单控件,
   * 与 antd 内置 Select / DatePicker 的机制完全一致。
   */
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
    >
      <MentorFieldControl
        modalOpen={modalOpen}
        onModalClose={() => setModalOpen(false)}
        modalTitle={modalTitle}
      />
    </Form.Item>
  )
}

/* ------------------------------------------------------------------ */
/*  受控子组件:Form.Item 通过 value/onChange 协议与之通信              */
/* ------------------------------------------------------------------ */

interface MentorFieldControlProps {
  /**
   * 当前字段值(mentorId),由 Form.Item 注入。
   * 当 form.setFieldsValue / resetFields 时自动同步。
   */
  value?: string
  /**
   * 值变更回调,由 Form.Item 注入。
   * 调用后 antd 自动更新字段值并触发校验。
   */
  onChange?: (value: string | undefined) => void
  /** 弹窗打开状态(由外层组件管理) */
  modalOpen: boolean
  /** 关闭弹窗回调 */
  onModalClose: () => void
  /** 弹窗标题 */
  modalTitle: string
}

/**
 * MentorFieldControl — 受控表单控件
 *
 * 接收 Form.Item 注入的 value / onChange,负责:
 * - 根据 value(mentorId) 拉取详情并展示 Table
 * - 选择导师时调用 onChange(id) 更新表单值
 * - 移除导师时调用 onChange(undefined) 清空表单值
 *
 * 无需自行调用 form.setFieldValue 或 Form.useWatch ——
 * 值的读写全部通过受控协议完成,与 antd 原生控件行为一致。
 */
function MentorFieldControl({
  value,
  onChange,
  modalOpen,
  onModalClose,
  modalTitle,
}: MentorFieldControlProps) {
  const [detail, setDetail] = useState<MentorUser | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const { message } = App.useApp()

  /*
   * React 哲学:依赖驱动渲染 + 副作用隔离
   *
   * value 即真源 —— 当 Form.Item 注入新的 mentorId 时自动触发详情查询:
   * - 有 id: 拉详情回填展示区
   * - 无 id(清空/重置): 清空展示区
   */
  useEffect(() => {
    if (!value) {
      setDetail(null)
      return
    }
    let active = true
    setDetailLoading(true)
    void (async () => {
      try {
        const data = await getMentorDetail(value)
        if (active) setDetail(data)
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
  }, [value, message])

  /**
   * Modal 确定回调:
   * - 用选中项的主键重新查一次详情(保证是最新完整数据)
   * - 成功后通过 onChange 将主键回传给 Form.Item(触发表单校验)
   * - 关闭弹窗
   */
  const handleConfirm = async (user: MentorUser) => {
    try {
      setDetailLoading(true)
      const fullDetail = await getMentorDetail(user.id)
      if (fullDetail) {
        setDetail(fullDetail)
        onChange?.(fullDetail.id)
        onModalClose()
      } else {
        message.error('未查询到该导师详情')
      }
    } catch (err) {
      console.error(err)
      message.error('选择失败,请重试')
    } finally {
      setDetailLoading(false)
    }
  }

  /** 移除已选导师:通过 onChange 清空表单字段值 */
  const handleRemove = () => {
    onChange?.(undefined)
    setDetail(null)
    message.info('已移除所选导师')
  }

  return (
    <>
      <MentorDisplayTable data={detail} loading={detailLoading} onRemove={handleRemove} />
      <MentorSelectModal
        open={modalOpen}
        title={modalTitle}
        onCancel={onModalClose}
        onConfirm={handleConfirm}
      />
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  内部子组件:已选导师展示表(只读 + 移除操作)                          */
/* ------------------------------------------------------------------ */

interface MentorDisplayTableProps {
  data: MentorUser | null
  loading: boolean
  onRemove: () => void
}

function MentorDisplayTable({ data, loading, onRemove }: MentorDisplayTableProps) {
  const columns: ColumnsType<MentorUser> = [
    { title: '姓名', dataIndex: 'name', width: 120 },
    { title: '工号', dataIndex: 'employeeNo', width: 120 },
    { title: '部门', dataIndex: 'department', width: 180 },
    { title: '职称', dataIndex: 'title', width: 140 },
    { title: '手机号', dataIndex: 'phone', width: 140 },
    { title: '邮箱', dataIndex: 'email' },
    {
      title: '操作',
      key: 'action',
      width: 80,
      align: 'center',
      render: () => (
        <Button
          type="text"
          danger
          size="small"
          icon={<CloseOutlined />}
          onClick={onRemove}
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
      dataSource={data ? [data] : []}
      pagination={false}
      locale={{ emptyText: '暂未选择导师,请点击右上角"添加导师"按钮' }}
    />
  )
}
