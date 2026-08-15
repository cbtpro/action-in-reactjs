/**
 * 导师(用户)数据契约
 *
 * 主键为 id,详情接口返回更完整字段。
 */
export interface MentorUser {
  /** 主键 */
  id: string
  /** 姓名 */
  name: string
  /** 工号 */
  employeeNo: string
  /** 部门 */
  department: string
  /** 职称 */
  title: string
  /** 手机号 */
  phone: string
  /** 邮箱 */
  email: string
}

/** 搜索结果分页响应 */
export interface MentorSearchResult {
  list: MentorUser[]
  total: number
  page: number
  pageSize: number
}

export interface SearchParams {
  name?: string
  department?: string
  page?: number
  pageSize?: number
}

/**
 * 搜索导师(支持姓名/部门 + 分页)
 *
 * 真实 fetch 调用,开发环境由 MSW 拦截返回模拟数据,
 * 生产环境指向真实后端 API —— 业务代码无需区分。
 *
 * DevTools Network 面板可以观察到完整请求过程,
 * 适合技术分享演示"前后端分离 + Mock 服务"的工作流。
 */
export async function searchMentors(params: SearchParams = {}): Promise<MentorSearchResult> {
  const query = new URLSearchParams({
    page: params.page?.toString() || '1',
    pageSize: params.pageSize?.toString() || '10',
    ...(params.name && { name: params.name }),
    ...(params.department && { department: params.department }),
  })
  const res = await fetch(`/api/mentors?${query.toString()}`)
  if (!res.ok) {
    throw new Error(`搜索导师失败: ${res.status}`)
  }
  return res.json()
}

/**
 * 根据主键查询导师详情
 *
 * 选择导师时,用弹窗选中的主键再查询一次完整详情,
 * 确保回填到表单展示区的数据是最新、最完整的。
 */
export async function getMentorDetail(id: string): Promise<MentorUser | null> {
  const res = await fetch(`/api/mentors/${encodeURIComponent(id)}`)
  if (res.status === 404) return null
  if (!res.ok) {
    throw new Error(`查询导师详情失败: ${res.status}`)
  }
  return res.json()
}
