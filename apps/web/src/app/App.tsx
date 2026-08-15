import { Provider } from 'react-redux'
import { RouterProvider } from 'react-router-dom'
import { App as AntdApp } from 'antd'
import { store } from '@/app/store'
import { router } from '@/app/router'

/**
 * 应用根组件
 * 负责组合 Redux Provider 与 Router Provider
 *
 * AntdApp 包裹整个应用,为静态方法(message / modal / notification)
 * 注入上下文与主题,避免 antd 6 中直接调用静态 API 的告警。
 */
export default function App() {
  return (
    <Provider store={store}>
      <AntdApp>
        <RouterProvider router={router} />
      </AntdApp>
    </Provider>
  )
}
