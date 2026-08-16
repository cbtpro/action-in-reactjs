import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { Button, Space, Typography, message } from 'antd'
import { MentorSelectModal } from '@workspace/ui'
import type { MentorUser } from '@workspace/ui'

const { Text } = Typography

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
    <Space orientation="vertical" size="large">
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

/**
 * 点击行选中：开启 clickRowToSelect 后，
 * 单击行任意位置即可选中（默认仅点击 radio 列触发）。
 */
function ClickRowToSelectStory() {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<MentorUser | null>(null)

  return (
    <Space orientation="vertical" size="large">
      <Button type="primary" onClick={() => setOpen(true)}>
        开启点击行选中模式
      </Button>
      {selected && (
        <div>
          已选：{selected.name}（{selected.department} / {selected.title}）
        </div>
      )}
      <MentorSelectModal
        open={open}
        clickRowToSelect
        onCancel={() => setOpen(false)}
        onConfirm={(user) => {
          setSelected(user)
          setOpen(false)
        }}
      />
    </Space>
  )
}

export const ClickRowToSelect: Story = {
  render: () => <ClickRowToSelectStory />,
}

/**
 * 回填选中值：通过 value 传入已选中的导师主键，
 * 弹窗打开时自动回显对应行的 radio 选中态。
 * 适用于编辑场景：上次已选的导师，再次打开弹窗时仍保持选中。
 */
function WithValueStory() {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState<string | null>('U00005')
  const [selected, setSelected] = useState<MentorUser | null>(null)

  return (
    <Space orientation="vertical" size="large">
      <Space>
        <Button type="primary" onClick={() => setOpen(true)}>
          打开弹窗(回填 U00005)
        </Button>
        <Button onClick={() => setValue('U00020')}>切换回填为 U00020</Button>
        <Button onClick={() => setValue(null)}>清除回填</Button>
      </Space>
      <Text type="secondary">当前回填值 value = <strong>{value ?? '(空)'}</strong></Text>
      {selected && (
        <div>
          确认选中：{selected.name}（{selected.department} / {selected.title}）
        </div>
      )}
      <MentorSelectModal
        open={open}
        value={value}
        onCancel={() => setOpen(false)}
        onConfirm={(user) => {
          setSelected(user)
          setValue(user.id)
          setOpen(false)
        }}
      />
    </Space>
  )
}

export const WithValue: Story = {
  render: () => <WithValueStory />,
}
