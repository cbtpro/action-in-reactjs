import type { RoleKey } from '@/store/slices/userSlice'

/**
 * 权限码 —— 每个可被鉴权的业务动作分配一个字符串权限码
 *
 * 设计遵循:开闭原则
 *  - 新增业务动作 → 追加 PermissionCode 枚举
 *  - 修改某动作允许角色 → 改 DEFAULT_PERMISSION_MATRIX
 *  - 调用方用同一个 withPermission / usePermission API,无代码变动
 */
export type PermissionCode =
  /* 基础操作:页面级访问 */
  | 'page:dashboard'
  | 'page:user-center'
  | 'page:settings'
  /* 数据操作:CRUD 类 */
  | 'record:create'
  | 'record:view'
  | 'record:edit'
  | 'record:delete'
  | 'record:export'
  /* 审批/财务 */
  | 'record:approve'
  | 'record:audit'
  /* 系统管理 */
  | 'system:user-manage'
  | 'system:role-manage'

/**
 * 自定义校验函数 —— 允许业务方传入"数据状态级别"的判断。
 * 典型场景:只有 record.status === '草稿' 才能编辑,即使角色允许。
 *
 * 注:角色级别判断由 withPermission 内置自动执行,
 * 这里只提供"角色通过之后的额外业务判断",结果 false 仍视为无权限。
 */
export type PermissionCustomFn<T = unknown> = (userRoles: RoleKey[], extra?: T) => boolean

/*
 * 权限矩阵 —— 动作 → 允许的角色列表。
 * 使用 Record 统一管理,新增角色/权限只需往对应数组里追加 key。
 */
const DEFAULT_PERMISSION_MATRIX: Record<PermissionCode, RoleKey[]> = {
  /* 页面 */
  'page:dashboard': ['admin', 'manager', 'employee', 'auditor', 'guest'],
  'page:user-center': ['admin', 'manager', 'employee', 'auditor'],
  'page:settings': ['admin'],
  /* CRUD */
  'record:create': ['admin', 'manager', 'employee'],
  'record:view': ['admin', 'manager', 'employee', 'auditor', 'guest'],
  'record:edit': ['admin', 'manager', 'employee'],
  'record:delete': ['admin'],
  'record:export': ['admin', 'manager', 'auditor'],
  /* 审批 */
  'record:approve': ['admin', 'manager'],
  'record:audit': ['auditor'],
  /* 系统 */
  'system:user-manage': ['admin'],
  'system:role-manage': ['admin'],
}

/**
 * hasPermission 纯函数 —— 单一职责:只做权限判断,不读任何外部上下文
 *
 * 判断顺序(AND 关系,全部满足才返回 true):
 *   1. 用户拥有 admin 角色 → 短路返回 true(超级管理员例外)
 *   2. 用户 roles 与 permissions 矩阵对应动作的数组有交集
 *   3. 若传入 customFn → customFn 返回 true
 *
 * 纯函数好处:可在组件外复用、可单测、结果可缓存(如果权限码+角色稳定)。
 */
export function hasPermission(params: {
  /** 用户拥有的角色 */
  userRoles: RoleKey[]
  /** 需要的权限码(任一满足即通过) */
  codes?: PermissionCode[]
  /** 需要的角色(任一满足即通过,不查矩阵) */
  roles?: RoleKey[]
  /** 额外的业务级别判断,入参是 userRoles + 调用方的 extra */
  customFn?: PermissionCustomFn
  /** 传给 customFn 的业务数据(例如 record 本身) */
  extra?: unknown
}): boolean {
  const { userRoles, codes, roles, customFn, extra } = params

  // admin 超级管理员:矩阵类权限一律放行,自定义函数仍会校验(避免业务规则被绕过)
  const isAdmin = userRoles.includes('admin')

  /* ---- 第 1 步:codes / roles 矩阵校验 ---- */
  let matrixPass = true
  if (codes && codes.length > 0) {
    matrixPass = isAdmin || codes.some((c) => {
      const allow = DEFAULT_PERMISSION_MATRIX[c] ?? []
      return allow.some((r) => userRoles.includes(r))
    })
  } else if (roles && roles.length > 0) {
    matrixPass = isAdmin || roles.some((r) => userRoles.includes(r))
  }
  if (!matrixPass) return false

  /* ---- 第 2 步:自定义业务校验(和矩阵 AND) ---- */
  if (customFn && !customFn(userRoles, extra)) return false

  return true
}
