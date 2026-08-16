import { useEffect, useState } from 'react'
import {
  App,
  Button,
  Card,
  Form,
  Input,
  Select,
  Radio,
  Checkbox,
  DatePicker,
  Space,
  Divider,
  Typography,
  Row,
  Col,
  Tag,
  Spin,
  Tooltip,
} from 'antd'
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  EditOutlined,
  PlusOutlined,
  StopOutlined,
} from '@ant-design/icons'
import { useNavigate, useSearchParams, useOutletContext } from 'react-router-dom'
import dayjs from 'dayjs'
import DynamicListItem from './DynamicListItem'
import { MentorSelectField } from '@workspace/ui'
import type { FormData } from './types'
import { getFormRecord, type FormRecord } from '@/services/formRecord'
import type { OutletContext } from '@/components/Layout'

const { Title, Text } = Typography
const { TextArea } = Input

/**
 * 页面模式:
 * - create: 无 ?id= → 新建,默认可编辑
 * - detail: 有 ?id= 且 editable=false → 只读详情(默认进入)
 * - edit:   有 ?id= 且 editable=true  → 编辑模式
 */
type PageMode = 'create' | 'detail' | 'edit'

/**
 * FormPage - Ant Design 复杂表单演示(支持新建/详情/编辑三模式)
 *
 * 模式判定逻辑:
 * - URL 无 ?id → 新建模式(editable=true),按钮为"提交/重置"
 * - URL 有 ?id → 默认为详情模式(editable=false),右上角显示"编辑"按钮
 *   点"编辑"切换为编辑模式,按钮为"保存/取消",取消回到详情模式
 */
