import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { Button, Space, message } from 'antd'
import { MentorSelectModal } from '@workspace/ui'
import type { MentorUser } from '@workspace/ui'

const meta: Meta<typeof MentorSelectModal> = {
  title: 'Mentor/MentorSelectModal',
  component: MentorSelectModal,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: [
          '选择导师弹窗组件。',
          '',
          '**能力**：姓名 + 部门搜索、分页、Table 行单选（antd 原生 radio）。',
          '',
          '复用方式：',
          '```tsx',
          'const [open, setOpen] = useState(false)',
          '<MentorSelectModal',
          '  open={open}',
          '  onCancel={() => setOpen(false)}',
          '  onConfirm={(user) => console.log(user.id)}',
          '/>',
          '```',
        ].join('\n'),
      },
    },
  },
  tags: ['autodocs'],
}
export default meta

type Story = StoryObj<typeof MentorSelectModal>

/**
 * 基础用法：点击按钮打开弹窗，选择导师后关闭。
 *
 * 弹窗内所有 API 请求由 MSW 在 Storybook 环境中拦截，
 * 与真实后端体验一致。
 */
function DefaultStory() {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<MentorUser | null>(null)

  return (
    <Space direction="vertical" size="large">
      <Button type="primary" onClick={() => setOpen(true)}>
        打开选择导师弹窗
      </Button>
      {selected && (
        <div>
          已选：{selected.name}（{selected.department} / {selected.title}）
        </div>
      )}
      <MentorSelectModal
        open={open}
        onCancel={() => setOpen(false)}
        onConfirm={(user) => {
          setSelected(user)
          setOpen(false)
        }}
      />
    </Space>
  )
}

export const Default: Story = {
  render: () => <DefaultStory />,
}

/**
 * 异步确认：onConfirm 返回 Promise 时按钮自动 loading。
 */
function AsyncConfirmStory() {
  const [open, setOpen] = useState(false)
  const [messageApi, contextHolder] = message.useMessage()

  return (
    <>
      {contextHolder}
      <Button type="primary" onClick={() => setOpen(true)}>
        异步确认
      </Button>
      <MentorSelectModal
        open={open}
        title="异步确认导师"
        onCancel={() => setOpen(false)}
        onConfirm={async (user) => {
          await new Promise((resolve) => setTimeout(resolve, 1000))
          messageApi.success(`已提交导师：${user.name}（${user.id}）`)
          setOpen(false)
        }}
      />
    </>
  )
}

export const AsyncConfirm: Story = {
  render: () => <AsyncConfirmStory />,
}
