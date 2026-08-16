import { createBrowserRouter } from 'react-router-dom'
import Layout from '@/components/Layout'
import HomePage from '@/pages/HomePage'
import AboutPage from '@/pages/AboutPage'
import ChartsPage from '@/pages/ChartsPage'
import FormPage from '@/pages/form'
import ListPage from '@/pages/list/Index'
import SettingsPage from '@/pages/settings/Index'
import NotFoundPage from '@/pages/NotFoundPage'
import DemoPage from '@/pages/demo/Index'
import PermissionDemoPage from '@/pages/demo/PermissionDemo'

/**
 * 面包屑单个项 —— 支持标题和可选的跳转路径
 *
 * path 不为空时该项可点击,点击后导航到对应路由。
 */
export interface BreadcrumbItem {
  title: string
  /** 点击该项时跳转的路由路径(为空则不可点击) */
  path?: string
}

/**
 * 路由 handle 中的 breadcrumb 字段类型
 *
 * - 字符串:静态面包屑标题(如 '列表')
 * - 函数:从 query 参数动态生成,可返回单个标题或多级面包屑
 *
 * 返回值为 string 时生成单级面包屑;
 * 返回值为 BreadcrumbItem[] 时生成多级面包屑(如 首页 / 列表 / 表单REC1000)。
 *
 * 开闭原则:新增路由只需在此追加 handle.breadcrumb,
 * Breadcrumb 组件自动识别并渲染,无需修改组件逻辑。
 */
type BreadcrumbFn = (params: URLSearchParams) => string | BreadcrumbItem[]

export type RouteHandle = {
  breadcrumb?: string | BreadcrumbFn
}

/**
 * 路由配置
 *
 * handle.breadcrumb 作为路由的 meta 信息,
 * 供 Breadcrumb 组件从路由层级和 query 参数灵活生成面包屑。
 */
export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    handle: { breadcrumb: '首页' } satisfies RouteHandle,
    children: [
      { index: true, element: <HomePage /> },
      {
        path: 'demo',
        handle: { breadcrumb: '演示' } satisfies RouteHandle,
        children: [
          { index: true, element: <DemoPage /> },
          {
            path: 'permission',
            element: <PermissionDemoPage />,
            handle: { breadcrumb: '权限演示' } satisfies RouteHandle,
          },
        ],
      },
      {
        path: 'charts',
        element: <ChartsPage />,
        handle: { breadcrumb: '图表' } satisfies RouteHandle,
      },
      {
        path: 'list',
        element: <ListPage />,
        handle: { breadcrumb: '列表' } satisfies RouteHandle,
      },
      {
        path: 'form',
        element: <FormPage />,
        handle: {
          /*
           * 详情页面包屑:首页 / 列表 / 表单(编号)
           *
           * 列表项可点击跳回列表页,末级为当前页(不可点击)。
           */
          breadcrumb: (params: URLSearchParams) => {
            const id = params.get('id')
            return [
              { title: '列表', path: '/list' },
              { title: id ? `表单 ${id}` : '新建表单' },
            ]
          },
        } satisfies RouteHandle,
      },
      {
        path: 'about',
        element: <AboutPage />,
        handle: { breadcrumb: '关于' } satisfies RouteHandle,
      },
      {
        path: 'settings',
        element: <SettingsPage />,
        handle: { breadcrumb: '设置' } satisfies RouteHandle,
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
