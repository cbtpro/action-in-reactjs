import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { Button, Form, Space, Switch, Typography } from 'antd'
import { MentorSelectField5 } from '@workspace/ui'

const { Text, Paragraph } = Typography

const meta: Meta<typeof MentorSelectField5> = {
  title: 'Mentor/MentorSelectField5 (FieldContext 自定义控件)',
  component: MentorSelectField5,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: [
          '**v5 - FieldContext 自定义控件版本**（直接消费 Form.Item 下发的公开 Context）。',
          '',
          '核心机制：',
          '- `Form.Item(name + rules)` 通过 React Context 下发字段元信息',
          '- 子组件内部 `Form.Item.useStatus()` 直接拿到：`{errors, status, warnings}`（antd 公开 API）',
          '- 通过 `Form.useFormInstance()` + `Form.useWatch(name, form)` 实现字段值的读写（NamePath 安全）',
          '- 通过读出来的 `errors` 驱动自定义错误区域（渲染在 Table 上方红色提示区）',
          '',
          '最强能力：',
          '- ✅ **自定义错误展示**：不再使用 Form.Item 默认下方错误行，可用任何 UI 表现 errors',
          '- ✅ **路径安全**：setFieldValue/useWatch 按 NamePath 路由，List 嵌套场景无错写风险',
          '- ✅ **可驱动更高级 UI**：可根据 errors/touched/validating 组合状态做细粒度外观',
          '- ✅ 使用 **公开 API**（FormItemInputContext 是 antd 文档中的公开 Context），无内部 API 风险',
          '',
          '`customErrorDisplay` prop 控制：开启后错误显示在 Table 上方（自定义 UI），关闭则走 Form.Item 默认下方错误。',
        ].join('\n'),
      },
    },
  },
  tags: ['autodocs'],
}
export default meta

type Story = StoryObj<typeof MentorSelectField5>

/**
 * 基础用法：customErrorDisplay=true，错误自定义显示在 Table 上方。
 * 点击提交未选择导师，可见红底黄字的自定义错误区域出现在 Table 上方。
 */
function DefaultStory() {
  const [form] = Form.useForm<{ mentorId?: string }>()
  const [submitted, setSubmitted] = useState<string | null>(null)

  return (
    <Space orientation="vertical" size="large" style={{ width: '100%' }}>
      <Paragraph type="secondary">
        本故事启用 <Text code>customErrorDisplay</Text>：错误区域出现在导师表格上方。
        直接点"提交"体验自定义错误样式。
      </Paragraph>
      <Form
        form={form}
        layout="vertical"
        onFinish={(values) => setSubmitted(values.mentorId ?? '(空)')}
        style={{ maxWidth: 800 }}
      >
        <MentorSelectField5 name="mentorId" label="指导导师" customErrorDisplay />
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
 * 切换 customErrorDisplay：对比自定义错误 vs 默认 Form.Item 错误样式。
 */
function ToggleCustomErrorStory() {
  const [form] = Form.useForm<{ mentorId?: string }>()
  const [custom, setCustom] = useState(true)
  const [submitted, setSubmitted] = useState<string | null>(null)

  return (
    <Space orientation="vertical" size="large" style={{ width: '100%' }}>
      <FlexRow label="customErrorDisplay">
        <Switch checked={custom} onChange={setCustom} />
        <Text type="secondary" style={{ marginLeft: 8 }}>
          {custom ? '自定义错误（Table 上方）' : '默认 Form.Item 错误（label 下方）'}
        </Text>
      </FlexRow>
      <Form
        form={form}
        layout="vertical"
        onFinish={(values) => setSubmitted(values.mentorId ?? '(空)')}
        style={{ maxWidth: 800 }}
      >
        <MentorSelectField5
          name="mentorId"
          label="指导导师"
          customErrorDisplay={custom}
        />
        <Form.Item>
          <Button type="primary" htmlType="submit">
            提交（先点看错误效果）
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

function FlexRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Text type="secondary" style={{ minWidth: 120 }}>{label}:</Text>
      {children}
    </div>
  )
}

export const ToggleCustomError: Story = {
  render: () => <ToggleCustomErrorStory />,
}

/**
 * 预填 + 回填：FieldContext 的 value 自动随 initialValues / setFieldsValue 同步。
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
      <MentorSelectField5
        name="mentorId"
        label="指导导师(预填)"
        customErrorDisplay
        clickRowToSelect
      />
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
