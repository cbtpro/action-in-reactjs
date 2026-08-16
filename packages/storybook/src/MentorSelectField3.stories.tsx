import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { Button, Form, Space, Typography } from 'antd'
import { MentorSelectField3 } from '@workspace/ui'

const { Text } = Typography

const meta: Meta<typeof MentorSelectField3> = {
  title: 'Mentor/MentorSelectField3 (纯手动桥接版)',
  component: MentorSelectField3,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: [
          '**v3 - 纯手动桥接版**（`Form.useFormInstance` + `form.setFieldValue`）。',
          '',
          '核心机制：',
          '- **读值**：`Form.useWatch(name, form)` 订阅字段最新值（响应 `setFieldsValue` / `resetFields`）',
          '- **写值**：`form.setFieldValue(name, value)` 直接写入 Form 实例',
          '- **校验**：独立的 `noStyle Form.Item(name + rules)` 仅把 name/rules 挂到校验树，不参与渲染',
          '',
          '对比 v1 / v2：',
          '- ✅ **无隐藏 DOM hack**（没有 `display:none` Input）',
          '- ✅ **不依赖受控协议**（子组件 props 无需 value/onChange 约定）',
          '- ❌ 必须在 Form 上下文内（需要 `useFormInstance`）',
          '',
          '适用场景：不接受任何"隐藏控件"痕迹的洁癖代码，或展示层结构复杂不适合作为标准受控控件。',
        ].join('\n'),
      },
    },
  },
  tags: ['autodocs'],
}
export default meta

type Story = StoryObj<typeof MentorSelectField3>

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
        <MentorSelectField3 name="mentorId" label="指导导师" />
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
 * 预填值：通过 initialValues 设置初始 mentorId，
 * 组件自动查询详情并回填展示表；打开弹窗时自动回显选中态。
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
      <MentorSelectField3 name="mentorId" label="指导导师(预填)" />
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
        <MentorSelectField3
          name="mentorId"
          label="指导导师(点击行选中)"
          clickRowToSelect
        />
        <Form.Item>
          <Button type="primary" htmlType="submit">
            提交
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
