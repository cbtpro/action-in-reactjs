import { useEffect, useState } from 'react'
import { Button, Flex, Form, Input, Table, App } from 'antd'
import type { ColumnsType } from 'antd/es/table/interface'
import type { Rule } from 'antd/es/form'
import { CloseOutlined, UserOutlined } from '@ant-design/icons'
import MentorSelectModal from './MentorSelectModal'
import { getMentorDetail, type MentorUser } from './services/mentor'

export interface MentorSelectFieldProps {
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
 * MentorSelectField - 复用的导师选择表单项
 *
 * 设计遵循:
 * - 开闭原则:内部实现独立演进,使用方只管嵌入,不关心弹窗/详情/回填
 * - 单一职责:本组件只做"字段绑定 + 展示 + 选择 + 回填"的串联
 * - 分离关注:展示层(Table)、交互层(Modal)、数据层(services)解耦
 *
 * 使用方式(任何 antd Form 中直接嵌入即可):
 *   <Form form={form}>
 *     <MentorSelectField name="mentorId" label="指导导师" />
 *   </Form>
 *
 * 父级表单通过 form.getFieldValue('mentorId') 即可拿到选中的导师主键。
 */
export default function MentorSelectField({
  name,
  label = '导师',
  required = true,
  rules,
  modalTitle = '选择导师',
}: MentorSelectFieldProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const [detail, setDetail] = useState<MentorUser | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const { message } = App.useApp()

  /*
   * React 哲学:依赖驱动渲染
   *
   * Form.useWatch 订阅父级表单中 name 字段的值:
   * - 外部 setFieldsValue / resetFields 时,此处同步响应
   * - 不需要手动监听 form 实例事件,状态即真源
   */
  const form = Form.useFormInstance()
  const mentorId = Form.useWatch<string | undefined>(name, form)

  /*
   * React 哲学:副作用隔离
   *
   * 只在 mentorId 变化时触发详情查询。
   * - 有 id: 拉详情回填展示区
   * - 无 id(清空/重置): 清空展示区
   */
  useEffect(() => {
    if (!mentorId) {
      setDetail(null)
      return
    }
    let active = true
    setDetailLoading(true)
    void (async () => {
      try {
        const data = await getMentorDetail(mentorId)
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
  }, [mentorId, message])

  /**
   * Modal 确定回调:
   * - 用选中项的主键重新查一次详情(保证是最新完整数据)
   * - 成功后将主键写入父级表单字段(触发表单校验)
   * - 关闭弹窗
   */
  const handleConfirm = async (user: MentorUser) => {
    try {
      setDetailLoading(true)
      const fullDetail = await getMentorDetail(user.id)
      if (fullDetail) {
        setDetail(fullDetail)
        form.setFieldValue(name, fullDetail.id)
        form.setFields([{ name, errors: [] }])
        setModalOpen(false)
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

  /** 移除已选导师 */
  const handleRemove = () => {
    form.setFieldValue(name, undefined)
    setDetail(null)
    message.info('已移除所选导师')
  }

  /** 默认校验规则:必填 */
  const mergedRules: Rule[] = rules ?? (
    required
      ? [{ required: true, message: `请选择${typeof label === 'string' ? label : '导师'}` }]
      : []
  )

  return (
    <>
      {/*
       * React 哲学:容器与展示分层
       *
       * 外层 Form.Item —— 只负责 label 行渲染与整体错误提示外观
       *   label 内嵌入"添加导师"按钮(Flex 右对齐)
       *   name 不挂在外层,避免对子元素类型的限制(有 name 时 antd 要求子元素为受控组件)
       *
       * 内层 noStyle Form.Item —— 只做字段绑定与校验
       *   用一个隐藏的 Input 承接 value/onChange,占位即可,无视觉表现。
       *   真正的视觉由下方独立的展示 Table 负责。
       */}
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
        {/* ===== 展示 Table(只读) ===== */}
        <MentorDisplayTable data={detail} loading={detailLoading} onRemove={handleRemove} />

        {/* ===== 字段绑定与校验(无视觉) ===== */}
        <Form.Item name={name} noStyle rules={mergedRules}>
          <Input style={{ display: 'none' }} />
        </Form.Item>
      </Form.Item>

      {/* ===== 选择弹窗 ===== */}
      <MentorSelectModal
        open={modalOpen}
        title={modalTitle}
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
  data: MentorUser | null
  loading: boolean
  onRemove: () => void
}

/**
 * MentorDisplayTable
 *
 * 关注点分离:把"展示已选导师"这个独立视图抽到内部子组件,
 * 外层 MentorSelectField 只负责串联数据流和交互逻辑。
 */
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
