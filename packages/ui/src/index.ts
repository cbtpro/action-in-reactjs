/**
 * @workspace/ui — 共享 UI 组件包
 *
 * 导师选择相关的可复用组件与数据服务,
 * 被 apps/web (主应用) 和 packages/storybook 共同消费。
 */

// 组件
export { default as MentorSelectModal } from './MentorSelectModal'
export type { MentorSelectModalProps } from './MentorSelectModal'
export { default as MentorSelectField } from './MentorSelectField'
export type { MentorSelectFieldProps } from './MentorSelectField'
export { default as MentorSelectField2 } from './MentorSelectField2'
export type { MentorSelectField2Props } from './MentorSelectField2'

// 数据服务
export { searchMentors, getMentorDetail } from './services/mentor'
export type { MentorUser, MentorSearchResult, SearchParams } from './services/mentor'

// Mock 处理器(MSW)
export { handlers } from './mocks/handlers'
