import { useEffect, useState } from 'react'
import { Tabs } from 'antd'
import { useLocation, useNavigate } from 'react-router-dom'

/**
 * 路由 Tab 数据结构
 *
 * key 使用 pathname + search 作为唯一标识,
 * 同一路由不同参数(如 /form?id=REC1000 vs /form?id=REC1001)视为不同 Tab。
 */
interface RouteTab {
  key: string
  label: string
  closable: boolean
}

/**
 * 首页 Tab —— 永远存在、不可关闭
 *
 * React 哲学:单一真源 —— 首页 Tab 是常量,不参与 state 变更,
 * 避免被意外移除后用户无法回到首页。
 */
const HOME_TAB: RouteTab = {
  key: '/',
  label: '首页',
  closable: false,
}

/**
 * 路由 → Tab 标签 映射
 *
 * 开闭原则:新增路由时只需在此追加一行,
 * TabBar 自动识别并显示对应标签,无需修改组件逻辑。
 */
const ROUTE_LABEL_MAP: Record<string, string> = {
  '/': '首页',
  '/demo': '演示',
  '/charts': '图表',
  '/list': '列表',
  '/about': '关于',
}

/**
 * 根据当前路径和查询参数生成 Tab 标签
 *
 * 特殊路由(如 /form 带 ?id=)动态生成更具语义的标签:
 * - /form → "新建表单"
 * - /form?id=REC1000 → "表单 REC1000"
 */
function getTabLabel(pathname: string, search: string): string {
  if (ROUTE_LABEL_MAP[pathname]) return ROUTE_LABEL_MAP[pathname]

  if (pathname === '/form') {
    const id = new URLSearchParams(search).get('id')
    return id ? `表单 ${id}` : '新建表单'
  }

  return '未找到'
}

/**
 * TabBar —— 路由驱动的可关闭标签栏
 *
 * React 哲学:副作用隔离与声明式渲染
 *
 * - 监听 useLocation 变化,自动为新路由创建 Tab
 * - 点击 Tab → navigate 对应路由
 * - 关闭 Tab → 从列表移除,若关闭的是当前 Tab 则跳转相邻 Tab
 * - 首页 Tab 永远不可关闭(closable: false)
 *
 * 职责单一:只管 Tab 的增删与切换,不关心页面内容渲染(由 Outlet 负责)。
 */
export default function TabBar() {
  const location = useLocation()
  const navigate = useNavigate()

  /*
   * Tab key = pathname + search,确保同路由不同参数各占一个 Tab。
   * 首页的 key 固定为 '/',与 location.pathname='/' + location.search='' 拼接一致。
   */
  const currentKey = location.pathname + location.search

  const [tabs, setTabs] = useState<RouteTab[]>([HOME_TAB])

  /*
   * 依赖驱动渲染:URL 变化 → 检查是否需要新增 Tab。
   * 已存在的 Tab 不重复添加(幂等)。
   */
  useEffect(() => {
    if (currentKey === '/') return
    setTabs((prev) => {
      if (prev.some((t) => t.key === currentKey)) return prev
      return [
        ...prev,
        {
          key: currentKey,
          label: getTabLabel(location.pathname, location.search),
          closable: true,
        },
      ]
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentKey])

  /** 点击 Tab → 导航到对应路由 */
  const handleChange = (key: string) => {
    navigate(key)
  }

  /**
   * 关闭 Tab → 从列表移除
   * 若关闭的是当前激活的 Tab,自动跳转到前一个 Tab(或首页)。
   */
  const handleEdit = (
    targetKey: string | React.MouseEvent | React.KeyboardEvent,
    action: 'add' | 'remove',
  ) => {
    if (action !== 'remove') return
    if (typeof targetKey !== 'string') return

    const index = tabs.findIndex((t) => t.key === targetKey)
    if (index === -1) return

    const nextTabs = tabs.filter((t) => t.key !== targetKey)
    setTabs(nextTabs)

    /*
     * 关闭的恰是当前 Tab 时,导航到相邻 Tab:
     * 取被关闭 Tab 前一个的位置(至少是首页 index=0)。
     */
    if (targetKey === currentKey) {
      const fallback = nextTabs[Math.max(0, index - 1)]
      navigate(fallback.key)
    }
  }

  return (
    <Tabs
      type="editable-card"
      items={tabs}
      activeKey={currentKey}
      onChange={handleChange}
      onEdit={handleEdit}
      hideAdd
      size="small"
      className="app-tabs"
    />
  )
}
