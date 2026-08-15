import React from 'react'
import { App as AntdApp } from 'antd'
import { initialize, mswLoader } from 'msw-storybook-addon'
import type { Preview } from '@storybook/react'
import { handlers } from '@workspace/ui'

/**
 * MSW 初始化
 *
 * 将 @workspace/ui 中定义的导师 API mock handlers 注册到 Storybook:
 * - 全局 handlers 在所有 stories 中生效
 * - 单个 story 可通过 parameters.msw 追加/覆盖 handler
 */
initialize({}, handlers)

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
  loaders: [mswLoader],
  /*
   * antd 6 的 App 组件为 message / modal / notification 注入上下文,
   * 两个导师组件内部都使用了 App.useApp(),必须包裹在此处。
   */
  decorators: [
    (Story) => (
      <AntdApp>
        <Story />
      </AntdApp>
    ),
  ],
}

export default preview
