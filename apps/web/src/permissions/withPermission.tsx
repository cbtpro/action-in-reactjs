import React, { isValidElement } from 'react'
import type { ComponentType, ReactElement, ReactNode } from 'react'
import { Tooltip } from 'antd'
import { usePermission } from '@/permissions/usePermission'
import type { UsePermissionOptions } from '@/permissions/usePermission'
import type { PermissionCustomFn } from '@/permissions/permissionUtils'
import type { RoleKey } from '@/store/slices/userSlice'
import type { PermissionCode } from '@/permissions/permissionUtils'

/*
 * ============================================================
 * 无权限时的兜底处理策略:
 *  - hide:隐藏 (return null)
 *  - disable:保留 UI 形态但禁用 + Tooltip 提示
 * ============================================================
 */
export type FallbackMode = 'hide' | 'disable'

export interface WithPermissionProps {
  /* 业务组件自己的 props 仍然透传(不在这里声明,用泛型组合) */
}

export interface WithPermissionOptions<TExtra = unknown> extends UsePermissionOptions<TExtra> {
  /** 无权限时的处理方式,默认 hide */
  fallback?: FallbackMode
  /** 禁用模式下 Tooltip 文案,默认 "暂无操作权限" */
  tooltipText?: ReactNode
  /** 传给 customFn 的额外业务数据(静态版,也可以通过组件 extra prop 动态传) */
  extra?: TExtra
}

/**
 * 组件自己也可通过 props 动态传权限配置(优先级高于 Options 静态配置)。
 * 场景: 列表 map 里,每一行按钮基于 record 状态需要不同 customFn,
 * 就可以通过 <PermissionedButton codes={...} customFn={...} record={record} /> 传入。
 *
 * 注:customFn / extra 这里故意用 any,方便调用方传"具体类型 DemoRecord => boolean"
 * 的自定义函数(HOC 的调用签名是逆变的,any 允许任何子类型通过类型检查)。
 * 实际执行时内部用 extra 做纯透传(不访问字段),不会出现类型错误落到运行时。
 */
export interface WithPermissionRuntimeProps {
  codes?: PermissionCode[]
  roles?: RoleKey[]
  customFn?: (userRoles: RoleKey[], extra?: any) => boolean
  fallback?: FallbackMode
  tooltipText?: ReactNode
  /** 传给 customFn 的业务数据(运行时传入,优先级最高) */
  extra?: any
}

/**
 * 无权限兜底渲染
 * - hide: 直接返回 null
 * - disable: 保持原有 UI 形态,用 Tooltip 包裹并根据 WrappedComponent 形态加禁用:
 *     · React Element (非 antd 组件) → 用 <span> 包裹并 pointer-events:none
 *     · 函数组件 → 给其传 disabled=true
 *     · 原生 HTMLButton/Input → 设 disabled 属性
 * 这样无论包装按钮、组件、自定义组件都能"禁用但保留形态"。
 */
function renderFallback<P extends object>(
  mode: FallbackMode,
  tooltipText: ReactNode,
  Wrapped: ComponentType<P> | ReactElement,
  props: P,
): ReactNode {
  if (mode === 'hide') return null

  const actualTooltip = tooltipText ?? '暂无操作权限'

  /*
   * 禁用 + 提示实现思路:
   * 外层统一包 Tooltip; 内层给一个不可交互的容器(同时保留原尺寸)。
   * isValidElement 分支直接覆盖 "传进来的 Wrapped 是 ReactElement" 的场景;
   * ComponentType 分支则 render 后再包。
   *
   * pointer-events:none + opacity:0.5 / 视觉上不可点击 + 提示权限不足,
   * 无论 Button/Card/自定义组件都通用,不依赖 antd 组件自己的 disabled prop
   * (避免 HOC 对被包装组件有侵入性约束)。
   */
  const content = React.isValidElement(Wrapped) ? (
    Wrapped
  ) : (
    <Wrapped {...(props as P)} />
  )

  return (
    <Tooltip title={actualTooltip} placement="top">
      {/*
       * span 作为不可交互层:
       *  - 不抢原生语义(按钮仍是按钮、tabindex 0 元素仍是可聚焦)但禁用鼠标
       *  - aria-disabled 给读屏软件提示"已禁用"
       *  - opacity 让视觉上和真正的 disabled 保持一致
       */}
      <span
        aria-disabled
        style={{
          display: 'inline-block',
          opacity: 0.5,
          cursor: 'not-allowed',
          pointerEvents: 'none',
        }}
      >
        {content}
      </span>
    </Tooltip>
  )
}

