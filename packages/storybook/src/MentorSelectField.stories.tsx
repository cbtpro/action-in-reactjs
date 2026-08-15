import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { Button, Form, Space, Typography } from 'antd'
import { MentorSelectField } from '@workspace/ui'

const { Text } = Typography

const meta: Meta<typeof MentorSelectField> = {
  title: 'Mentor/MentorSelectField',
  component: MentorSelectField,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: [
          '导师选择表单项组件，集成了弹窗、展示表和 Form 字段绑定。',
          '',
          '**复用方式**（任何 antd Form 中直接嵌入即可）：',
          '```tsx',
          '<Form form={form}>',
          '  <MentorSelectField name="mentorId" label="指导导师" />',
          '</Form>',
          '```',
          '',
          '选中后 `form.getFieldsValue().mentorId` 即为所选导师主键。',
        ].join('\n'),
      },
    },
  },
  tags: ['autodocs'],
}
export default meta

type Story = StoryObj<typeof MentorSelectField>

/**
 * 基础用法：必填校验 + 提交时获取 mentorId。
 */
function DefaultStory() {
  const [form] = Form.useForm<{ mentorId?: string }>()
  const [submitted, setSubmitted] = useState<string | null>(null)

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Form
        form={form}
        layout="vertical"
        onFinish={(values) => setSubmitted(values.mentorId ?? '(空)')}
        style={{ maxWidth: 800 }}
      >
        <MentorSelectField name="mentorId" label="指导导师" />
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
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Form
        form={form}
        layout="vertical"
        onFinish={(values) => setSubmitted(values.mentorId ?? '(空)')}
        style={{ maxWidth: 800 }}
      >
        <MentorSelectField name="mentorId" label="指导导师(选填)" required={false} />
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
      <MentorSelectField name="mentorId" label="指导导师(预填)" />
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
