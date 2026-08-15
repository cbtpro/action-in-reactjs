/**
 * 表单数据契约
 *
 * React 哲学:类型驱动设计
 *
 * 把表单数据结构从页面组件中抽离为独立类型,
 * 一处定义、多处复用(页面、校验、提交处理),
 * 字段增删时编译器会在所有引用处提示,避免遗漏。
 */
export interface FormData {
  username: string
  password: string
  email: string
  phone?: string
  gender: 'male' | 'female' | 'other'
  birthday?: string
  role: string
  agree: boolean
  bio?: string
  contacts?: { label: string; value: string }[]
  company?: string
  jobTitle?: string
  /** 所选导师主键 id —— 由 MentorSelectField 复用组件写入 */
  mentorId?: string
}
