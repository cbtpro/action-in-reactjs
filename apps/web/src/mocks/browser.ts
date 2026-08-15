import { setupWorker } from 'msw/browser'
import { handlers } from '@workspace/ui'

/**
 * MSW Browser Worker
 *
 * 仅在开发环境启用:
 * - 通过 Service Worker 拦截浏览器真实 fetch/XHR 请求
 * - Network 面板可以看到完整的请求/响应过程,非常适合技术分享
 * - 生产构建不包含此模块,无任何性能开销
 */
export const worker = setupWorker(...handlers)
