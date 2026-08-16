import { useMemo } from 'react'
import {
  Button,
  Card,
  Divider,
  Select,
  Space,
  Tag,
  Typography,
  App,
  Tooltip,
  Table,
} from 'antd'
import type { ColumnsType } from 'antd/es/table/interface'
import {
  DeleteOutlined,
  EditOutlined,
  DownloadOutlined,
  CheckOutlined,
  EyeOutlined,
  PlusOutlined,
  TeamOutlined,
  KeyOutlined,
} from '@ant-design/icons'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { setRoles } from '@/store/slices/userSlice'
import type { RoleKey } from '@/store/slices/userSlice'
import { usePermission } from '@/permissions/usePermission'
import { withPermission, PermissionGuard } from '@/permissions/withPermission'

const { Title, Paragraph, Text, Link } = Typography

/*
 * ==============================================================
 * 第 1 步:基于业务组件预封装一些"带权限的通用按钮"(HOC 最佳实践 ①)。
 * 这里演示"角色-权限码 + fallback 模式"的典型组合。
 * ==============================================================
 */

/** 创建按钮:仅 admin/manager/employee 可见 */
const CreateButton = withPermission({
  codes: ['record:create'],
  fallback: 'disable',
  tooltipText: '当前角色无创建权限,请联系管理员申请',
})(Button)

/** 导出按钮:仅 admin/manager/auditor 可见 */
const ExportButton = withPermission({
  codes: ['record:export'],
  fallback: 'disable',
  tooltipText: '仅管理员 / 经理 / 审核人员可导出',
})(Button)

/** 删除按钮:仅 admin 有,但其他角色 "disable + tooltip"(最直观的演示效果) */
const DeleteButton = withPermission({
  codes: ['record:delete'],
  fallback: 'disable',
  tooltipText: '删除是高风险操作,仅管理员可执行',
})(Button)

/** 审批按钮 */
const ApproveButton = withPermission({
  codes: ['record:approve'],
  fallback: 'disable',
  tooltipText: '需要 manager 及以上角色进行审批',
})(Button)

/** 用户管理按钮:hide 模式(无权限直接不渲染,避免泄露敏感功能名称) */
const UserManageButton = withPermission({
  codes: ['system:user-manage'],
  fallback: 'hide',
})(Button)

const ROLE_OPTIONS: { value: RoleKey; label: string }[] = [
  { value: 'admin', label: '管理员 (所有权限)' },
  { value: 'manager', label: '经理 (创建/编辑/导出/审批)' },
  { value: 'employee', label: '员工 (创建/查看/编辑)' },
  { value: 'auditor', label: '审核 (查看/导出/审计)' },
  { value: 'guest', label: '访客 (仅查看)' },
]

/*
 * 演示用"业务数据"列表:
 * status = 草稿/已提交/已通过 —— 用来演示 customFn"业务级别"的判断
 * (例如只有草稿状态才能编辑,哪怕角色允许)。
 */
interface DemoRecord {
  id: string
  owner: string
  status: '草稿' | '已提交' | '已通过'
  amount: string
  createdAt: string
}

const DEMO_DATA: DemoRecord[] = [
  { id: 'R001', owner: '张员工', status: '草稿', amount: '¥ 1,200', createdAt: '2026-08-12' },
  { id: 'R002', owner: '王同事', status: '已提交', amount: '¥ 6,800', createdAt: '2026-08-13' },
  { id: 'R003', owner: '李经理', status: '已通过', amount: '¥ 12,500', createdAt: '2026-08-14' },
]

