import type { Company } from './types'
import { COMPANY_LOGOS } from '../../../assets/images/company/logo'
import { COMPANY_SHORT_NAMES } from './companyShortNames'

const BASE_COMPANY_DIRECTORY: Omit<Company, 'shortName'>[] = [
  {
    "id": "tencent",
    "name": "深圳市腾讯计算机系统有限公司",
    "aliases": [
      "腾讯",
      "腾讯计算机",
      "深圳腾讯"
    ],
    "logo": {
      "text": "T",
      "background": "#1677ff",
      "foreground": "#ffffff"
    },
    "creditCode": "91440300708461136T",
    "region": "广东 · 深圳",
    "industry": "互联网和相关服务"
  },
  {
    "id": "alibaba",
    "name": "阿里巴巴（中国）有限公司",
    "aliases": [
      "阿里巴巴中国",
      "阿里巴巴",
      "阿里"
    ],
    "logo": {
      "text": "A",
      "background": "#ff6a00",
      "foreground": "#ffffff"
    },
    "creditCode": "91330100799655058B",
    "region": "浙江 · 杭州",
    "industry": "互联网和相关服务"
  },
  {
    "id": "huawei",
    "name": "华为技术有限公司",
    "aliases": [
      "华为科技",
      "华为技术",
      "华为"
    ],
    "logo": {
      "text": "华",
      "background": "#cf0a2c",
      "foreground": "#ffffff"
    },
    "creditCode": "914403001922038216",
    "region": "广东 · 深圳",
    "industry": "计算机、通信和电子设备制造业"
  },
  {
    "id": "bytedance",
    "name": "北京字节跳动科技有限公司",
    "aliases": [
      "字节跳动公司",
      "字节跳动",
      "北京字节"
    ],
    "logo": {
      "text": "字",
      "background": "#15171a",
      "foreground": "#ffffff"
    },
    "creditCode": "91110108MA001UEF9A",
    "region": "北京 · 海淀",
    "industry": "科技推广和应用服务业"
  },
  {
    "id": "baidu",
    "name": "北京百度网讯科技有限公司",
    "aliases": [
      "百度网讯",
      "百度",
      "北京百度"
    ],
    "logo": {
      "text": "百",
      "background": "#2932e1",
      "foreground": "#ffffff"
    },
    "creditCode": "91110000802100433B",
    "region": "北京 · 海淀",
    "industry": "互联网和相关服务"
  },
  {
    "id": "xiaomi",
    "name": "小米科技有限责任公司",
    "aliases": [
      "小米科技",
      "小米"
    ],
    "logo": {
      "text": "MI",
      "background": "#ff6900",
      "foreground": "#ffffff"
    },
    "creditCode": "91110108551385082Q",
    "region": "北京 · 海淀",
    "industry": "科技推广和应用服务业"
  },
  {
    "id": "jd",
    "name": "北京京东世纪贸易有限公司",
    "aliases": [
      "京东世纪",
      "京东",
      "北京京东"
    ],
    "logo": {
      "text": "JD",
      "background": "#e1251b",
      "foreground": "#ffffff"
    },
    "creditCode": "91110302791614657K",
    "region": "北京 · 大兴",
    "industry": "零售业"
  },
  {
    "id": "meituan",
    "name": "北京三快在线科技有限公司",
    "aliases": [
      "美团",
      "三快在线",
      "北京三快"
    ],
    "logo": {
      "text": "美",
      "background": "#ffd100",
      "foreground": "#222222"
    },
    "creditCode": "91110108660511594M",
    "region": "北京 · 海淀",
    "industry": "互联网和相关服务"
  },
  {
    "id": "model-company-001",
    "name": "北京银行股份有限公司",
    "aliases": [
      "北京银行"
    ],
    "logo": {
      "text": "北京",
      "background": "#5362ee",
      "foreground": "#ffffff"
    },
    "creditCode": "待补充",
    "region": "待补充",
    "industry": "待补充"
  },
  {
    "id": "model-company-002",
    "name": "北京市北京饭店有限责任公司",
    "aliases": [
      "北京饭店"
    ],
    "logo": {
      "text": "北京",
      "background": "#0f8a72",
      "foreground": "#ffffff"
    },
    "creditCode": "待补充",
    "region": "待补充",
    "industry": "待补充"
  },
  {
    "id": "model-company-003",
    "name": "神州融安科技（北京）有限公司",
    "aliases": [
      "神州融安科技"
    ],
    "logo": {
      "text": "神州",
      "background": "#db5a42",
      "foreground": "#ffffff"
    },
    "creditCode": "待补充",
    "region": "待补充",
    "industry": "待补充"
  },
  {
    "id": "model-company-004",
    "name": "北京稻香村食品有限责任公司",
    "aliases": [
      "北京稻香村"
    ],
    "logo": {
      "text": "北京",
      "background": "#7a4ed9",
      "foreground": "#ffffff"
    },
    "creditCode": "待补充",
    "region": "待补充",
    "industry": "待补充"
  },
  {
    "id": "model-company-005",
    "name": "北京丽源有限公司",
    "aliases": [
      "北京丽源"
    ],
    "logo": {
      "text": "北京",
      "background": "#1677ff",
      "foreground": "#ffffff"
    },
    "creditCode": "待补充",
    "region": "待补充",
    "industry": "待补充"
  },
  {
    "id": "model-company-006",
    "name": "中邦万基（北京）保安服务有限公司",
    "aliases": [
      "中邦万基（北京）保安服务"
    ],
    "logo": {
      "text": "中邦",
      "background": "#c24171",
      "foreground": "#ffffff"
    },
    "creditCode": "待补充",
    "region": "待补充",
    "industry": "待补充"
  },
  {
    "id": "model-company-007",
    "name": "陆海空三栖（北京）科技有限公司",
    "aliases": [
      "陆海空三栖（北京）科技"
    ],
    "logo": {
      "text": "陆海",
      "background": "#3d6b8e",
      "foreground": "#ffffff"
    },
    "creditCode": "待补充",
    "region": "待补充",
    "industry": "待补充"
  },
  {
    "id": "model-company-008",
    "name": "北京造纸一厂有限公司",
    "aliases": [
      "北京造纸一厂"
    ],
    "logo": {
      "text": "北京",
      "background": "#a35c16",
      "foreground": "#ffffff"
    },
    "creditCode": "待补充",
    "region": "待补充",
    "industry": "待补充"
  },
  {
    "id": "model-company-009",
    "name": "北京汽车集团有限公司",
    "aliases": [
      "北汽集团",
      "北京汽车集团"
    ],
    "logo": {
      "text": "北京",
      "background": "#5362ee",
      "foreground": "#ffffff"
    },
    "creditCode": "待补充",
    "region": "待补充",
    "industry": "待补充"
  },
  {
    "id": "model-company-010",
    "name": "北京六必居食品有限公司",
    "aliases": [
      "北京六必居食品"
    ],
    "logo": {
      "text": "北京",
      "background": "#0f8a72",
      "foreground": "#ffffff"
    },
    "creditCode": "待补充",
    "region": "待补充",
    "industry": "待补充"
  },
  {
    "id": "model-company-011",
    "name": "阿里巴巴集团",
    "aliases": [
      "阿里巴巴集团"
    ],
    "logo": {
      "text": "阿里",
      "background": "#db5a42",
      "foreground": "#ffffff"
    },
    "creditCode": "待补充",
    "region": "待补充",
    "industry": "待补充"
  },
  {
    "id": "model-company-012",
    "name": "腾讯控股有限公司",
    "aliases": [
      "腾讯控股"
    ],
    "logo": {
      "text": "腾讯",
      "background": "#7a4ed9",
      "foreground": "#ffffff"
    },
    "creditCode": "待补充",
    "region": "待补充",
    "industry": "待补充"
  },
  {
    "id": "model-company-013",
    "name": "深圳市生而不庸软件技术有限责任公司",
    "aliases": [
      "深圳市生而不庸软件技术"
    ],
    "logo": {
      "text": "深圳",
      "background": "#1677ff",
      "foreground": "#ffffff"
    },
    "creditCode": "待补充",
    "region": "待补充",
    "industry": "待补充"
  },
  {
    "id": "model-company-014",
    "name": "百度在线网络技术有限公司",
    "aliases": [
      "百度在线"
    ],
    "logo": {
      "text": "百度",
      "background": "#c24171",
      "foreground": "#ffffff"
    },
    "creditCode": "待补充",
    "region": "待补充",
    "industry": "待补充"
  },
  {
    "id": "model-company-015",
    "name": "京东集团",
    "aliases": [
      "京东集团"
    ],
    "logo": {
      "text": "京东",
      "background": "#3d6b8e",
      "foreground": "#ffffff"
    },
    "creditCode": "待补充",
    "region": "待补充",
    "industry": "待补充"
  },
  {
    "id": "model-company-016",
    "name": "中国平安保险（集团）股份有限公司",
    "aliases": [
      "中国平安"
    ],
    "logo": {
      "text": "中国",
      "background": "#a35c16",
      "foreground": "#ffffff"
    },
    "creditCode": "待补充",
    "region": "待补充",
    "industry": "待补充"
  },
  {
    "id": "model-company-017",
    "name": "中国移动通信集团有限公司",
    "aliases": [
      "中国移动"
    ],
    "logo": {
      "text": "中国",
      "background": "#5362ee",
      "foreground": "#ffffff"
    },
    "creditCode": "待补充",
    "region": "待补充",
    "industry": "待补充"
  },
  {
    "id": "model-company-018",
    "name": "中国石油天然气集团有限公司",
    "aliases": [
      "中国石油"
    ],
    "logo": {
      "text": "中国",
      "background": "#0f8a72",
      "foreground": "#ffffff"
    },
    "creditCode": "待补充",
    "region": "待补充",
    "industry": "待补充"
  },
  {
    "id": "model-company-019",
    "name": "中国工商银行股份有限公司",
    "aliases": [
      "中国工商银行",
      "工商银行"
    ],
    "logo": {
      "text": "中国",
      "background": "#db5a42",
      "foreground": "#ffffff"
    },
    "creditCode": "待补充",
    "region": "待补充",
    "industry": "待补充"
  },
  {
    "id": "model-company-020",
    "name": "中国建设银行股份有限公司",
    "aliases": [
      "中国建设银行",
      "建设银行"
    ],
    "logo": {
      "text": "中国",
      "background": "#7a4ed9",
      "foreground": "#ffffff"
    },
    "creditCode": "待补充",
    "region": "待补充",
    "industry": "待补充"
  },
  {
    "id": "model-company-021",
    "name": "中国农业银行股份有限公司",
    "aliases": [
      "中国农业银行",
      "农业银行"
    ],
    "logo": {
      "text": "中国",
      "background": "#1677ff",
      "foreground": "#ffffff"
    },
    "creditCode": "待补充",
    "region": "待补充",
    "industry": "待补充"
  },
  {
    "id": "model-company-022",
    "name": "中国银行股份有限公司",
    "aliases": [
      "中国银行"
    ],
    "logo": {
      "text": "中国",
      "background": "#c24171",
      "foreground": "#ffffff"
    },
    "creditCode": "待补充",
    "region": "待补充",
    "industry": "待补充"
  },
  {
    "id": "model-company-023",
    "name": "联想集团有限公司",
    "aliases": [
      "联想"
    ],
    "logo": {
      "text": "联想",
      "background": "#3d6b8e",
      "foreground": "#ffffff"
    },
    "creditCode": "待补充",
    "region": "待补充",
    "industry": "待补充"
  },
  {
    "id": "model-company-024",
    "name": "网易公司",
    "aliases": [
      "网易"
    ],
    "logo": {
      "text": "网易",
      "background": "#a35c16",
      "foreground": "#ffffff"
    },
    "creditCode": "待补充",
    "region": "待补充",
    "industry": "待补充"
  },
  {
    "id": "model-company-025",
    "name": "字节跳动有限公司",
    "aliases": [
      "字节跳动"
    ],
    "logo": {
      "text": "字节",
      "background": "#5362ee",
      "foreground": "#ffffff"
    },
    "creditCode": "待补充",
    "region": "待补充",
    "industry": "待补充"
  },
  {
    "id": "model-company-026",
    "name": "美团点评",
    "aliases": [],
    "logo": {
      "text": "美团",
      "background": "#0f8a72",
      "foreground": "#ffffff"
    },
    "creditCode": "待补充",
    "region": "待补充",
    "industry": "待补充"
  },
  {
    "id": "model-company-027",
    "name": "滴滴出行",
    "aliases": [],
    "logo": {
      "text": "滴滴",
      "background": "#db5a42",
      "foreground": "#ffffff"
    },
    "creditCode": "待补充",
    "region": "待补充",
    "industry": "待补充"
  },
  {
    "id": "model-company-028",
    "name": "拼多多",
    "aliases": [],
    "logo": {
      "text": "拼多",
      "background": "#7a4ed9",
      "foreground": "#ffffff"
    },
    "creditCode": "待补充",
    "region": "待补充",
    "industry": "待补充"
  },
  {
    "id": "model-company-029",
    "name": "中兴通讯股份有限公司",
    "aliases": [
      "中兴通讯"
    ],
    "logo": {
      "text": "中兴",
      "background": "#1677ff",
      "foreground": "#ffffff"
    },
    "creditCode": "待补充",
    "region": "待补充",
    "industry": "待补充"
  },
  {
    "id": "model-company-030",
    "name": "海尔集团",
    "aliases": [
      "海尔"
    ],
    "logo": {
      "text": "海尔",
      "background": "#c24171",
      "foreground": "#ffffff"
    },
    "creditCode": "待补充",
    "region": "待补充",
    "industry": "待补充"
  },
  {
    "id": "model-company-031",
    "name": "格力电器股份有限公司",
    "aliases": [
      "格力电器"
    ],
    "logo": {
      "text": "格力",
      "background": "#3d6b8e",
      "foreground": "#ffffff"
    },
    "creditCode": "待补充",
    "region": "待补充",
    "industry": "待补充"
  },
  {
    "id": "model-company-032",
    "name": "比亚迪股份有限公司",
    "aliases": [
      "比亚迪"
    ],
    "logo": {
      "text": "比亚",
      "background": "#a35c16",
      "foreground": "#ffffff"
    },
    "creditCode": "待补充",
    "region": "待补充",
    "industry": "待补充"
  },
  {
    "id": "model-company-033",
    "name": "顺丰速运有限公司",
    "aliases": [
      "顺丰速运"
    ],
    "logo": {
      "text": "顺丰",
      "background": "#5362ee",
      "foreground": "#ffffff"
    },
    "creditCode": "待补充",
    "region": "待补充",
    "industry": "待补充"
  },
  {
    "id": "model-company-034",
    "name": "中国南方航空集团有限公司",
    "aliases": [
      "中国南方航空"
    ],
    "logo": {
      "text": "中国",
      "background": "#0f8a72",
      "foreground": "#ffffff"
    },
    "creditCode": "待补充",
    "region": "待补充",
    "industry": "待补充"
  },
  {
    "id": "model-company-035",
    "name": "中国国际航空股份有限公司",
    "aliases": [
      "中国国际航空"
    ],
    "logo": {
      "text": "中国",
      "background": "#db5a42",
      "foreground": "#ffffff"
    },
    "creditCode": "待补充",
    "region": "待补充",
    "industry": "待补充"
  },
  {
    "id": "model-company-036",
    "name": "中国东方航空集团有限公司",
    "aliases": [
      "中国东方航空"
    ],
    "logo": {
      "text": "中国",
      "background": "#7a4ed9",
      "foreground": "#ffffff"
    },
    "creditCode": "待补充",
    "region": "待补充",
    "industry": "待补充"
  },
  {
    "id": "model-company-037",
    "name": "中国铁路总公司",
    "aliases": [
      "中国铁路"
    ],
    "logo": {
      "text": "中国",
      "background": "#1677ff",
      "foreground": "#ffffff"
    },
    "creditCode": "待补充",
    "region": "待补充",
    "industry": "待补充"
  },
  {
    "id": "model-company-038",
    "name": "中国建筑集团有限公司",
    "aliases": [
      "中国建筑"
    ],
    "logo": {
      "text": "中国",
      "background": "#c24171",
      "foreground": "#ffffff"
    },
    "creditCode": "待补充",
    "region": "待补充",
    "industry": "待补充"
  },
  {
    "id": "model-company-039",
    "name": "中国交通建设股份有限公司",
    "aliases": [
      "中国交通建设"
    ],
    "logo": {
      "text": "中国",
      "background": "#3d6b8e",
      "foreground": "#ffffff"
    },
    "creditCode": "待补充",
    "region": "待补充",
    "industry": "待补充"
  },
  {
    "id": "model-company-040",
    "name": "中国邮政集团公司",
    "aliases": [
      "中国邮政"
    ],
    "logo": {
      "text": "中国",
      "background": "#a35c16",
      "foreground": "#ffffff"
    },
    "creditCode": "待补充",
    "region": "待补充",
    "industry": "待补充"
  },
  {
    "id": "model-company-041",
    "name": "中国电信集团有限公司",
    "aliases": [
      "中国电信"
    ],
    "logo": {
      "text": "中国",
      "background": "#5362ee",
      "foreground": "#ffffff"
    },
    "creditCode": "待补充",
    "region": "待补充",
    "industry": "待补充"
  },
  {
    "id": "model-company-042",
    "name": "中国联合网络通信集团有限公司",
    "aliases": [
      "中国联通"
    ],
    "logo": {
      "text": "中国",
      "background": "#0f8a72",
      "foreground": "#ffffff"
    },
    "creditCode": "待补充",
    "region": "待补充",
    "industry": "待补充"
  },
  {
    "id": "model-company-043",
    "name": "中国海洋石油集团有限公司",
    "aliases": [
      "中国海洋石油"
    ],
    "logo": {
      "text": "中国",
      "background": "#db5a42",
      "foreground": "#ffffff"
    },
    "creditCode": "待补充",
    "region": "待补充",
    "industry": "待补充"
  },
  {
    "id": "model-company-044",
    "name": "中国中化集团有限公司",
    "aliases": [
      "中国中化"
    ],
    "logo": {
      "text": "中国",
      "background": "#7a4ed9",
      "foreground": "#ffffff"
    },
    "creditCode": "待补充",
    "region": "待补充",
    "industry": "待补充"
  },
  {
    "id": "model-company-045",
    "name": "中国化工集团有限公司",
    "aliases": [
      "中国化工"
    ],
    "logo": {
      "text": "中国",
      "background": "#1677ff",
      "foreground": "#ffffff"
    },
    "creditCode": "待补充",
    "region": "待补充",
    "industry": "待补充"
  },
  {
    "id": "model-company-046",
    "name": "中国兵器工业集团有限公司",
    "aliases": [
      "中国兵器工业"
    ],
    "logo": {
      "text": "中国",
      "background": "#c24171",
      "foreground": "#ffffff"
    },
    "creditCode": "待补充",
    "region": "待补充",
    "industry": "待补充"
  },
  {
    "id": "model-company-047",
    "name": "中国航天科技集团有限公司",
    "aliases": [
      "中国航天科技"
    ],
    "logo": {
      "text": "中国",
      "background": "#3d6b8e",
      "foreground": "#ffffff"
    },
    "creditCode": "待补充",
    "region": "待补充",
    "industry": "待补充"
  },
  {
    "id": "model-company-048",
    "name": "中国航天科工集团有限公司",
    "aliases": [
      "中国航天科工"
    ],
    "logo": {
      "text": "中国",
      "background": "#a35c16",
      "foreground": "#ffffff"
    },
    "creditCode": "待补充",
    "region": "待补充",
    "industry": "待补充"
  },
  {
    "id": "model-company-049",
    "name": "中国航空工业集团有限公司",
    "aliases": [
      "中国航空工业"
    ],
    "logo": {
      "text": "中国",
      "background": "#5362ee",
      "foreground": "#ffffff"
    },
    "creditCode": "待补充",
    "region": "待补充",
    "industry": "待补充"
  },
  {
    "id": "model-company-050",
    "name": "中国船舶工业集团有限公司",
    "aliases": [
      "中国船舶工业"
    ],
    "logo": {
      "text": "中国",
      "background": "#0f8a72",
      "foreground": "#ffffff"
    },
    "creditCode": "待补充",
    "region": "待补充",
    "industry": "待补充"
  },
  {
    "id": "model-company-051",
    "name": "中国船舶重工集团有限公司",
    "aliases": [
      "中国船舶重工"
    ],
    "logo": {
      "text": "中国",
      "background": "#db5a42",
      "foreground": "#ffffff"
    },
    "creditCode": "待补充",
    "region": "待补充",
    "industry": "待补充"
  },
  {
    "id": "model-company-052",
    "name": "中国电子科技集团有限公司",
    "aliases": [
      "中国电子科技"
    ],
    "logo": {
      "text": "中国",
      "background": "#7a4ed9",
      "foreground": "#ffffff"
    },
    "creditCode": "待补充",
    "region": "待补充",
    "industry": "待补充"
  },
  {
    "id": "model-company-053",
    "name": "中国电子信息产业集团有限公司",
    "aliases": [
      "中国电子信息产业"
    ],
    "logo": {
      "text": "中国",
      "background": "#1677ff",
      "foreground": "#ffffff"
    },
    "creditCode": "待补充",
    "region": "待补充",
    "industry": "待补充"
  },
  {
    "id": "model-company-054",
    "name": "中国华能集团有限公司",
    "aliases": [
      "中国华能"
    ],
    "logo": {
      "text": "中国",
      "background": "#c24171",
      "foreground": "#ffffff"
    },
    "creditCode": "待补充",
    "region": "待补充",
    "industry": "待补充"
  },
  {
    "id": "model-company-055",
    "name": "中国大唐集团有限公司",
    "aliases": [
      "中国大唐"
    ],
    "logo": {
      "text": "中国",
      "background": "#3d6b8e",
      "foreground": "#ffffff"
    },
    "creditCode": "待补充",
    "region": "待补充",
    "industry": "待补充"
  },
  {
    "id": "model-company-056",
    "name": "中国华电集团有限公司",
    "aliases": [
      "中国华电"
    ],
    "logo": {
      "text": "中国",
      "background": "#a35c16",
      "foreground": "#ffffff"
    },
    "creditCode": "待补充",
    "region": "待补充",
    "industry": "待补充"
  },
  {
    "id": "model-company-057",
    "name": "国家电力投资集团有限公司",
    "aliases": [
      "国家电投"
    ],
    "logo": {
      "text": "国家",
      "background": "#5362ee",
      "foreground": "#ffffff"
    },
    "creditCode": "待补充",
    "region": "待补充",
    "industry": "待补充"
  },
  {
    "id": "model-company-058",
    "name": "中国长江三峡集团有限公司",
    "aliases": [
      "中国长江三峡"
    ],
    "logo": {
      "text": "中国",
      "background": "#0f8a72",
      "foreground": "#ffffff"
    },
    "creditCode": "待补充",
    "region": "待补充",
    "industry": "待补充"
  },
  {
    "id": "model-company-059",
    "name": "国家能源投资集团有限责任公司",
    "aliases": [
      "国家能源集团"
    ],
    "logo": {
      "text": "国家",
      "background": "#db5a42",
      "foreground": "#ffffff"
    },
    "creditCode": "待补充",
    "region": "待补充",
    "industry": "待补充"
  }
]

