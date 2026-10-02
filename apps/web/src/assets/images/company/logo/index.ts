import airChinaLogo from './air-china.svg'
import alibabaLogo from './alibaba.svg'
import baicLogo from './baic.png'
import baiduLogo from './baidu.svg'
import bankOfChinaLogo from './bank-of-china.svg'
import byteDanceLogo from './bytedance.svg'
import chinaEasternLogo from './china-eastern.svg'
import chinaSouthernLogo from './china-southern.svg'
import didiLogo from './didi.svg'
import huaweiLogo from './huawei.svg'
import lenovoLogo from './lenovo.svg'
import meituanLogo from './meituan.svg'
import pinduoduoLogo from './pinduoduo.png'
import pingAnLogo from './ping-an.svg'
import tencentLogo from './tencent.svg'
import xiaomiLogo from './xiaomi.svg'

/**
 * 公司 Logo 与模型公司 ID 的唯一映射入口。
 *
 * 新增 Logo 时只需在这里增加资源导入和 ID 映射，业务组件无需改动。
 * 同一品牌的不同工商主体可以复用同一个本地资源。
 */
export const COMPANY_LOGOS: Readonly<Record<string, string>> = {
  tencent: tencentLogo,
  alibaba: alibabaLogo,
  huawei: huaweiLogo,
  bytedance: byteDanceLogo,
  baidu: baiduLogo,
  xiaomi: xiaomiLogo,
  meituan: meituanLogo,
  'model-company-009': baicLogo,
  'model-company-011': alibabaLogo,
  'model-company-012': tencentLogo,
  'model-company-014': baiduLogo,
  'model-company-016': pingAnLogo,
  'model-company-022': bankOfChinaLogo,
  'model-company-023': lenovoLogo,
  'model-company-025': byteDanceLogo,
  'model-company-026': meituanLogo,
  'model-company-027': didiLogo,
  'model-company-028': pinduoduoLogo,
  'model-company-034': chinaSouthernLogo,
  'model-company-035': airChinaLogo,
  'model-company-036': chinaEasternLogo,
}