export default function PermissionDemoPage() {
  const { message } = App.useApp()
  const dispatch = useAppDispatch()
  const currentRoles = useAppSelector((state) => state.user.info.roles)
  const currentUserName = useAppSelector((state) => state.user.info.name)

  const { hasAuth: canView } = usePermission({ codes: ['record:view'] })

  /*
   * ==============================================================
   * role-selector:切不同角色看效果
   * ==============================================================
   */
  const handleRoleChange = (roles: RoleKey[]) => {
    dispatch(setRoles(roles))
    message.success(`已切换为角色:${roles.join(',')},界面权限自动更新`)
  }

  /*
   * ==============================================================
   * 表格列 —— 用 withPermission 运行时配置(最佳实践 ②:customFn + record)
   * ==============================================================
   */
  const columns: ColumnsType<DemoRecord> = [
    { title: '编号', dataIndex: 'id', width: 90 },
    { title: '创建人', dataIndex: 'owner', width: 100 },
    { title: '金额', dataIndex: 'amount', width: 120 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: (s: DemoRecord['status']) => {
        const color: Record<DemoRecord['status'], string> = {
          草稿: 'default',
          已提交: 'processing',
          已通过: 'success',
        }
        return <Tag color={color[s]}>{s}</Tag>
      },
    },
    { title: '创建时间', dataIndex: 'createdAt', width: 130 },
    {
      title: '操作',
      key: 'action',
      width: 360,
      fixed: 'right',
      render: (_, record) => {
        /*
         * 编辑按钮:除了角色要求,还需要"状态是草稿"才能编辑
         * 这就是 customFn 的典型场景 —— 权限矩阵通过后 + 业务规则再判断。
         */
        return (
          <Space size="small" wrap>
            {/* 查看:record:view 所有角色基本都有 */}
            <PermissionGuard
              codes={['record:view']}
              fallback="disable"
              tooltipText="您当前不可查看详情"
            >
              <Button size="small" icon={<EyeOutlined />}>查看</Button>
            </PermissionGuard>

            {/*
             * 编辑:角色(admin/manager/employee) + 业务规则(仅 草稿状态 可编辑)
             * HOC 运行时模式:直接把 customFn / extra 通过 runtime props 传
             */}
            <EditButton
              size="small"
              icon={<EditOutlined />}
              codes={['record:edit']}
              fallback="disable"
              tooltipText={record.status === '草稿' ? '当前角色无编辑权限' : '已提交/已通过的数据不可编辑'}
              extra={record}
              customFn={(_roles, r?: DemoRecord) => r?.status === '草稿'}
              onClick={() => message.success(`编辑记录 ${record.id}`)}
            >
              编辑
            </EditButton>

            {/* 审批:角色(admin/manager) + 状态=已提交 */}
            <ApproveButton
              size="small"
              type="primary"
              ghost
              icon={<CheckOutlined />}
              codes={['record:approve']}
              fallback="disable"
              tooltipText={record.status === '已提交' ? '当前角色不可审批' : '只有已提交状态才能审批'}
              extra={record}
              customFn={(_roles, r?: DemoRecord) => r?.status === '已提交'}
              onClick={() => message.success(`已通过 ${record.id}`)}
            >
              审批
            </ApproveButton>

            {/* 删除:hide 模式 → 无权限直接消失 */}
            <DeleteButton
              size="small"
              danger
              icon={<DeleteOutlined />}
              codes={['record:delete']}
              fallback="hide"
              onClick={() => message.warning(`已删除 ${record.id}`)}
            >
              删除
            </DeleteButton>
          </Space>
        )
      },
    },
  ]

  const tags = useMemo(
    () =>
      currentRoles.map((r) => {
        const found = ROLE_OPTIONS.find((o) => o.value === r)
        return (
          <Tag key={r} color={r === 'admin' ? 'red' : r === 'manager' ? 'gold' : 'blue'}>
            {found?.label ?? r}
          </Tag>
        )
      }),
    [currentRoles],
  )

  return (
    <section className="page">
      <Title level={2}>权限演示 (withPermission HOC + usePermission Hook)</Title>
      <Paragraph type="secondary">
        本页展示统一的权限方案:<Text code>withPermission</Text> 高阶组件、
        <Text code>usePermission</Text> Hook、<Text code>PermissionGuard</Text> 便捷 Guard。
        支持三种模式组合:权限码矩阵、角色匹配、<Text code>customFn</Text> 业务自定义判断;
        无权限支持 <Text code>hide</Text> 隐藏或 <Text code>disable</Text> 禁用 + Tooltip 提示。
        <br />
        角色状态来自 Redux <Link underline strong>userSlice</Link>,可通过下方 Select 模拟切换。
      </Paragraph>

      {/* 切角色演示 */}
      <Card size="small" style={{ width: '100%', marginBottom: 16 }}>
        <Space wrap>
          <Text strong><KeyOutlined style={{ marginRight: 4 }} />当前用户:</Text>
          <Tag color="geekblue">{currentUserName}</Tag>
          <Text strong><TeamOutlined style={{ marginRight: 4 }} />当前角色:</Text>
          <Space size={4}>{tags}</Space>
          <div style={{ flex: 1 }} />
          <Select
            mode="multiple"
            value={currentRoles}
            onChange={handleRoleChange}
            options={ROLE_OPTIONS}
            style={{ minWidth: 320 }}
            placeholder="选择一个或多个角色模拟切换"
            allowClear
            maxTagCount="responsive"
          />
        </Space>
      </Card>

      {/* 1. 顶部功能按钮(HOC 静态封装模式) */}
      <Card
        title={
          <Space>
            <span>① 工具栏(HOC 静态封装)</span>
            <Tag color="purple">withPermission(Button) 预封装 + fallback=disable</Tag>
          </Space>
        }
        style={{ width: '100%', marginBottom: 16 }}
        extra={
          <Tooltip title="无此权限直接隐藏(Hide 模式)">
            <UserManageButton type="primary" icon={<TeamOutlined />}>用户管理(仅 admin 可见,hide 模式)</UserManageButton>
          </Tooltip>
        }
      >
        <Space wrap>
          <CreateButton type="primary" icon={<PlusOutlined />} onClick={() => message.success('进入创建')}>
            新建记录
          </CreateButton>
          <ExportButton icon={<DownloadOutlined />} onClick={() => message.success('导出中...')}>
            导出 Excel
          </ExportButton>
          <DeleteButton danger icon={<DeleteOutlined />} onClick={() => message.error('高风险操作确认已触发')}>
            批量删除
          </DeleteButton>
        </Space>
        <Divider titlePlacement="left" style={{ marginTop: 16 }}>说明</Divider>
        <ul style={{ margin: 0, paddingLeft: 20, color: 'var(--text)' }}>
          <li><Text code>CreateButton</Text>:codes=['record:create'], fallback=disable。当角色是 guest/auditor 会看到置灰按钮,悬停提示 "无创建权限"。</li>
          <li><Text code>ExportButton</Text>:export 权限允许 admin/manager/auditor。员工切过去会看到 disable + tooltip。</li>
          <li><Text code>UserManageButton</Text>:fallback=hide,非 admin 时 <Text strong>根本不渲染</Text>(最右侧 Card extra 区域可自行验证)。</li>
        </ul>
      </Card>

      {/* 2. Hook 模式 + PermissionGuard */}
      <Card
        title={
          <Space>
            <span>② Hook + PermissionGuard 条件渲染</span>
            <Tag color="cyan">usePermission + PermissionGuard</Tag>
          </Space>
        }
        style={{ width: '100%', marginBottom: 16 }}
      >
        <Space wrap>
          {canView && <Tag color="green">canView = true(通过 record:view 权限码判断)</Tag>}
          {!canView && <Tag color="red">canView = false</Tag>}

          <Divider type="vertical" />

          <PermissionGuard codes={['system:role-manage']} fallback="disable" tooltipText="需要 admin 角色">
            <Button icon={<KeyOutlined />}>角色权限配置</Button>
          </PermissionGuard>

          <PermissionGuard roles={['manager']} fallback="disable" tooltipText="当前不是经理">
            <Button>经理专属看板入口</Button>
          </PermissionGuard>

          <PermissionGuard
            roles={['admin', 'manager']}
            fallback="disable"
            tooltipText="自定义 customFn 示例:当前时间秒数为偶数时才允许(演示纯函数扩展)"
            customFn={() => new Date().getSeconds() % 2 === 0}
          >
            <Button type="primary" ghost>每偶数秒才允许的开关(依赖 customFn)</Button>
          </PermissionGuard>
        </Space>
      </Card>

      {/* 3. 表格 + 行级 customFn 业务判断 */}
      <Card
        title={
          <Space>
            <span>③ 行级权限(权限码 + 业务 customFn 组合)</span>
            <Tag color="orange">withPermission runtime props + extra / customFn</Tag>
          </Space>
        }
        style={{ width: '100%' }}
      >
        <Paragraph type="secondary" style={{ marginTop: 0 }}>
          编辑按钮:除角色通过外,需要 <Text strong>状态 === 草稿</Text>;
          审批按钮:除角色通过外,需要 <Text strong>状态 === 已提交</Text>。
          这两种"数据状态"判断都通过 customFn 在运行时传入 record 来实现。
        </Paragraph>
        <Table<DemoRecord>
          rowKey="id"
          columns={columns}
          dataSource={DEMO_DATA}
          pagination={false}
          scroll={{ x: 900 }}
        />
      </Card>
    </section>
  )
}

/* ==============================================================
 * 封装"编辑按钮"二次(便于在上面的 columns 中做自定义 runtime props)。
 * 外层 HOC config 给默认值,运行时再覆盖 customFn / extra,
 * 这就是 "withPermission 分层组合" 的推荐写法。
 * ============================================================== */
const EditButton = withPermission({
  codes: ['record:edit'],
  fallback: 'disable',
  tooltipText: '无编辑权限',
})(Button)
