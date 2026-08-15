import { http, HttpResponse } from 'msw'
import type { MentorUser } from '../services/mentor'

/**
 * 导师(用户)数据契约
 *
 * 类型从 services/mentor.ts 导入,保证 mock 与真实服务层类型一致;
 * 同包内单向依赖(mock → service),不存在循环引用。
 */

/* ------------------------------------------------------------------ */
/*  Mock 数据源                                                         */
/* ------------------------------------------------------------------ */

const DEPARTMENTS = ['技术部', '产品部', '市场部', '运营部', '人力资源部', '财务部', '设计部', '研发中心']
const TITLES = ['讲师', '高级讲师', '副教授', '教授', '研究员', '高级研究员']
const FIRST_NAMES = ['张', '李', '王', '赵', '陈', '刘', '杨', '黄', '周', '吴', '徐', '孙', '马', '朱', '胡', '林', '郭', '何']
const GIVEN_NAMES = ['伟', '芳', '娜', '敏', '静', '丽', '强', '磊', '军', '洋', '勇', '艳', '杰', '娟', '涛', '明', '超', '秀英', '霞', '平', '刚', '桂英']

const pad = (n: number, len = 4) => n.toString().padStart(len, '0')

/**
 * 模块级执行(IIFE 风格):生成稳定的 mock 数据集
 *
 * React 哲学 / 工程化原则:
 * - 硬件/设备信息(此处为 mock 数据)只获取一次,避免每次请求重复生成
 * - 稳定数据 = 同一请求参数始终返回相同结果,便于演示和测试
 */
const ALL_USERS: MentorUser[] = Array.from({ length: 137 }, (_, i) => {
  const seed = i + 1
  const fnIdx = seed % FIRST_NAMES.length
  const gnIdx = (seed * 3) % GIVEN_NAMES.length
  const deptIdx = (seed * 7) % DEPARTMENTS.length
  const titleIdx = (seed * 5) % TITLES.length
  const name = FIRST_NAMES[fnIdx] + GIVEN_NAMES[gnIdx]
  return {
    id: `U${pad(seed, 5)}`,
    name,
    employeeNo: `EMP${pad(seed)}`,
    department: DEPARTMENTS[deptIdx],
    title: TITLES[titleIdx],
    phone: `138${pad(10000000 + seed * 13, 8)}`,
    email: `${name.toLowerCase()}_${seed}@example.com`,
  }
})

/** 模拟网络延迟,让 DevTools Network 面板更直观 */
const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/* ------------------------------------------------------------------ */
/*  HTTP 请求处理器                                                     */
/* ------------------------------------------------------------------ */

export const handlers = [
  /**
   * GET /api/mentors - 分页搜索导师列表
   *
   * Query 参数:
   * - page: 页码,默认 1
   * - pageSize: 每页条数,默认 10
   * - name: 姓名模糊匹配
   * - department: 部门模糊匹配
   */
  http.get('/api/mentors', async ({ request }) => {
    const url = new URL(request.url)
    const page = Number(url.searchParams.get('page') || 1)
    const pageSize = Number(url.searchParams.get('pageSize') || 10)
    const name = url.searchParams.get('name') || ''
    const department = url.searchParams.get('department') || ''

    await delay(200 + Math.floor(Math.random() * 400))

    const filtered = ALL_USERS.filter((u) => {
      const nameMatch = !name || u.name.includes(name)
      const deptMatch = !department || u.department.includes(department)
      return nameMatch && deptMatch
    })

    const total = filtered.length
    const start = (page - 1) * pageSize
    const list = filtered.slice(start, start + pageSize)

    return HttpResponse.json({
      list,
      total,
      page,
      pageSize,
    })
  }),

  /**
   * GET /api/mentors/:id - 根据主键查询导师详情
   */
  http.get('/api/mentors/:id', async ({ params }) => {
    const { id } = params
    await delay(150 + Math.floor(Math.random() * 300))

    const user = ALL_USERS.find((u) => u.id === id) ?? null
    if (!user) {
      return new HttpResponse(null, { status: 404 })
    }
    return HttpResponse.json(user)
  }),
]
