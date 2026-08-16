import { useMemo } from 'react'
import { useAppSelector } from '@/store/hooks'
import { hasPermission } from '@/permissions/permissionUtils'
import type { PermissionCode, PermissionCustomFn } from '@/permissions/permissionUtils'
import type { RoleKey } from '@/store/slices/userSlice'

/**
 * usePermission Hook —— 组件内用 Hook 方式读权限
 *
 * 典型用法:
 *   const { canEdit } = usePermission({ codes: ['record:edit'] })
 *   return canEdit ? <EditBtn /> : null
 *
 * 设计:
 *  - 单一真源:统一从 Redux user.info.roles 读取角色
 *  - 计算通过 useMemo 派生,依赖不变时不会重复判断(性能 + 引用稳定)
 *  - 返回结构把 result(最终结果) 连同 userRoles / hasPermission 函数一起暴露,
 *    方便调用方做更多组合判断(开闭原则)。
 */
export interface UsePermissionOptions<T = unknown> {
  /** 需要的权限码(任一满足即通过) */
  codes?: PermissionCode[]
  /** 需要的角色(任一满足即通过) */
  roles?: RoleKey[]
  /** 额外业务校验函数 */
  customFn?: PermissionCustomFn<T>
  /** 传给 customFn 的业务数据 */
  extra?: T
}

export interface UsePermissionResult {
  /** 最终是否有权限 */
  hasAuth: boolean
  /** 当前用户角色(便于调用方做进一步判断) */
  userRoles: RoleKey[]
  /**
   * 行内二次校验函数,常见于 list.map 场景:
   *  const { check } = usePermission()
   *  {data.map(r => check({roles:['admin'], customFn: () => r.owner === me}) && <DelBtn />)}
   */
  check: (options: Omit<UsePermissionOptions, 'extra'> & { extra?: unknown }) => boolean
}

export function usePermission<T = unknown>(options: UsePermissionOptions<T> = {}): UsePermissionResult {
  const userRoles = useAppSelector((state) => state.user.info.roles)

  const hasAuth = useMemo(() => {
    /*
     * 用 as 断言为 unkown 版参数——hasPermission 的实现里 customFn 第二个参数
     * 只在存在时透传,不做结构访问,因此 T 子类型兼容问题在这里不会出错。
     * 把"显式不匹配"的 TS 报错在边界处解决,保持调用方 T 泛型的友好。
     */
    return hasPermission({ userRoles, ...(options as UsePermissionOptions<unknown>) })
  }, [userRoles, options.codes, options.roles, options.customFn, options.extra])

  /*
   * check 也用 useMemo 保持引用稳定(依赖 userRoles),
   * 避免传递给子组件时触发不必要的重渲染。
   */
  const check = useMemo(
    () => (opts: UsePermissionOptions) =>
      hasPermission({ userRoles, ...(opts as UsePermissionOptions<unknown>) }),
    [userRoles],
  )

  return { hasAuth, userRoles, check }
}
