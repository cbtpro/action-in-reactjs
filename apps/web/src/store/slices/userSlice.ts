import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

/**
 * 预定义系统角色 —— 前端权限判断的统一枚举 key
 *
 * 实际业务中会从登录接口返回角色列表,
 * 这里提供一份标准枚举,保证业务代码不会散落字符串硬编码角色名。
 */
export type RoleKey =
  | 'admin'       // 管理员:所有权限
  | 'manager'     // 经理:查看/导出/审核类操作
  | 'employee'    // 员工:查看/创建/编辑自己的数据
  | 'auditor'     // 审核:只读 + 审批
  | 'guest'       // 访客:只读公开数据

/**
 * 当前登录用户
 * - id / name / avatar 可用于 UI 展示
 * - roles 是权限判断的唯一权威来源(前端仅负责展示和交互隐藏,
 *   真正的权限校验仍需在服务端执行)。
 */
export interface UserInfo {
  id: string
  name: string
  avatar?: string
  roles: RoleKey[]
}

interface UserState {
  info: UserInfo
}

/*
 * 初始化角色:['employee']
 * 便于权限演示页在默认状态下即可看到无权限效果(管理员功能被隐藏/禁用)。
 */
const initialState: UserState = {
  info: {
    id: 'u-0001',
    name: '张员工',
    roles: ['employee'],
  },
}

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    setRoles(state, action: PayloadAction<RoleKey[]>) {
      state.info.roles = action.payload
    },
    addRole(state, action: PayloadAction<RoleKey>) {
      if (!state.info.roles.includes(action.payload)) {
        state.info.roles = [...state.info.roles, action.payload]
      }
    },
    removeRole(state, action: PayloadAction<RoleKey>) {
      state.info.roles = state.info.roles.filter((r) => r !== action.payload)
    },
    /*
     * setUser 用于整体替换用户信息(模拟登录 / 切换账号场景)。
     * 演示页会用它切不同角色体验权限差异。
     */
    setUser(state, action: PayloadAction<Partial<UserInfo>>) {
      state.info = { ...state.info, ...action.payload }
    },
  },
})

export const { setRoles, addRole, removeRole, setUser } = userSlice.actions
export default userSlice.reducer
