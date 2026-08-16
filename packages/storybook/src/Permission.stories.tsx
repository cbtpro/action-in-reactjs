import type { Meta, StoryObj } from '@storybook/react'
import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { Button, Space, Card, Typography, Tag, Select, Divider, Table } from 'antd'
import { DeleteOutlined, ExportOutlined, PlusOutlined } from '@ant-design/icons'
import { withPermission, PermissionGuard } from '@/permissions/withPermission'
import { usePermission } from '@/permissions/usePermission'
import type { RoleKey } from '@/store/slices/userSlice'
import userReducer from '@/store/slices/userSlice'
import counterReducer from '@/store/slices/counterSlice'

const { Text, Title } = Typography

/**
 * ---- Mock Redux Store ----
 *
 * 权限组件依赖 Redux 的 user.info.roles,
 * 这里创建一个最小化 store,通过 preloadedState 注入指定角色,
 * 让每个 story 可以独立控制角色列表。
 */
function createMockStore(roles: RoleKey[]) {
  return configureStore({
    reducer: { counter: counterReducer, user: userReducer },
    preloadedState: {
      counter: { value: 0 },
      user: { info: { id: 'u-sb', name: 'Storybook 用户', roles } },
    },
  })
}

/**
 * Provider 包装器 —— roles 变化时通过 key 强制重建子树,
 * 确保 usePermission 立刻读到新的角色。
 */
function StoreProvider({
  roles,
  children,
}: {
  roles: RoleKey[]
  children: ReactNode
}) {
  const store = useMemo(() => createMockStore(roles), [roles])
  return <Provider store={store}>{children}</Provider>
}

/* ---- 预封装 HOC 按钮(静态配置,实际项目中最常用) ---- */
const CreateButton = withPermission({
  codes: ['record:create'],
  fallback: 'disable',
  tooltipText: '无创建权限',
})(Button)

const DeleteButton = withPermission({
  codes: ['record:delete'],
  fallback: 'hide',
})(Button)

const ExportButton = withPermission({
  codes: ['record:export'],
  fallback: 'disable',
  tooltipText: '当前角色无法导出,请联系管理员',
})(Button)

/* 运行时可配置的编辑按钮 */
const EditButton = withPermission()(Button)

/* ---- 角色选项 ---- */
const ROLE_OPTIONS: { label: string; value: RoleKey }[] = [
  { label: '管理员 (admin)', value: 'admin' },
  { label: '经理 (manager)', value: 'manager' },
  { label: '员工 (employee)', value: 'employee' },
  { label: '审核 (auditor)', value: 'auditor' },
  { label: '访客 (guest)', value: 'guest' },
]

const meta: Meta = {
  title: 'Permissions/权限组件',
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: [
          '基于角色的权限控制系统,包含三个核心 API:',
          '',
          '- **`withPermission`** — HOC,包裹任意组件(按钮/Card/自定义),支持 `hide`(隐藏)和 `disable`(禁用+Tooltip)两种降级模式',
          '- **`PermissionGuard`** — 便捷包装组件,用于 JSX 元素的行内权限控制',
          '- **`usePermission`** — Hook,从 Redux 读取角色并返回 `hasAuth` / `check` 方法',
          '',
          '权限判断顺序:admin 短路放行 → 权限码矩阵校验 → 自定义函数校验(AND 关系)',
        ].join('\n'),
      },
    },
  },
}
export default meta
type Story = StoryObj

/**
 * 管理员视角:所有按钮正常可用
 */
export const AdminView: Story = {
  name: '管理员视角 (全部可用)',
  render: () => (
    <StoreProvider roles={['admin']}>
      <Space size="middle">
        <CreateButton type="primary" icon={<PlusOutlined />}>
          新建
        </CreateButton>
        <ExportButton icon={<ExportOutlined />}>导出 Excel</ExportButton>
        <DeleteButton danger icon={<DeleteOutlined />}>
          批量删除
        </DeleteButton>
      </Space>
    </StoreProvider>
  ),
}

/**
 * 员工视角:新建可用,导出禁用(Tooltip),删除隐藏(不渲染)
 */
