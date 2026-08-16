import { useState } from 'react'
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
 * 全局布局 —— 上左中下四区结构
 *
 * ┌──────────────────────────────────────────┐
 * │ Header(折叠按钮 + 标题      + 主题切换)     │  上
 * ├──────┬───────────────────────────────────┤
 * │      │  TabBar + Outlet                  │
 * │ Sider│  (Content)                        │  左 中
 * │ Menu │                                   │
 * ├──────┴───────────────────────────────────┤
 * │ Footer                                    │  下
 * └──────────────────────────────────────────┘
 *
 * React 哲学:组合 —— 各区域职责单一、可独立扩展。
 */
export default function Layout() {
  const { isDark, toggleTheme } = useTheme()
  const location = useLocation()
  const navigate = useNavigate()

  const [collapsed, setCollapsed] = useState(false)

  return (
    <AntdLayout className="app-layout">
      {/* ---- 上:Header ---- */}
      <Header className="app-header">
        <div className="app-header__left">
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed((c) => !c)}
          />
          <span className="app-header__title">React 技术分享</span>
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

      {/* ---- 左 + 中 ---- */}
      <AntdLayout>
        {/* 左:Sider 菜单 */}
        <Sider
          collapsible
          collapsed={collapsed}
          onCollapse={setCollapsed}
          theme={isDark ? 'dark' : 'light'}
          width={200}
        >
          <Menu
            mode="inline"
            theme={isDark ? 'dark' : 'light'}
            items={MENU_ITEMS}
            selectedKeys={getMenuSelectedKey(location.pathname)}
            onClick={({ key }) => navigate(key)}
          />
        </Sider>

        {/* 中:Content(TabBar + 页面内容) */}
        <Content className="app-content">
          <TabBar />
          <div className="app-content__body">
            <Outlet />
          </div>
        </Content>
      </AntdLayout>

      {/* ---- 下:Footer ---- */}
      <Footer className="app-footer">
        React 19 + TypeScript + React Router 7 + Redux Toolkit + Ant Design 6
      </Footer>
    </AntdLayout>
  )
}
