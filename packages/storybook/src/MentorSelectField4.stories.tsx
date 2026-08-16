import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { Button, Form, Select, Space, Typography } from 'antd'
import { MentorSelectField4 } from '@workspace/ui'

const { Text } = Typography

const meta: Meta<typeof MentorSelectField4> = {
  title: 'Mentor/MentorSelectField4 (shouldUpdate 联动版)',
  component: MentorSelectField4,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: [
          '**v4 - shouldUpdate render-prop 版本**（声明式响应 + 级联联动）。',
          '',
          '核心机制：',
          '- 使用 `<Form.Item name noStyle shouldUpdate>` + render-prop 函数签名',
          '- render-prop 签名：`({value}, form) => ReactNode`，每次 shouldUpdate 命中自动重渲染',
          '- 默认订阅 **本字段自身**：`(prev,cur) => prev[name] !== cur[name]`，最小化重渲染',
          '- 通过 `shouldUpdate` prop 可扩展订阅兄弟字段，实现级联',
          '',
          '最大价值：',
          '- ✅ **天然适合级联场景**（选部门 → 过滤导师）',
          '- ✅ **无需 useWatch / useEffect**，UI = f(values) 纯函数心智',
          '- ❌ label 区按钮因状态共享问题移到展示区上方（交互设计略有不同）',
          '',
          '级联演示见 `WithDepartmentCascade` 故事。',
        ].join('\n'),
      },
    },
  },
  tags: ['autodocs'],
}
export default meta

type Story = StoryObj<typeof MentorSelectField4>

/**
 * 基础用法：必填校验 + 提交时获取 mentorId。
 * 注意：v4 的"添加导师"按钮展示在展示区上方(而非 label 行右侧)，
 * 以便与 shouldUpdate render-prop 共享 modalOpen 状态。
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
        <MentorSelectField4 name="mentorId" label="指导导师" />
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
 * 预填值 + 切换：
 * shouldUpdate 默认订阅 name 自身，外部 setFieldsValue 立即重渲染。
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
      <MentorSelectField4 name="mentorId" label="指导导师(预填)" />
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
 * 级联场景：选择"所属部门"后，导师区块因 shouldUpdate 订阅了 department，
 * 自动重渲染 —— 可在 render-prop 中读取最新 department 做预过滤。
 * 这里演示订阅策略；实际 Modal 可扩展支持预设筛选条件。
 */
function WithDepartmentCascadeStory() {
  type FormVals = { department?: string; mentorId?: string }
  const [form] = Form.useForm<FormVals>()
  const [submitted, setSubmitted] = useState<string | null>(null)

  return (
    <Space orientation="vertical" size="large" style={{ width: '100%' }}>
      <Text type="secondary">
        说明：选择"所属部门"后，下方导师区块会随 shouldUpdate 订阅自动重渲染。
        实际 Modal 可根据读取到的 department 预设搜索条件，实现"仅显示该部门导师"。
      </Text>
      <Form
        form={form}
        layout="vertical"
        onFinish={(values) => {
          setSubmitted(
            `部门=${values.department ?? '(空)'}，导师=${values.mentorId ?? '(空)'}`,
          )
        }}
        style={{ maxWidth: 800 }}
      >
        <Form.Item name="department" label="所属部门" rules={[{ required: true, message: '请选择部门' }]}>
          <Select
            placeholder="请选择部门"
            allowClear
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

        {/*
         * shouldUpdate = (prev, cur) => prev?.department !== cur?.department
         * 订阅 department 字段变化，导师区块随之重渲染。
         */}
        <MentorSelectField4
          name="mentorId"
          label="指导导师（部门联动）"
          shouldUpdate={(prev, cur) => prev?.department !== cur?.department}
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
          提交结果：<strong>{submitted}</strong>
        </Text>
      )}
    </Space>
  )
}

export const WithDepartmentCascade: Story = {
  render: () => <WithDepartmentCascadeStory />,
}
