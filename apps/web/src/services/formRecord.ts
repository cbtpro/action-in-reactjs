import type { FormData } from '@/pages/form/types'

/**
 * 表单记录(列表行) —— 在 FormData 基础上追加主键和管理字段
 *
 * 列表页展示的是"已提交表单"的历史记录,
 * 详情页(复用表单页)根据 id 加载完整 FormData 回填。
 */
export interface FormRecord extends FormData {
  /** 主键 —— 列表跳转详情时通过 URL ?id= 传递 */
  id: string
  /** 创建时间 —— 列表列展示、排序用 */
  createdAt: string
  /** 状态标签(可选) */
  status?: '草稿' | '已提交' | '审核中' | '已通过'
}

export interface RecordListResult {
  list: FormRecord[]
  total: number
}

export interface RecordQuery {
  keyword?: string
  role?: string
  status?: FormRecord['status']
  page?: number
  pageSize?: number
}

/* ------------------------------------------------------------------ */
/*  Mock 数据生成 —— 用 IIFE 在模块加载时一次性生成 23 条记录             */
/* ------------------------------------------------------------------ */

const MOCK_ROLES: FormRecord['role'][] = ['personal', 'employee', 'admin']
const MOCK_STATUSES: NonNullable<FormRecord['status']>[] = ['草稿', '已提交', '审核中', '已通过']
const DEPARTMENTS = ['技术部', '产品部', '市场部', '运营部', '人力资源部', '财务部', '设计部', '研发中心']
const FIRST_NAMES = ['张', '李', '王', '赵', '刘', '陈', '杨', '黄', '周', '吴', '徐', '孙', '胡', '朱', '高', '林', '何', '郭', '马', '罗']
const LAST_NAMES = ['伟', '芳', '娜', '敏', '静', '丽', '强', '磊', '军', '洋', '艳', '勇', '杰', '娟', '涛', '明', '超', '秀英', '霞', '平']

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length]
}

function pad(n: number, len = 2): string {
  return String(n).padStart(len, '0')
}

const seedRecords = (): FormRecord[] => {
  const count = 23
  const list: FormRecord[] = []
  const base = Date.parse('2026-01-01T00:00:00Z')
  for (let i = 0; i < count; i++) {
    const name = `${pick(FIRST_NAMES, i)}${pick(LAST_NAMES, i * 3)}`
    const role = pick(MOCK_ROLES, i)
    const day = 1 + (i * 3) % 27
    const month = 1 + Math.floor((i * 3) / 27) % 12
    const createdAt = new Date(base + i * 86_400_000 * 4).toISOString().replace('T', ' ').slice(0, 19)
    const rec: FormRecord = {
      id: `REC${1000 + i}`,
      username: `${name.toLowerCase()}_${i}`,
      password: `Passw0rd${i}`,
      email: `${name.toLowerCase()}${i}@example.com`,
      phone: `138${pad(i, 4)}${pad((i * 17) % 10000, 4)}`,
      gender: i % 3 === 0 ? 'female' : i % 3 === 1 ? 'male' : 'other',
      birthday: `2026-${pad(month)}-${pad(day)}`,
      role,
      agree: i % 5 !== 0,
      bio: `这是 ${name} 的个人简介,编号 ${i}。`,
      company: role === 'employee' ? `${pick(DEPARTMENTS, i)}科技有限公司` : undefined,
      jobTitle: role === 'employee' ? ['工程师', '产品经理', '设计师', '运营专员'][i % 4] : undefined,
      mentorId: `U${pad(1 + (i % 137), 4)}`,
      contacts:
        i % 4 === 0
          ? [
              { label: '微信', value: `wechat_${name}_${i}` },
              { label: 'QQ', value: `${10000 + i}` },
            ]
          : i % 4 === 1
            ? [{ label: '备用电话', value: `139${pad(i, 8)}` }]
            : undefined,
      createdAt,
      status: pick(MOCK_STATUSES, i),
    }
    list.push(rec)
  }
  return list
}

const MOCK_DB = seedRecords()

/* ------------------------------------------------------------------ */
/*  查询 API                                                           */
/* ------------------------------------------------------------------ */

/**
 * 列表查询(模拟后端分页 + 关键字/角色/状态过滤)
 * 纯 Promise 版本,未来接入真实后端只需替换此函数实现。
 */
export async function queryFormRecords(q: RecordQuery = {}): Promise<RecordListResult> {
  const {
    keyword,
    role,
    status,
    page = 1,
    pageSize = 10,
  } = q

  await new Promise((r) => setTimeout(r, 280))

  const kw = keyword?.trim().toLowerCase()
  let filtered = MOCK_DB
  if (kw) {
    filtered = filtered.filter(
      (r) =>
        r.username.toLowerCase().includes(kw) ||
        r.email.toLowerCase().includes(kw) ||
        r.id.toLowerCase().includes(kw),
    )
  }
  if (role) filtered = filtered.filter((r) => r.role === role)
  if (status) filtered = filtered.filter((r) => r.status === status)

  const start = (page - 1) * pageSize
  return {
    list: filtered.slice(start, start + pageSize),
    total: filtered.length,
  }
}

/**
 * 按主键查询单条详情,供 /form?id=xxx 回填表单
 */
export async function getFormRecord(id: string): Promise<FormRecord | null> {
  await new Promise((r) => setTimeout(r, 180))
  const found = MOCK_DB.find((r) => r.id === id)
  return found ?? null
}
