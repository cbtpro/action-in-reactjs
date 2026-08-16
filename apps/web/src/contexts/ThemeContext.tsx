import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { ConfigProvider, theme as antdTheme } from 'antd'

/**
 * 主题上下文 —— 跨层级共享 isDark / toggleTheme
 *
 * React 哲学:组合 / 容器与展示组件分层
 *
 * 主题状态提升到应用顶层(ConfigProvider 消费 isDark),
 * 但切换按钮散落在 Layout Header 中,通过 Context 跨层级传递,
 * 避免在 RouterProvider 与 Layout 之间手动透传 props。
 */

interface ThemeContextValue {
  isDark: boolean
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue>({
  isDark: false,
  toggleTheme: () => {},
})

/**
 * useTheme —— 在任意子组件中获取主题状态与切换函数
 */
export function useTheme() {
  return useContext(ThemeContext)
}

/**
 * ThemeProvider —— 主题状态唯一管理者
 *
 * 职责单一:仅负责 isDark 的初始化、持久化与 DOM 标记,
 * 不关心谁消费它(开闭原则:新增消费方无需修改本组件)。
 *
 * - 初始化:优先读取 localStorage,其次跟随系统偏好
 * - 持久化:每次切换写入 localStorage,刷新后保持
 * - DOM 根:<html data-theme="dark|light"> 驱动 CSS 变量切换
 * - ConfigProvider:antd 组件主题算法联动(darkAlgorithm / defaultAlgorithm)
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState<boolean>(() => {
    const saved = localStorage.getItem('theme')
    if (saved) return saved === 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light')
    localStorage.setItem('theme', isDark ? 'dark' : 'light')
  }, [isDark])

  const toggleTheme = () => setIsDark((prev) => !prev)

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      <ConfigProvider
        theme={{ algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm }}
      >
        {children}
      </ConfigProvider>
    </ThemeContext.Provider>
  )
}
