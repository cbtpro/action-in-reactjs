import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import { ConfigProvider, theme as antdTheme } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import enUS from 'antd/locale/en_US'

/**
 * 全局设置上下文 —— 主题、组件尺寸、语言(单一职责:仅管理用户偏好)
 *
 * React 哲学:组合 / 容器与展示组件分层
 *
 * 三项设置均提升到应用顶层,通过 ConfigProvider 一次性注入 antd,
 * 消费方(Layout / 设置页 / 任意子组件)通过 useSettings 跨层级读取,
 * 不需要逐层透传 props。
 *
 * 开闭原则:新增设置项只需扩展 Settings 接口 + Provider 内部 state,
 * 消费方按需读取,互不影响。
 */

/* ---------- 类型定义(类型驱动设计) ---------- */

export type ThemeMode = 'light' | 'dark'
export type ComponentSize = 'small' | 'middle' | 'large'
export type LocaleCode = 'zhCN' | 'enUS'

export interface Settings {
  theme: ThemeMode
  componentSize: ComponentSize
  locale: LocaleCode
}

interface SettingsContextValue extends Settings {
  /** 直接设置主题 */
  setTheme: (theme: ThemeMode) => void
  /** 设置组件尺寸 */
  setComponentSize: (size: ComponentSize) => void
  /** 设置语言 */
  setLocale: (locale: LocaleCode) => void
  /** 一次性应用全部设置(主题/尺寸/语言),适合预览后确认提交场景 */
  applySettings: (next: Partial<Settings>) => void
  /** 快捷切换明暗主题 */
  toggleTheme: () => void
}

/* ---------- antd locale 映射表 ---------- */

const ANTD_LOCALES = {
  zhCN,
  enUS,
} as const

/* ---------- Context 创建 ---------- */

const SettingsContext = createContext<SettingsContextValue>({
  theme: 'light',
  componentSize: 'middle',
  locale: 'zhCN',
  setTheme: () => {},
  setComponentSize: () => {},
  setLocale: () => {},
  applySettings: () => {},
  toggleTheme: () => {},
})

/**
 * useSettings —— 在任意子组件中获取全局设置与更新函数
 */
export function useSettings() {
  return useContext(SettingsContext)
}

/* ---------- Provider 实现 ---------- */

/**
 * SettingsProvider —— 全局设置唯一管理者
 *
 * 职责单一:仅负责三项设置的初始化、持久化与 antd ConfigProvider 注入,
 * 不关心谁消费它(开闭原则:新增消费方无需修改本组件)。
 *
 * - 初始化:优先读取 localStorage,其次跟随系统偏好(仅主题)
 * - 持久化:每次变更写入 localStorage,刷新后保持
 * - DOM 根:<html data-theme="dark|light"> 驱动 CSS 变量切换
 * - ConfigProvider:antd 组件主题算法 / 尺寸 / 语言一次性注入
 */
export function SettingsProvider({ children }: { children: ReactNode }) {
  /*
   * 主题初始化:localStorage > 系统偏好 > 默认亮色
   * 复用旧 key 'theme',保持向后兼容(刷新不丢失已选主题)
   */
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('theme')
    if (saved === 'light' || saved === 'dark') return saved
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  /*
   * 组件尺寸初始化:localStorage > 默认 'middle'
   */
  const [componentSize, setComponentSize] = useState<ComponentSize>(
    () => (localStorage.getItem('componentSize') as ComponentSize) || 'middle',
  )

  /*
   * 语言初始化:localStorage > 默认 'zhCN'
   */
  const [locale, setLocale] = useState<LocaleCode>(
    () => (localStorage.getItem('locale') as LocaleCode) || 'zhCN',
  )

  /*
   * React 哲学:副作用隔离
   *
   * 每项设置独立 useEffect,确保"仅当该项变化时才触发副作用":
   * - theme → DOM data-theme 属性 + localStorage
   * - componentSize / locale → 仅 localStorage
   */
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  useEffect(() => {
    localStorage.setItem('componentSize', componentSize)
  }, [componentSize])

  useEffect(() => {
    localStorage.setItem('locale', locale)
  }, [locale])

  /*
   * applySettings 用 useCallback 保持引用稳定。
   * 支持传入 Partial<Settings>,逐项非空判断后再 setState,
   * 避免未修改字段的丢失触发(每次 setXxx 有独立 effect 写 localStorage,
   * 这里"只更新被指定的项"也符合只在变更时写 storage 的原则)。
   */
  const applySettings = useCallback((next: Partial<Settings>) => {
    if (next.theme != null) setTheme(next.theme)
    if (next.componentSize != null) setComponentSize(next.componentSize)
    if (next.locale != null) setLocale(next.locale)
  }, [])

  /*
   * toggleTheme 用 useCallback 保持引用稳定,
   * 避免传递给子组件时触发不必要的重渲染。
   */
  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }, [])

  const isDark = theme === 'dark'

  return (
    <SettingsContext.Provider
      value={{
        theme,
        componentSize,
        locale,
        setTheme,
        setComponentSize,
        setLocale,
        applySettings,
        toggleTheme,
      }}
    >
      <ConfigProvider
        theme={{ algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm }}
        componentSize={componentSize}
        locale={ANTD_LOCALES[locale]}
      >
        {children}
      </ConfigProvider>
    </SettingsContext.Provider>
  )
}