export const EmployeeView: Story = {
  name: '员工视角 (新建可用 / 导出禁用 / 删除隐藏)',
  render: () => (
    <StoreProvider roles={['employee']}>
      <Space size="middle">
        <CreateButton type="primary" icon={<PlusOutlined />}>
          新建
        </CreateButton>
        <ExportButton icon={<ExportOutlined />}>导出 Excel</ExportButton>
        <DeleteButton danger icon={<DeleteOutlined />}>
          批量删除
        </DeleteButton>
      </Space>
    </StoreProvider>
  ),
}

/**
 * 访客视角:只有查看权限,其余全部隐藏或禁用
 */
export const GuestView: Story = {
  name: '访客视角 (全部受限)',
  render: () => (
    <StoreProvider roles={['guest']}>
      <Space size="middle">
        <CreateButton type="primary">新建</CreateButton>
        <ExportButton>导出</ExportButton>
        <DeleteButton danger>删除</DeleteButton>
      </Space>
    </StoreProvider>
  ),
}

/**
 * Hide vs Disable 对比
 */
export const FallbackModes: Story = {
  name: '降级模式对比 (Hide vs Disable)',
  render: () => (
    <StoreProvider roles={['guest']}>
      <Space direction="vertical" size="large">
        <Card title="hide 模式 (不渲染)" size="small">
          <Text type="secondary">访客无 record:delete 权限,按钮完全不渲染:</Text>
          <div style={{ marginTop: 12 }}>
            <PermissionGuard codes={['record:delete']} fallback="hide">
              <Button danger>删除按钮(hide)</Button>
            </PermissionGuard>
          </div>
        </Card>
        <Card title="disable 模式 (禁用 + Tooltip)" size="small">
          <Text type="secondary">
            访客无 record:delete 权限,按钮保留但禁用,鼠标悬停提示"无删除权限":
          </Text>
          <div style={{ marginTop: 12 }}>
            <PermissionGuard
              codes={['record:delete']}
              fallback="disable"
              tooltipText="无删除权限"
            >
              <Button danger>删除按钮(disable)</Button>
            </PermissionGuard>
          </div>
        </Card>
      </Space>
    </StoreProvider>
  ),
}

/**
 * 自定义函数权限:基于数据状态判断
 */
interface DemoRecord {
  id: string
  status: '草稿' | '已提交' | '已通过'
  owner: string
}

const MOCK_DATA: DemoRecord[] = [
  { id: 'R001', status: '草稿', owner: 'me' },
  { id: 'R002', status: '已提交', owner: 'me' },
  { id: 'R003', status: '已通过', owner: 'other' },
]

export const CustomFunction: Story = {
  name: '自定义函数 (数据级权限)',
  render: () => (
    <StoreProvider roles={['employee']}>
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Text type="secondary">
          员工角色 + customFn 判断:只有 status === '草稿' 的行才能编辑,
          且 status === '已通过' 的行不能审批。鼠标悬停禁用按钮可看到 tooltip。
        </Text>
        <Table
          size="small"
          pagination={false}
          dataSource={MOCK_DATA}
          rowKey="id"
          columns={[
            { title: '编号', dataIndex: 'id' },
            { title: '状态', dataIndex: 'status' },
            {
              title: '操作',
              render: (_, record) => (
                <Space>
                  <EditButton
                    type="link"
                    size="small"
                    codes={['record:edit']}
                    fallback="disable"
                    tooltipText="只有草稿状态可编辑"
                    extra={record}
                    customFn={(_roles, r) =>
                      (r as DemoRecord)?.status === '草稿'
                    }
                  >
                    编辑
                  </EditButton>
                  <PermissionGuard
                    codes={['record:approve']}
                    fallback="disable"
                    tooltipText="已通过的不可审批"
                    extra={record}
                    customFn={(_roles, r) =>
                      (r as DemoRecord)?.status !== '已通过'
                    }
                  >
                    <Button type="link" size="small">
                      审批
                    </Button>
                  </PermissionGuard>
                </Space>
              ),
            },
          ]}
        />
      </Space>
    </StoreProvider>
  ),
}

