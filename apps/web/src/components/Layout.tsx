import { useState } from 'react'
import type { ReactNode } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Layout as AntdLayout, Menu, Button, Tooltip } from 'antd'
import type { MenuProps } from 'antd'
import {
  HomeOutlined,
  CodeOutlined,
  BarChartOutlined,
  TableOutlined,
  InfoCircleOutlined,
  SunOutlined,
  MoonOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons'
import { useTheme } from '@/contexts/ThemeContext'
import TabBar from '@/components/TabBar'
import Breadcrumb from '@/components/Breadcrumb'

const { Header, Sider, Content, Footer } = AntdLayout

/**
 * 左侧菜单配置
 *
 * 开闭原则:新增路由只需在此追加一项,
 * Menu 自动渲染、TabBar 自动匹配标签,无需修改组件逻辑。
 */
const MENU_ITEMS: MenuProps['items'] = [
  { key: '/', icon: <HomeOutlined />, label: '首页' },
  { key: '/demo', icon: <CodeOutlined />, label: '演示' },
  { key: '/charts', icon: <BarChartOutlined />, label: '图表' },
  { key: '/list', icon: <TableOutlined />, label: '列表' },
  { key: '/about', icon: <InfoCircleOutlined />, label: '关于' },
]

/**
 * 路由 → 菜单高亮 key 映射
 *
 * /form 不在菜单中,但从 /list 跳入,因此高亮 /list,
 * 给用户"仍然在列表相关功能中"的空间感。
 */
function getMenuSelectedKey(pathname: string): string[] {
  if (pathname.startsWith('/form')) return ['/list']
  return [pathname]
}

/**
 * Outlet 上下文类型 —— 供子页面与 Layout 通信
 *
 * setActions: 子页面通过此函数将操作按钮注册到面包屑栏右侧,
 * 页面卸载时清理(返回 null),避免残留。
 */
export type OutletContext = {
  setActions: (actions: ReactNode) => void
}

/**
 * 全局布局 —— 左(Sider 通栏) + 右(上 Header / 中 Content / 下 Footer)
 *
 * ┌──────┬───────────────────────────────────┐
 * │      │  Header(折叠+标题 + [Tab] + 主题)     │  上
 * │      ├───────────────────────────────────┤
 * │ Sider│  面包屑(左) + 页面操作按钮(右)        │
 * │ Menu ├───────────────────────────────────┤
 * │ 通栏 │  Content(Outlet)                    │  中
 * │      ├───────────────────────────────────┤
 * │      │  Footer                             │  下
 * └──────┴───────────────────────────────────┘
 *
 * React 哲学:组合 —— 各区域职责单一、可独立扩展。
 */
export default function Layout() {
  const { isDark, toggleTheme } = useTheme()
  const location = useLocation()
  const navigate = useNavigate()

  const [collapsed, setCollapsed] = useState(false)
  const [actions, setActions] = useState<ReactNode>(null)

  return (
    <AntdLayout className="app-layout" hasSider>
      {/* ---- 左:Sider 菜单(通栏全高) ---- */}
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        trigger={null}
        theme={isDark ? 'dark' : 'light'}
        width={200}
        className="app-sider"
      >
        <div className="app-sider__logo">
          {collapsed ? 'RT' : 'React 技术分享'}
        </div>
        <Menu
          mode="inline"
          theme={isDark ? 'dark' : 'light'}
          items={MENU_ITEMS}
          selectedKeys={getMenuSelectedKey(location.pathname)}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>

      {/* ---- 右:上 Header / 中 Content / 下 Footer ---- */}
      <AntdLayout className="app-main">
        {/* 上:Header(折叠 + 标题 + Tab + 主题) */}
        <Header className="app-header">
          <div className="app-header__left">
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed((c) => !c)}
            />
          </div>
          <div className="app-header__center">
            <TabBar />
          </div>
          <div className="app-header__right">
            <Tooltip title={isDark ? '切换到亮色主题' : '切换到暗色主题'}>
              <Button
                type="text"
                icon={isDark ? <SunOutlined /> : <MoonOutlined />}
                onClick={toggleTheme}
              />
            </Tooltip>
          </div>
        </Header>

        {/* 面包屑栏:左侧面包屑 + 右侧页面操作按钮 */}
        <div className="app-breadcrumb-bar">
          <Breadcrumb />
          <div className="app-breadcrumb__actions">{actions}</div>
        </div>

        {/* 中:Content(页面内容) */}
        <Content className="app-content">
          <div className="app-content__body">
            <Outlet context={{ setActions } satisfies OutletContext} />
          </div>
        </Content>

        {/* 下:Footer */}
        <Footer className="app-footer">
          React 19 + TypeScript + React Router 7 + Redux Toolkit + Ant Design 6
        </Footer>
      </AntdLayout>
    </AntdLayout>
  )
}
