import { useState } from 'react'
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
} from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import DynamicListItem from './DynamicListItem'
import MentorSelectField from '@/components/MentorSelectField'
import type { FormData } from './types'

const { Title, Text } = Typography
const { TextArea } = Input

/**
 * FormPage - Ant Design 复杂表单演示
 *
 * 演示内容:
 * 1. 直接使用 Form.Item(不做二次封装,保持原生体验)
 * 2. Form.List 动态增减表单项
 * 3. 条件渲染(根据字段值显示/隐藏其他字段)
 * 4. 自定义校验规则(密码强度、自定义 validator)
 * 5. 表单布局: Row / Col 栅格
 */
export default function FormPage() {
  const [form] = Form.useForm<FormData>()
  const [submitting, setSubmitting] = useState(false)

  /*
   * React 哲学:依赖驱动渲染(Derived from State)
   *
   * Form.useWatch 订阅 role 字段,role 变化时本组件自动重渲染,
   * 下方条件渲染由此推导;无需手动注册监听器或写 effect 同步,
   * "状态即视图源"。
   */
  const roleValue = Form.useWatch('role', form)

  /*
   * React 哲学:副作用隔离与资源生命周期
   *
   * antd 6 中静态 message API 已废弃,改用 App.useApp() 获取实例,
   * 这样 message 能读取到 AntdApp 注入的主题与上下文。
   */
  const { message } = App.useApp()

  /** 提交处理 */
  const handleSubmit = async (values: FormData) => {
    setSubmitting(true)
    /* 模拟异步提交 */
    await new Promise((resolve) => setTimeout(resolve, 1000))
    console.log('表单提交数据:', values)
    message.success('提交成功,请查看控制台输出')
    setSubmitting(false)
  }

  /** 重置表单 */
  const handleReset = () => {
    form.resetFields()
    message.info('表单已重置')
  }

  return (
    <section className="page">
      <Title level={2}>复杂表单演示</Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
        演示 Ant Design 表单的高级用法:封装表单项组件、动态增减字段、条件渲染、自定义校验。
      </Text>

      {/*
       * 表单宽度由外部容器(.page → layout__main)决定,
       * 此处只声明铺满父容器,不在组件内部硬编码固定宽度。
       */}
      <Card style={{ width: '100%' }}>
        <Form<FormData>
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{ gender: 'male', role: 'personal' }}
          autoComplete="off"
        >
          {/* ---- 基本信息 ----
           * antd 6 的 Divider orientation 类型定义存在歧义(与分割线方向共用 Orientation),
           * 此处省略该属性,使用默认左对齐 */}
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
              {
                pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
                message: '需包含大写字母、小写字母和数字',
              },
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

          {/* ---- 角色与性别 ---- */}
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

          {/*
           * React 哲学:声明式渲染(Declarative)
           *
           * 用 roleValue === 'employee' 直接声明"该字段何时出现",
           * 而非命令式地"先隐藏再显示"。状态变化时 React 自动推导视图,
           * 表单的 unmount 即卸载其数据,符合"受控可见性"。
           */}
          {roleValue === 'employee' && (
            <>
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
            </>
          )}

          {/* ---- 导师选择(MentorSelectField 复用组件演示) ---- */}
          <Divider>导师信息</Divider>

          {/*
           * React 哲学:组件复用 / 开闭原则
           *
           * MentorSelectField 是完全独立的复用表单项:
           * - 外部只需传 name(字段名) 与 label,不用关心内部如何弹窗、查询详情、回填。
           * - 组件内部负责 label 按钮、展示表、Modal、调用 services/mentor.ts。
           * - 选中后的 mentorId 会自动写入到 form.values.mentorId,提交时直接取即可。
           *   其他任何需要"选导师"的表单,直接嵌入此行代码就能复用。
           */}
          <MentorSelectField name="mentorId" label="指导导师" />

          {/* ---- 联系方式(Form.List 动态增减) ---- */}
          <Divider>联系方式(动态增减)</Divider>

          {/*
           * React 哲学:列表的 key 与受控增删
           *
           * Form.List 通过 field.key 提供稳定标识,渲染时以 key 作 React key;
           * 增删调用 add/remove,Form.List 内部维护 name 数组,
           * 行组件无需关心自己在数组中的位置。
           */}
          <Form.List name="contacts">
            {(fields, { add, remove }) => (
              <>
                {fields.map((field) => (
                  <DynamicListItem
                    key={field.key}
                    field={field}
                    showRemove={fields.length > 0}
                    onRemove={() => remove(field.name)}
                  />
                ))}
                <Button
                  type="dashed"
                  onClick={() => add()}
                  block
                  icon={<PlusOutlined />}
                  style={{ marginBottom: 16 }}
                >
                  添加联系方式
                </Button>
              </>
            )}
          </Form.List>

          {/* ---- 个人简介 ---- */}
          <Form.Item label="个人简介" name="bio" extra="最多 200 字">
            <TextArea
              placeholder="简单介绍一下自己..."
              maxLength={200}
              showCount
              rows={4}
            />
          </Form.Item>

          {/* ---- 协议确认 ---- */}
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
            <Checkbox>
              我已阅读并同意 <a href="#">用户协议</a> 和 <a href="#">隐私政策</a>
            </Checkbox>
          </Form.Item>

          {/* ---- 操作按钮 ---- */}
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={submitting}>
                提交
              </Button>
              <Button onClick={handleReset}>重置</Button>
              <Button
                type="link"
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
          </Form.Item>
        </Form>
      </Card>
    </section>
  )
}
