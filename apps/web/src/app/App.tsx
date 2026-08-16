import { Provider } from 'react-redux'
import { RouterProvider } from 'react-router-dom'
import { App as AntdApp } from 'antd'
import { store } from '@/app/store'
import { router } from '@/app/router'
import { SettingsProvider } from '@/contexts/SettingsContext'

/**
 * 应用根组件
 * 负责组合 Redux Provider → SettingsProvider → AntdApp → RouterProvider
 *
 * 层级顺序:
 * 1. Redux Provider:全局状态
 * 2. SettingsProvider:主题 / 组件尺寸 / 语言 ConfigProvider 注入(antd + CSS 变量联动)
 * 3. AntdApp:静态方法(message / modal / notification)上下文注入
 * 4. RouterProvider:路由树(Layout 及子页面)
 */
export default function App() {
  return (
    <Provider store={store}>
      <SettingsProvider>
        <AntdApp>
          <RouterProvider router={router} />
        </AntdApp>
      </SettingsProvider>
    </Provider>
  )
}
