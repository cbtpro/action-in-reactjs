import { NavLink, Outlet } from 'react-router-dom'

/**
 * 全局布局
 * 顶部导航固定,内容区通过 Outlet 渲染子路由
 */
export default function Layout() {
  return (
    <div className="layout">
      <header className="layout__header">
        <nav className="nav">
          <NavLink to="/" end className="nav__link">
            首页
          </NavLink>
          <NavLink to="/demo" className="nav__link">
            演示
          </NavLink>
          <NavLink to="/charts" className="nav__link">
            图表
          </NavLink>
          <NavLink to="/about" className="nav__link">
            关于
          </NavLink>
        </nav>
      </header>

      <main className="layout__main">
        <Outlet />
      </main>
    </div>
  )
}