/**
 * withPermission —— HOC 形式给任意组件加权限
 *
 * 两种最佳实践用法:
 *
 * ① 静态配置(适合"权限固定"的组件,提前封装):
 *
 *   const ExportButton = withPermission({
 *     codes: ['record:export'],
 *     fallback: 'disable',
 *     tooltipText: '当前角色无法导出,请联系管理员',
 *   })(Button)
 *   // 直接用: <ExportButton type="primary">导出</ExportButton>
 *
 * ② 运行时配置(适合"权限随数据变化"的场景,把权限字段作为 props 传入):
 *
 *   const PermissionButton = withPermission()(Button)
 *   // 用时:
 *   <PermissionButton
 *     codes={['record:edit']}
 *     fallback="disable"
 *     extra={record}
 *     customFn={(roles, rec) => rec.owner === currentUser || roles.includes('admin')}
 *   >
 *     编辑
 *   </PermissionButton>
 *
 * 设计:
 *  - HOC 返回的组件名 = `WithPermission(${DisplayName})`(React DevTools 识别更友好)
 *  - 不修改被包装组件的 props 签名(纯 HOC,开闭原则)
 *  - 运行时 props(codes/roles/customFn/fallback/tooltipText/extra)优先级高于 HOC 配置,
 *    便于同组件在不同页面复用不同权限规则,无需重写 HOC
 */
export function withPermission(staticOptions: WithPermissionOptions = {}) {
  return function HOC<P extends object>(
    Wrapped: ComponentType<P> | ReactElement,
  ): ComponentType<P & WithPermissionRuntimeProps> {
    const displayName =
      React.isValidElement(Wrapped)
        ? 'WithPermission(Element)'
        : `WithPermission(${Wrapped.displayName || Wrapped.name || 'Component'})`

    const WithPermissionComponent = (runtimeProps: P & WithPermissionRuntimeProps) => {
      /*
       * 合并优先级: 运行时 props > HOC options 静态配置
       * (权限矩阵 + fallback + tooltip + customFn/extra 都是这个规则)
       */
      const codes = runtimeProps.codes ?? staticOptions.codes
      const roles = runtimeProps.roles ?? staticOptions.roles
      const customFn =
        (runtimeProps.customFn as PermissionCustomFn | undefined) ??
        (staticOptions.customFn as PermissionCustomFn | undefined)
      const fallback = runtimeProps.fallback ?? staticOptions.fallback ?? 'hide'
      const tooltipText = runtimeProps.tooltipText ?? staticOptions.tooltipText
      const extra =
        (runtimeProps.extra as unknown | undefined) ?? staticOptions.extra

      const { hasAuth } = usePermission({ codes, roles, customFn, extra })

      if (hasAuth) {
        if (React.isValidElement(Wrapped)) return Wrapped
        const WrappedComp = Wrapped as ComponentType<P>
        /*
         * 鉴权通过时,不要把 withPermission 自己的运行时 props(codes/roles/...)
         * 传给被包装的业务组件,避免业务组件收到未定义 props 出现警告。
         */
        const {
          codes: _c,
          roles: _r,
          customFn: _cf,
          fallback: _f,
          tooltipText: _t,
          extra: _e,
          ...compProps
        } = runtimeProps
        return <WrappedComp {...(compProps as P)} />
      }

      // 无权限:按 fallback 策略渲染
      if (React.isValidElement(Wrapped)) {
        return renderFallback(fallback, tooltipText, Wrapped, {})
      }
      const WrappedComp = Wrapped as ComponentType<P>
      const {
        codes: _c,
        roles: _r,
        customFn: _cf,
        fallback: _f,
        tooltipText: _t,
        extra: _e,
        ...compProps
      } = runtimeProps
      return renderFallback(fallback, tooltipText, WrappedComp, compProps as P)
    }

    WithPermissionComponent.displayName = displayName
    return WithPermissionComponent
  }
}

/*
 * ============================================================
 * 便捷版:针对 JSX 元素的直接权限包装。
 * HOC 本身已经支持 JSX Element,但这里再导出一个函数式用法,
 * 方便行内立即使用,不必写柯里化两步调用。
 * ============================================================
 */
export interface GuardProps<T = unknown> extends WithPermissionOptions<T> {
  children: ReactNode
}

/**
 * <PermissionGuard fallback="disable" codes={['record:delete']}>
 *   <Button danger>删除</Button>
 * </PermissionGuard>
 *
 * HOC 对应"封装组件",Guard 对应"单次使用"场景。两者底层共用同一套判断逻辑。
 * 这里作为"轻量便捷写法"额外导出,保持 API 家族一致。
 */
export function PermissionGuard<T = unknown>({
  children,
  codes,
  roles,
  customFn,
  extra,
  fallback = 'hide',
  tooltipText,
}: GuardProps<T>): ReactNode {
  const { hasAuth } = usePermission({ codes, roles, customFn, extra })
  if (hasAuth) return children
  if (isValidElement(children)) {
    return renderFallback(fallback, tooltipText, children, {})
  }
  // children 是普通文本/fragment 等 -> 直接 hide / 原样包 tooltip
  if (fallback === 'hide') return null
  return (
    <Tooltip title={tooltipText ?? '暂无操作权限'} placement="top">
      <span
        aria-disabled
        style={{ display: 'inline-block', opacity: 0.5, cursor: 'not-allowed', pointerEvents: 'none' }}
      >
        {children}
      </span>
    </Tooltip>
  )
}
