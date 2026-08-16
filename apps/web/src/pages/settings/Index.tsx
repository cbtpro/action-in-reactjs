import { useMemo, useState, useCallback, useEffect } from 'react'
import { Card, Radio, Space, Typography, Divider, Button, Input, Select, Tag, ConfigProvider, message } from 'antd'
import {
  SunOutlined,
  MoonOutlined,
  CheckOutlined,
  RollbackOutlined,
  SaveOutlined,
  EyeOutlined,
} from '@ant-design/icons'
import { useSettings } from '@/contexts/SettingsContext'
import type { ThemeMode, ComponentSize, LocaleCode, Settings } from '@/contexts/SettingsContext'
import { theme as antdTheme } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import enUS from 'antd/locale/en_US'

const { Title, Text, Paragraph } = Typography

/* ---------- antd locale 映射表(本地一份,供预览层使用) ---------- */
const ANTD_LOCALES = {
  zhCN,
  enUS,
} as const

/**
 * 设置页面 —— 预览 + 确认后生效
 *
 * 设计思路(分离关注):
 * 1. 草稿态 draft: 页面内部 useState 维护,用户切换选项只改 draft,不写入 Context
 * 2. 预览层:用嵌套 ConfigProvider 把 draft 值注入 Card 子树,用户可实时预览效果
 * 3. 底部操作区: 确认 → applySettings 一次性写入 Context + localStorage
 *              取消 → draft 回滚为 Context 当前值
 *
 * React 哲学: 依赖驱动渲染
 * - ConfigProvider 可嵌套(内层 theme.algorithm / componentSize / locale 覆盖外层),
 *   天然适合"在局部子树预览不同配置"的场景。
 * - data-theme 加在预览容器上(选择器 [data-theme="dark"] 非 :root 限定),
 *   CSS 变量也能在子树独立生效,不影响 Layout/Sider 等预览区外的元素。
 */
