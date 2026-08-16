import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { Button, Form, Space, Typography } from 'antd'
import { MentorSelectField2 } from '@workspace/ui'

const { Text } = Typography

const meta: Meta<typeof MentorSelectField2> = {
  title: 'Mentor/MentorSelectField2',
  component: MentorSelectField2,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: [
          '导师选择表单项组件（受控组件版本，无隐藏 Input）。',
          '',
          '与 MentorSelectField 功能等价，差异在于字段绑定方式：',
          '- **v1**：外层 Form.Item 负责外观，内层 `noStyle` Form.Item + 隐藏 `<Input>` 承接 value/onChange',
          '- **v2**：`Form.Item` 直接包裹受控子组件，通过 antd 原生 `value`/`onChange` 协议注入字段值',
          '',
          '**复用方式**（任何 antd Form 中直接嵌入即可）：',
          '```tsx',
          '<Form form={form}>',
          '  <MentorSelectField2 name="mentorId" label="指导导师" />',
          '</Form>',
          '```',
          '',
          '选中后 `form.getFieldsValue().mentorId` 即为所选导师主键。',
          '',
          '> 完整实现与对比文档见 [Mentor / 实现与使用文档] 页面。',
        ].join('\n'),
      },
    },
  },
  tags: ['autodocs'],
}
export default meta

type Story = StoryObj<typeof MentorSelectField2>

/**
 * 基础用法：必填校验 + 提交时获取 mentorId。
 */
function DefaultStory() {
  const [form] = Form.useForm<{ mentorId?: string }>()
  const [submitted, setSubmitted] = useState<string | null>(null)

  return (
    <Space orientation="vertical" size="large" style={{ width: '100%' }}>
      <Form
        form={form}
        layout="vertical"
        onFinish={(values) => setSubmitted(values.mentorId ?? '(空)')}
        style={{ maxWidth: 800 }}
      >
        <MentorSelectField2 name="mentorId" label="指导导师" />
        <Form.Item>
          <Button type="primary" htmlType="submit">
            提交
          </Button>
          <Button
            style={{ marginLeft: 8 }}
            onClick={() => form.resetFields()}
          >
            重置
          </Button>
        </Form.Item>
      </Form>
      {submitted && (
        <Text type="secondary">
          提交结果 mentorId = <strong>{submitted}</strong>
        </Text>
      )}
    </Space>
  )
}

export const Default: Story = {
  render: () => <DefaultStory />,
}

/**
 * 非必填：通过 required={false} 关闭校验。
 */
function OptionalStory() {
  const [form] = Form.useForm<{ mentorId?: string }>()
  const [submitted, setSubmitted] = useState<string | null>(null)

  return (
    <Space orientation="vertical" size="large" style={{ width: '100%' }}>
      <Form
        form={form}
        layout="vertical"
        onFinish={(values) => setSubmitted(values.mentorId ?? '(空)')}
        style={{ maxWidth: 800 }}
      >
        <MentorSelectField2 name="mentorId" label="指导导师(选填)" required={false} />
        <Form.Item>
          <Button type="primary" htmlType="submit">
            提交
          </Button>
        </Form.Item>
      </Form>
      {submitted !== null && (
        <Text type="secondary">
          提交结果 mentorId = <strong>{submitted}</strong>
        </Text>
      )}
    </Space>
  )
}

export const Optional: Story = {
  render: () => <OptionalStory />,
}

/**
 * 预填值：通过 initialValues 设置初始 mentorId，
 * 组件自动查询详情并回填展示表。
 */
function PrefilledStory() {
  const [form] = Form.useForm<{ mentorId?: string }>()

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={{ mentorId: 'U00003' }}
      style={{ maxWidth: 800 }}
    >
      <MentorSelectField2 name="mentorId" label="指导导师(预填)" />
      <Form.Item>
        <Button onClick={() => form.setFieldsValue({ mentorId: 'U00010' })}>
          切换为 U00010
        </Button>
        <Button
          style={{ marginLeft: 8 }}
          onClick={() => form.setFieldsValue({ mentorId: undefined })}
        >
          清空
        </Button>
      </Form.Item>
    </Form>
  )
}

export const Prefilled: Story = {
  render: () => <PrefilledStory />,
}

/**
 * 点击行选中模式：传入 clickRowToSelect，
 * 弹窗内单击导师行任意位置即可选中（默认仅点 radio 列）。
 */
function ClickRowToSelectStory() {
  const [form] = Form.useForm<{ mentorId?: string }>()
  const [submitted, setSubmitted] = useState<string | null>(null)

  return (
    <Space orientation="vertical" size="large" style={{ width: '100%' }}>
      <Form
        form={form}
        layout="vertical"
        onFinish={(values) => setSubmitted(values.mentorId ?? '(空)')}
        style={{ maxWidth: 800 }}
      >
        <MentorSelectField2
          name="mentorId"
          label="指导导师(点击行选中)"
          clickRowToSelect
        />
        <Form.Item>
          <Button type="primary" htmlType="submit">
            提交
          </Button>
          <Button
            style={{ marginLeft: 8 }}
            onClick={() => form.resetFields()}
          >
            重置
          </Button>
        </Form.Item>
      </Form>
      {submitted && (
        <Text type="secondary">
          提交结果 mentorId = <strong>{submitted}</strong>
        </Text>
      )}
    </Space>
  )
}

export const ClickRowToSelect: Story = {
  render: () => <ClickRowToSelectStory />,
}