/**
 * 交互式角色切换:实时体验不同角色的权限差异
 */
function InteractiveDemo() {
  const [roles, setRoles] = useState<RoleKey[]>(['employee'])

  return (
    <StoreProvider roles={roles}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div>
          <Text strong>当前角色: </Text>
          {roles.map((r) => (
            <Tag key={r} color="blue" style={{ marginLeft: 4 }}>
              {r}
            </Tag>
          ))}
          <Select
            mode="multiple"
            allowClear
            style={{ width: 400, marginLeft: 12 }}
            value={roles}
            onChange={(v) => setRoles(v as RoleKey[])}
            options={ROLE_OPTIONS}
            placeholder="选择角色体验权限差异"
          />
        </div>
        <Divider style={{ margin: '4px 0' }} />
        <Card title="HOC 预封装按钮 (withPermission)" size="small">
          <Space wrap>
            <CreateButton type="primary" icon={<PlusOutlined />}>
              新建 (record:create)
            </CreateButton>
            <ExportButton icon={<ExportOutlined />}>导出 (record:export)</ExportButton>
            <DeleteButton danger icon={<DeleteOutlined />}>
              删除 (record:delete, hide)
            </DeleteButton>
          </Space>
        </Card>
        <Card title="PermissionGuard 便捷包装" size="small">
          <Space wrap>
            <PermissionGuard codes={['system:user-manage']} fallback="disable" tooltipText="仅管理员可用">
              <Button>用户管理 (system:user-manage)</Button>
            </PermissionGuard>
            <PermissionGuard codes={['system:role-manage']} fallback="hide">
              <Button>角色管理 (system:role-manage, hide)</Button>
            </PermissionGuard>
            <PermissionGuard codes={['record:audit']} fallback="disable" tooltipText="仅审核员可用">
              <Button>审计 (record:audit)</Button>
            </PermissionGuard>
          </Space>
        </Card>
      </Space>
    </StoreProvider>
  )
}

export const Interactive: Story = {
  name: '交互式角色切换',
  render: () => <InteractiveDemo />,
}

/**
 * usePermission Hook 用法
 */
function HookUsageDemo() {
  const [roles, setRoles] = useState<RoleKey[]>(['employee'])

  return (
    <StoreProvider roles={roles}>
      <HookUsageInner roles={roles} onRolesChange={setRoles} />
    </StoreProvider>
  )
}

function HookUsageInner({
  roles,
  onRolesChange,
}: {
  roles: RoleKey[]
  onRolesChange: (r: RoleKey[]) => void
}) {
  const { hasAuth, userRoles, check } = usePermission({
    codes: ['record:delete'],
  })

  return (
    <Space direction="vertical" size="middle">
      <div>
        <Text strong>切换角色: </Text>
        <Select
          mode="multiple"
          allowClear
          style={{ width: 400, marginLeft: 8 }}
          value={roles}
          onChange={(v) => onRolesChange(v as RoleKey[])}
          options={ROLE_OPTIONS}
        />
      </div>
      <Card size="small">
        <Space direction="vertical">
          <Text>
            当前角色: <Text code>{userRoles.join(', ')}</Text>
          </Text>
          <Text>
            usePermission({'{ codes: ["record:delete"] }'}) → hasAuth ={' '}
            <Text strong type={hasAuth ? 'success' : 'danger'}>
              {hasAuth ? 'true ✅' : 'false ❌'}
            </Text>
          </Text>
          <Text>
            check({'{ roles: ["admin"] }'}) ={' '}
            <Text code>{check({ roles: ['admin'] }) ? 'true' : 'false'}</Text>
          </Text>
          <Text>
            check({'{ codes: ["record:export"] }'}) ={' '}
            <Text code>
              {check({ codes: ['record:export'] }) ? 'true' : 'false'}
            </Text>
          </Text>
        </Space>
      </Card>
    </Space>
  )
}

export const HookUsage: Story = {
  name: 'usePermission Hook',
  render: () => <HookUsageDemo />,
}