export default function SettingsPage() {
  /*
   * 单一真源: Context 里的 theme/componentSize/locale 是"已生效设置"。
   * 从 context 解构真实值 + 批量应用接口 applySettings,
   * 不使用单项 setXxx,符合"先预览再批量应用"的 UX。
   */
  const { theme, componentSize, locale, applySettings } = useSettings()

  /*
   * 当前已生效设置的快照 —— 作为初始化值 + "取消"时的回滚依据。
   * 用 useMemo 从 context 组合,保证结构引用稳定,不触发不必要重渲染。
   */
  const appliedSettings: Settings = useMemo(
    () => ({ theme, componentSize, locale }),
    [theme, componentSize, locale],
  )

  /*
   * 草稿态(预览值) —— 初始从已生效值拷贝。
   * 之后用户点击 Radio 只改 draft,不写 Context。
   */
  const [draft, setDraft] = useState<Settings>(appliedSettings)

  /*
   * 当 context 值发生变化时(例如其他页面通过 toggleTheme 切换了主题),
   * 如果当前用户还没开始改 draft(草稿等于旧的 context 值),
   * 就同步更新草稿,避免"页面显示和实际设置不同步"。
   *
   * 判断依据: draft 与 appliedSettings 是否相同 —— 相同则代表用户没改过,直接同步;
   * 不同则代表草稿中有未确认的修改,保留草稿(不覆盖用户正在预览的选择)。
   *
   * (React 哲学:引用稳定性 —— appliedSettings 用 useMemo,依赖变才变,减少 effect 重跑)
   */
  useEffect(() => {
    setDraft((prev) => {
      const same = prev.theme === theme && prev.componentSize === componentSize && prev.locale === locale
      return same ? appliedSettings : prev
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedSettings])

  /*
   * 是否存在未确认的修改(草稿和已生效值不一致)
   * useMemo 派生,不额外开 state,避免状态冗余。
   */
  const hasChanges = useMemo(() => {
    return (
      draft.theme !== theme ||
      draft.componentSize !== componentSize ||
      draft.locale !== locale
    )
  }, [draft, theme, componentSize, locale])

  /* ---------- 交互:改草稿、确认、取消 ---------- */

  const setDraftTheme = useCallback((next: ThemeMode) => {
    setDraft((p) => ({ ...p, theme: next }))
  }, [])

  const setDraftSize = useCallback((next: ComponentSize) => {
    setDraft((p) => ({ ...p, componentSize: next }))
  }, [])

  const setDraftLocale = useCallback((next: LocaleCode) => {
    setDraft((p) => ({ ...p, locale: next }))
  }, [])

  const handleConfirm = useCallback(() => {
    // 只应用有差异的字段,减少不必要的 setState + localStorage 写入
    const patch: Partial<Settings> = {}
    if (draft.theme !== theme) patch.theme = draft.theme
    if (draft.componentSize !== componentSize) patch.componentSize = draft.componentSize
    if (draft.locale !== locale) patch.locale = draft.locale
    if (Object.keys(patch).length === 0) {
      message.info('没有需要保存的改动')
      return
    }
    applySettings(patch)
    message.success('设置已保存并生效')
  }, [draft, theme, componentSize, locale, applySettings])

  const handleCancel = useCallback(() => {
    // 直接回滚为当前已生效值
    setDraft(appliedSettings)
  }, [appliedSettings])

  /*
   * 预览层 ConfigProvider 的 prop 值:
   * theme.algorithm / componentSize / locale 全部来自 draft,
   * 让预览区内的 antd 组件(Button/Input/Select/Divider 等)按草稿渲染。
   */
  const previewThemeAlgorithm =
    draft.theme === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm

  /* ---------- 渲染层 ---------- */

  return (
    <section className="page">
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          columnGap: 12,
          rowGap: 8,
          flexWrap: 'wrap',
          marginBottom: 16,
        }}
      >
        <Title level={2} style={{ marginBottom: 0 }}>设置</Title>
        <Tag color={hasChanges ? 'orange' : 'geekblue'} icon={hasChanges ? <EyeOutlined /> : <CheckOutlined />}>
          {hasChanges ? '预览中,未保存' : '与已生效一致'}
        </Tag>
      </div>
      <Paragraph type="secondary" style={{ marginBottom: 24 }}>
        切换选项后将在下方预览区显示效果,点击「确认」按钮保存并全局生效,点击「取消」还原为当前已生效设置。
      </Paragraph>

      {/*
       * 预览层:嵌套 ConfigProvider + data-theme
       * - 内层 ConfigProvider:覆盖 antd 组件主题/尺寸/语言(组件级别预览)
       * - data-theme={draft.theme}:让子树的 CSS 变量也切换(颜色/边框等页面级别预览)
       * 两者配合,预览区内"antd 组件 + 普通 DOM"都呈现草稿效果,预览外保持原状态。
       */}
      <ConfigProvider
        theme={{ algorithm: previewThemeAlgorithm }}
        componentSize={draft.componentSize}
        locale={ANTD_LOCALES[draft.locale]}
      >
        <div data-theme={draft.theme}>
          <Card style={{ width: '100%' }}>
            {/* ---------- 主题 ---------- */}
            <Divider>主题</Divider>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
              <Radio.Group
                value={draft.theme}
                onChange={(e) => setDraftTheme(e.target.value as ThemeMode)}
                optionType="button"
                buttonStyle="solid"
              >
                <Radio.Button value="light">
                  <Space>
                    <SunOutlined /> 亮色
                  </Space>
                </Radio.Button>
                <Radio.Button value="dark">
                  <Space>
                    <MoonOutlined /> 暗色
                  </Space>
                </Radio.Button>
              </Radio.Group>
              <Text type="secondary">
                预览区域按草稿渲染;确认后 antd darkAlgorithm/defaultAlgorithm 与 CSS 变量联动全局切换。
              </Text>
            </div>

            {/* ---------- 组件尺寸 ---------- */}
            <Divider>组件尺寸</Divider>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
              <Radio.Group
                value={draft.componentSize}
                onChange={(e) => setDraftSize(e.target.value as ComponentSize)}
                optionType="button"
                buttonStyle="solid"
              >
                <Radio.Button value="small">小</Radio.Button>
                <Radio.Button value="middle">默认</Radio.Button>
                <Radio.Button value="large">大</Radio.Button>
              </Radio.Group>
              {/*
               * 实时预览:这些组件在预览 ConfigProvider 子树内,
               * 因此 Button/Input/Select 的高度、字号、padding 立刻随草稿尺寸变化。
               */}
              <Space size="middle" wrap>
                <Button type="primary" size={draft.componentSize}>按钮预览</Button>
                <Input size={draft.componentSize} placeholder="输入框预览" style={{ width: 200 }} />
                <Select
                  size={draft.componentSize}
                  defaultValue="a"
                  style={{ width: 140 }}
                  options={[
                    { label: '选项 A', value: 'a' },
                    { label: '选项 B', value: 'b' },
                  ]}
                />
              </Space>
            </div>
            <Text type="secondary" style={{ display: 'block', marginTop: 12 }}>
              确认后通过 ConfigProvider.componentSize 全局注入,影响全站 antd 组件的 padding / font-size / height。
            </Text>

            {/* ---------- 语言 ---------- */}
            <Divider>语言</Divider>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
              <Radio.Group
                value={draft.locale}
                onChange={(e) => setDraftLocale(e.target.value as LocaleCode)}
                optionType="button"
                buttonStyle="solid"
              >
                <Radio.Button value="zhCN">中文</Radio.Button>
                <Radio.Button value="enUS">English</Radio.Button>
              </Radio.Group>
              <Text type="secondary">
                确认后 antd 内置文案(分页、表格空态、日期选择器等)自动跟随,整个应用生效。
              </Text>
            </div>

            {/*
             * ---------- 操作按钮区 ----------
             * 确认:仅在有改动时点亮 type=primary,无改动时 disabled,避免无意义点击
             * 取消:把草稿回滚到已生效快照
             */}
            <Divider />
            <Space size="middle" style={{ justifyContent: 'flex-end', width: '100%' }}>
              <Button
                icon={<RollbackOutlined />}
                onClick={handleCancel}
                disabled={!hasChanges}
              >
                取消
              </Button>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={handleConfirm}
                disabled={!hasChanges}
              >
                确认并生效
              </Button>
            </Space>
          </Card>
        </div>
      </ConfigProvider>

      {/* 底部对比摘要:上方 Tags 显示"当前草稿"和"已生效",便于用户比较差异 */}
      <Card size="small" style={{ width: '100%', marginTop: 16 }}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', rowGap: 8, columnGap: 24, alignItems: 'center' }}>
            <Text strong style={{ minWidth: 96 }}>
              <EyeOutlined style={{ marginRight: 4 }} />
              预览草稿
            </Text>
            <Tag icon={<CheckOutlined />} color={draft.theme === theme ? 'green' : 'orange'}>
              主题: {draft.theme === 'dark' ? '暗色' : '亮色'}
            </Tag>
            <Tag icon={<CheckOutlined />} color={draft.componentSize === componentSize ? 'blue' : 'orange'}>
              尺寸: {draft.componentSize}
            </Tag>
            <Tag icon={<CheckOutlined />} color={draft.locale === locale ? 'purple' : 'orange'}>
              语言: {draft.locale === 'zhCN' ? '中文' : 'English'}
            </Tag>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', rowGap: 8, columnGap: 24, alignItems: 'center' }}>
            <Text strong style={{ minWidth: 96 }}>
              <SaveOutlined style={{ marginRight: 4 }} />
              已生效
            </Text>
            <Tag color="green">主题: {theme === 'dark' ? '暗色' : '亮色'}</Tag>
            <Tag color="blue">尺寸: {componentSize}</Tag>
            <Tag color="purple">语言: {locale === 'zhCN' ? '中文' : 'English'}</Tag>
          </div>
        </Space>
      </Card>
    </section>
  )
}
