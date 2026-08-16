import { Breadcrumb as AntdBreadcrumb } from 'antd'
import type { BreadcrumbProps } from 'antd'
import { useMatches, useLocation, useNavigate } from 'react-router-dom'
import type { RouteHandle, BreadcrumbItem } from '@/app/router'

/**
 * Breadcrumb —— 路由驱动的面包屑导航
 *
 * React 哲学:依赖驱动渲染 + 类型驱动设计
 *
 * 数据来源:
 *   1. 路由 handle.breadcrumb(meta 信息) —— 静态字符串或动态函数
 *   2. URL query 参数 —— 传递给 breadcrumb 函数,生成动态标题
 *
 * useMatches 返回从根到叶的所有匹配路由,
 * 每个路由的 handle.breadcrumb 组成面包屑层级。
 *
 * 支持:
 *   - breadcrumb 返回 string → 单级面包屑
 *   - breadcrumb 返回 BreadcrumbItem[] → 多级面包屑(如 首页 / 列表 / 表单REC1000)
 *   - BreadcrumbItem.path 不为空时该项可点击跳转
 *
 * 开闭原则:新增路由只需在 router.tsx 的 handle 中配置 breadcrumb,
 * 此组件无需任何改动。
 */
export default function Breadcrumb() {
  const matches = useMatches()
  const location = useLocation()
  const navigate = useNavigate()
  const params = new URLSearchParams(location.search)

  /*
   * 遍历匹配的路由,提取 handle.breadcrumb 并归一化为数组。
   *
   * - 字符串 → [{ title: '字符串' }]
   * - 函数返回 string → [{ title: '字符串' }]
   * - 函数返回 BreadcrumbItem[] → 直接展开
   *
   * flatMap 将所有路由的面包屑项合并为一维数组。
   */
  const items: BreadcrumbProps['items'] = matches
    .filter((m) => {
      const handle = m.handle as RouteHandle | undefined
      return !!handle?.breadcrumb
    })
    .flatMap((m) => {
      const handle = m.handle as RouteHandle
      const { breadcrumb } = handle

      const result =
        typeof breadcrumb === 'function' ? breadcrumb(params) : breadcrumb!

      // 归一化:string → 单元素数组,BreadcrumbItem[] → 原样返回
      const items: BreadcrumbItem[] =
        typeof result === 'string'
          ? [{ title: result }]
          : (result as BreadcrumbItem[])

      // 将 BreadcrumbItem 转为 antd Breadcrumb 的 items 格式
      return items.map((item) => {
        // 有 path 的项可点击,点击后导航到对应路由
        if (item.path) {
          return {
            title: item.title,
            onClick: () => navigate(item.path!),
          }
        }
        return { title: item.title }
      })
    })

  if (items.length === 0) return null

  return <AntdBreadcrumb items={items} className="app-breadcrumb" />
}
