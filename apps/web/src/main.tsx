import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from '@/app/App'
import './index.css'

/**
 * React 哲学:副作用隔离与资源生命周期
 *
 * 应用入口阶段完成一次性初始化:
 * - 仅在开发环境启动 MSW Mock Service Worker
 * - worker 启动完成后再挂载 React 根组件,保证首屏请求都能被拦截
 * - 生产构建不包含 mocks 模块,tree-shaking 可消除
 */
async function bootstrap() {
  if (import.meta.env.DEV) {
    try {
      const { worker } = await import('./mocks/browser')
      await worker.start({
        /*
         * onUnhandledRequest: 未在 handlers 中注册的请求策略
         * 设为 'bypass' 直接放行,避免控制台对静态资源/第三方请求告警
         */
        onUnhandledRequest: 'bypass',
        /* 控制 MSW 自身的启动日志,演示时建议开启 */
        quiet: false,
      })
    } catch (err) {
      console.warn('[MSW] worker 启动失败,Mock 服务未启用:', err)
    }
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void bootstrap()