export default function FormPage() {
  const [form] = Form.useForm<FormData>()
  const [submitting, setSubmitting] = useState(false)

  /*
   * React Router URL 参数:?id=
   * —— 列表页点击"用户名"或"查看"会把记录主键带到这里,
   * 我们据此切换"新建 / 详情 / 编辑"三套 UI。
   */
  const [searchParams] = useSearchParams()
  const recordId = searchParams.get('id')
  const navigate = useNavigate()

  const recordExists = Boolean(recordId)

  /*
   * editable: 是否允许编辑
   * - 新建(无 id): true
   * - 有 id: 默认 false(详情只读),用户点"编辑"后才 true
   */
  const [editable, setEditable] = useState<boolean>(!recordExists)
  const [loading, setLoading] = useState(false)
  const [recordMeta, setRecordMeta] = useState<Pick<FormRecord, 'id' | 'status' | 'createdAt'> | null>(null)

  const roleValue = Form.useWatch('role', form)
  const { message } = App.useApp()
  const { setActions } = useOutletContext<OutletContext>()

  /*
   * 页模式推导:纯派生状态,不另存 state —— 单一真源(editable + recordId)决定一切。
   */
  const pageMode: PageMode = !recordExists ? 'create' : editable ? 'edit' : 'detail'
  const formDisabled = !editable

  /*
   * React 哲学:副作用隔离(数据加载只发生在"id 变化"这一事件)
   *
   * URL id → 根据 id 拉详情 → setFieldsValue 回填。
   * id 为空(新建)时,不调用加载接口,保持 initialValues 即可。
   */
  useEffect(() => {
    if (!recordId) {
      setRecordMeta(null)
      return
    }
    let active = true
    setLoading(true)
    void (async () => {
      try {
        const rec = await getFormRecord(recordId)
        if (!active) return
        if (!rec) {
          message.warning(`未找到记录 ${recordId},已切换为新建模式`)
          setEditable(true)
          setRecordMeta(null)
          return
        }
        /*
         * 回填时把字符串生日转 dayjs(DatePicker 需要 dayjs)、
         * 其余字段按 FormData 原样 setFieldsValue。
         */
        const { id, status, createdAt, birthday, ...rest } = rec
        /*
         * antd DatePicker 的值是 dayjs 对象(不是字符串/ISO 格式),
         * 回填时把字符串生日转 dayjs,其余字段按 FormData 原样 setFieldsValue。
         */
        const patch: Partial<FormData> = {
          ...rest,
          birthday: birthday ? (dayjs(birthday) as unknown as string) : birthday,
        }
        form.setFieldsValue(patch)
        setRecordMeta({ id, status, createdAt })
      } catch (err) {
        console.error(err)
        if (active) message.error('加载详情失败')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordId])

  /** 提交 / 保存处理 */
  const handleSubmit = async (values: FormData) => {
    setSubmitting(true)
    await new Promise((resolve) => setTimeout(resolve, 900))
    /*
     * antd DatePicker 传出的是 dayjs 对象,但我们的 FormData 契约里 birthday 是字符串,
     * 提交时需要统一序列化 —— 开闭原则:仅在边界处做一次适配,内部数据结构保持稳定。
     */
    const submittedValues = {
      ...values,
      birthday: values.birthday
        ? dayjs(values.birthday as unknown as dayjs.Dayjs).format('YYYY-MM-DD')
        : values.birthday,
    }
    console.log(
      pageMode === 'create' ? '[新建] 表单数据:' : '[编辑] 表单数据:',
      submittedValues,
      recordId ? `记录ID = ${recordId}` : '',
    )
    message.success(pageMode === 'create' ? '创建成功,请查看控制台输出' : '保存成功,请查看控制台输出')
    setSubmitting(false)

    /*
     * 新建提交后建议切到编辑态(让用户能继续修改),
     * 编辑保存后建议切回详情态(符合"保存 → 锁定"的直觉)。
     */
    if (pageMode === 'create') {
      setEditable(true)
    } else if (pageMode === 'edit') {
      setEditable(false)
    }
  }

  /** 重置表单(仅编辑/新建可用) */
  const handleReset = () => {
    form.resetFields()
    if (pageMode === 'edit' && recordMeta) {
      /*
       * 编辑态下"重置" = 重新回填到刚进入编辑那一刻的服务器快照。
       * 最简单做法:重新触发加载 → 利用 useEffect([recordId])
       * 因依赖相同 useEffect 不会重跑,所以改用手动 reload。
       */
      void getFormRecord(recordMeta.id).then((rec) => {
        if (!rec) return
        const { birthday, ...rest } = rec
        form.setFieldsValue({
          ...rest,
          birthday: birthday ? (dayjs(birthday) as unknown as string) : birthday,
        })
      })
    }
    message.info('表单已重置')
  }

  /** 取消编辑 → 回到详情模式(丢弃未保存改动) */
  const handleCancelEdit = () => {
    /* 先 resetFields 回退到上一次服务器快照 */
    form.resetFields()
    setEditable(false)
    message.info('已取消编辑')
  }

  /** 返回列表 */
  const handleBack = () => {
    navigate('/list')
  }

  /** 切到编辑模式 */
  const handleEnableEdit = () => {
    setEditable(true)
  }

  /*
   * 面包屑栏右侧操作按钮 —— 通过 Outlet context 注册到 Layout
   *
   * - 详情 → [返回列表] [编辑]
   * - 编辑 → [返回列表] [取消编辑]  (同一按钮位置切换,不消失)
   * - 新建 → [返回列表]
   *
   * React 哲学:副作用隔离 —— 页面挂载时注册,卸载时清理,
   * 避免按钮残留在其他页面的面包屑栏。
   */
  useEffect(() => {
    setActions(
      <Space>
        <Button icon={<ArrowLeftOutlined />} onClick={handleBack}>返回列表</Button>
        {pageMode === 'detail' ? (
          <Tooltip title="允许修改表单字段">
            <Button type="primary" icon={<EditOutlined />} onClick={handleEnableEdit}>
              编辑
            </Button>
          </Tooltip>
        ) : pageMode === 'edit' ? (
          <Tooltip title="放弃当前修改并返回详情">
            <Button danger icon={<StopOutlined />} onClick={handleCancelEdit}>
              取消编辑
            </Button>
          </Tooltip>
        ) : null}
      </Space>,
    )
    return () => setActions(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageMode])

  /*
   * 模式对应的 Tag 颜色与文案(用于标题右侧小角标)
   */
  const modeTag =
    pageMode === 'create' ? (
      <Tag color="geekblue" icon={<PlusOutlined />}>新建</Tag>
    ) : pageMode === 'detail' ? (
      <Tag color="default" icon={<CheckCircleOutlined />}>详情</Tag>
    ) : (
      <Tag color="orange" icon={<EditOutlined />}>编辑中</Tag>
    )

  return (
    <section className="page">
      <div style={{ display: 'flex', alignItems: 'baseline', columnGap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <Title level={2} style={{ marginBottom: 0 }}>
          {pageMode === 'create' ? '新建表单' : '表单详情'}
        </Title>
        {modeTag}
        {recordMeta?.status && <Tag color="blue">状态: {recordMeta.status}</Tag>}
        {recordMeta?.createdAt && <Text type="secondary">创建于 {recordMeta.createdAt}</Text>}
      </div>
      <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
        {pageMode === 'detail'
          ? '当前为只读模式,点击面包屑栏右侧的「编辑」可切换为可编辑模式。'
          : pageMode === 'edit'
            ? '正在编辑,完成后点击「保存」,或点击「取消」放弃修改并返回详情。'
            : '正在创建新记录,填写完成后点击「提交」。'}
      </Text>

      <Card style={{ width: '100%' }}>
        {/*
         * Spin 包裹 Form —— 进入有 id 的页面时加载详情,避免用户看到空表闪一下。
         * Form.disabled 是 antd Form 的全局属性,会递归禁用所有内置
         * Input/Select/Radio/Checkbox/DatePicker 等原生控件,
         * 自定义 MentorSelectField 单独通过 disabled={formDisabled} 做显式禁用。
         */}
        <Spin spinning={loading} tip="加载详情中...">
          <Form<FormData>
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            initialValues={{ gender: 'male', role: 'personal' }}
            autoComplete="off"
            disabled={formDisabled}
          >
            <Divider>基本信息</Divider>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="用户名"
                  name="username"
                  extra="2-20 个字符,支持字母、数字、下划线"
                  rules={[
                    { required: true, message: '请填写用户名' },
                    { min: 2, max: 20, message: '长度在 2 到 20 个字符' },
                    { pattern: /^[a-zA-Z0-9_]+$/, message: '只能包含字母、数字和下划线' },
                  ]}
                >
                  <Input placeholder="请输入用户名" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label="邮箱"
                  name="email"
                  rules={[{ required: true, message: '请填写邮箱' }]}
                >
                  <Input placeholder="请输入邮箱地址" />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item
              label="密码"
              name="password"
              extra="至少 8 位,需包含大小写字母和数字"
              rules={[
                { required: true, message: '请填写密码' },
                { min: 8, message: '密码至少 8 位' },
                { pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, message: '需包含大写字母、小写字母和数字' },
              ]}
            >
              <Input.Password placeholder="请输入密码" />
            </Form.Item>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="手机号" name="phone">
                  <Input placeholder="请输入手机号" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="生日" name="birthday">
                  <DatePicker style={{ width: '100%' }} placeholder="请选择出生日期" />
                </Form.Item>
              </Col>
            </Row>

            <Divider>角色信息</Divider>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="角色"
                  name="role"
                  rules={[{ required: true, message: '请选择角色' }]}
                >
                  <Select
                    placeholder="请选择角色"
                    options={[
                      { label: '个人用户', value: 'personal' },
                      { label: '企业员工', value: 'employee' },
                      { label: '管理员', value: 'admin' },
                    ]}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label="性别"
                  name="gender"
                  rules={[{ required: true, message: '请选择性别' }]}
                >
                  <Radio.Group>
                    <Radio value="male">男</Radio>
                    <Radio value="female">女</Radio>
                    <Radio value="other">其他</Radio>
                  </Radio.Group>
                </Form.Item>
              </Col>
            </Row>

            {roleValue === 'employee' && (
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    label="公司名称"
                    name="company"
                    rules={[{ required: true, message: '请填写公司名称' }]}
                  >
                    <Input placeholder="请输入公司名称" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="职位" name="jobTitle">
                    <Input placeholder="请输入职位名称" />
                  </Form.Item>
                </Col>
              </Row>
            )}

            <Divider>导师信息</Divider>

            {/*
             * disabled 显式传入:MentorSelectField 是自定义组件(内部由自定义
             * Button 控制弹窗/移除),antd Form.disabled 不会递归到自定义组件,
             * 所以这里显式传 disabled={formDisabled} 保证禁用一致性。
             */}
            <MentorSelectField name="mentorId" label="指导导师" disabled={formDisabled} />

            <Divider>联系方式(动态增减)</Divider>

            {/*
             * Form.List 的 "新增/移除" 按钮是自定义动态 UI,
             * 在详情模式下禁用操作: 详情模式时禁用 add 按钮 + remove 按钮。
             */}
            <Form.List name="contacts">
              {(fields, { add, remove }) => (
                <>
                  {fields.map((field) => (
                    <DynamicListItem
                      key={field.key}
                      field={field}
                      showRemove={fields.length > 0 && !formDisabled}
                      onRemove={() => remove(field.name)}
                      disabled={formDisabled}
                    />
                  ))}
                  {!formDisabled && (
                    <Button
                      type="dashed"
                      onClick={() => add()}
                      block
                      icon={<PlusOutlined />}
                      style={{ marginBottom: 16 }}
                    >
                      添加联系方式
                    </Button>
                  )}
                </>
              )}
            </Form.List>

            <Form.Item label="个人简介" name="bio" extra="最多 200 字">
              <TextArea placeholder="简单介绍一下自己..." maxLength={200} showCount rows={4} />
            </Form.Item>

            <Form.Item
              name="agree"
              valuePropName="checked"
              rules={[
                {
                  validator: (_, value) =>
                    value ? Promise.resolve() : Promise.reject(new Error('请阅读并同意用户协议')),
                },
              ]}
            >
              <Checkbox>我已阅读并同意 <a href="#">用户协议</a> 和 <a href="#">隐私政策</a></Checkbox>
            </Form.Item>

            {/* ---- 操作按钮区:详情模式按钮已移至面包屑栏 ---- */}
            {pageMode !== 'detail' && (
            <div className="form-actions">
              <div className="form-actions__inner">
                {pageMode === 'edit' ? (
                  <Space size="middle">
                    <Button
                      type="primary"
                      htmlType="submit"
                      size="large"
                      loading={submitting}
                    >
                      保存修改
                    </Button>
                    <Button size="large" onClick={handleReset}>
                      重置为初始值
                    </Button>
                  </Space>
                ) : (
                  <Space size="middle">
                    <Button
                      type="primary"
                      htmlType="submit"
                      size="large"
                      loading={submitting}
                    >
                      提交创建
                    </Button>
                    <Button size="large" onClick={handleReset}>
                      重置
                    </Button>
                    <Button
                      size="large"
                      type="default"
                      onClick={() => {
                        form.setFieldsValue({
                          username: 'demo_user',
                          email: 'demo@example.com',
                          password: 'Demo1234',
                          phone: '13800138000',
                          gender: 'male',
                          role: 'personal',
                          agree: true,
                        })
                        message.success('已填入示例数据')
                      }}
                    >
                      填入示例数据
                    </Button>
                  </Space>
                )}
              </div>
            </div>
            )}
          </Form>
        </Spin>
      </Card>
    </section>
  )
}