export const COMPANY_DIRECTORY: Company[] = BASE_COMPANY_DIRECTORY.map((company) => {
  const logoSrc = COMPANY_LOGOS[company.id]
  const shortName = COMPANY_SHORT_NAMES[company.id]

  if (!shortName) {
    throw new Error(`公司 ${company.id} 缺少简称配置`)
  }

  return {
    ...company,
    shortName,
    logo: {
      ...company.logo,
      text: shortName,
      ...(logoSrc ? { src: logoSrc } : {}),
    },
  }
})

const MODEL_SOURCE_COMPANIES = COMPANY_DIRECTORY.filter((company) =>
  company.id === 'huawei'
  || company.id === 'xiaomi'
  || company.id.startsWith('model-company-'),
)

/**
 * 从用户提供的模型数据中截取全称/简称，并记录期望企业。
 * 若简称与目录中的其他企业冲突，则自动回退到全称，避免测试样本误命中。
 */
export const MODEL_MATCH_TEST_CASES = MODEL_SOURCE_COMPANIES.map(
  (company, index) => {
    const preferredInput = index % 2 === 0
      ? (company.aliases[0] ?? company.name)
      : company.name
    const exactOwner = COMPANY_DIRECTORY.find(
      (item) => item.name === preferredInput,
    )
    const aliasOwner = COMPANY_DIRECTORY.find((item) =>
      item.aliases.includes(preferredInput),
    )
    const resolvedOwner = exactOwner ?? aliasOwner

    return {
      input: resolvedOwner && resolvedOwner.id !== company.id
        ? company.name
        : preferredInput,
      companyName: company.name,
    }
  },
)

export const MODEL_MATCH_TEST_NAMES = [...new Set(
  MODEL_MATCH_TEST_CASES.map((testCase) => testCase.input),
)]

/** 整个企业目录的稳定可匹配样本池。 */
export const COMPANY_MATCH_TEST_NAMES = [...new Set(
  COMPANY_DIRECTORY.flatMap((company) => [company.name, company.aliases[0]])
    .filter((name): name is string => Boolean(name)),
)]
