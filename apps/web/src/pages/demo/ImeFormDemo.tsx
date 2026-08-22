import { useMemo, useState } from 'react'
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Divider,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Tag,
  Typography,
} from 'antd'
import { IMEInput } from '@/components/IMEInput'
import { IMENumberInput } from '@/components/IMENumberInput'
import { EyeOutlined } from '@ant-design/icons'

const { Title, Text, Paragraph } = Typography

/*
 * ============================================================
 * 数据契约(类型驱动)
 * ============================================================ */
interface ImeDemoFormData {
  nativeUsername: string
  imeUsername: string
  nativeEmail: string
  imeEmail: string
  nativeAge: number | null
  imeAge: number | null
  nativeDept: string
  imeDept: string
}

/*
 * ============================================================
 * 静态选项(Select)
 * ============================================================ */
const DEPT_OPTIONS = [
  { label: '技术部', value: 'tech' },
  { label: '产品经理部', value: 'pm' },
  { label: '人力资源部', value: 'hr' },
  { label: '运营部', value: 'ops' },
  { label: '财务部', value: 'fin' },
  { label: '研发中心', value: 'rdc' },
]

/**
 * ImeFormDemoPage — IME 合成事件 + 表单变更即校验 演示。
 *
 * 核心看点:
 *  1. 整个 Form 的 validateTrigger = 'onChange'
 *     → 字段 onChange 触发 → 立即跑校验。
 *  2. 左侧列用"原生 antd 组件"(Input/InputNumber/Select),
 *     右侧列用"IME* 封装组件"(IMEInput/IMENumberInput/普通 Select)。
 *  3. 用户用中文输入法输入时,左列会在按拼音过程中就开始提示校验错误
 *     (因为中间的拼音字符如 'zhan' 不符合 email 正则),
 *     而右列 IME* 组件只会在合成结束(选字完成)后才触发一次校验,
 *     视觉上更干净、体验更自然。
 *  4. 下方"即时预览"区域显示:字段触发了多少次 onChange,
 *     以及当前值,让用户能直观看到合成态的拦截效果。
 *  注:2026-08 架构简化后,withComposition 仅对真实 <input>/<textarea>
 *      生效(IMEInput/IMETextArea/IMENumberInput),Select 搜索输入框的
 *      composition 走原生 antd,故此处「部门」项直接使用原生 Select。
 */
export default function ImeFormDemoPage() {
  const [form] = Form.useForm<ImeDemoFormData>()
  const { message } = App.useApp()

  /*
   * onChange 触发计数器 —— 用于直观对比:
   *   原生组件在输入 "中国" 的过程中会触发 N 次 onChange(zh/zhon/zhong/中 国),
   *   IME 组件只在合成结束触发 2 次("中"选字/"国"选字)。
   */
  const [counters, setCounters] = useState({
    nativeUsername: 0,
    imeUsername: 0,
    nativeEmail: 0,
    imeEmail: 0,
  })

  const bump = (k: keyof typeof counters) =>
    setCounters((prev) => ({ ...prev, [k]: prev[k] + 1 }))

  const watched = Form.useWatch<ImeDemoFormData>(form)

  const handleSubmit = async (values: ImeDemoFormData) => {
    console.log('[IME 表单校验演示] 提交:', values)
    message.success('提交成功,请查看控制台 (校验只在合成完成后值最终确定时触发)')
  }

  /*
   * 下拉选项缓存(声明式配置驱动)
   */
  const deptOptions = useMemo(() => DEPT_OPTIONS, [])

  return (
    <section className="page" style={{ flex: 1, minHeight: 0, gap: 16 }}>
      {/* ---------- 标题 ---------- */}
      <div style={{ flexShrink: 0, marginBottom: 8 }}>
        <Title level={2} style={{ marginBottom: 4 }}>
          IME 合成事件 + 变更即校验 演示
        </Title>
        <Text type="secondary">
          使用 IMEInput / IMENumberInput 封装组件,
          避免中文输入法拼音合成期间触发 antd Form 的 onChange 校验。
          左侧用原生 antd 组件做对照组,右侧用 IME 封装组件做实验组。
        </Text>
      </div>

      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Alert
          showIcon
          type="info"
          message="怎么看效果?"
          description={
            <ol style={{ paddingLeft: 18, marginBottom: 0 }}>
              <li>
                把 Form 的 <Tag>validateTrigger="onChange"</Tag> 打开(当前已配置),
                任何 onChange 都会立刻触发校验。
              </li>
              <li>
                在 <Text strong>左列「原生组件」</Text> 用中文输入法输入任意内容:
                比如输入 "测试@example.com" 的过程中,会看到
                邮箱格式错误先闪出来、再消失(因为中间的 "ce@..." 是不合法邮箱)。
              </li>
              <li>
                在 <Text strong>右列「IME 封装组件」</Text> 同样输入——
                合成过程中完全不触发 onChange,选字完成后才上报最终值,
                邮箱格式校验不会乱闪错误。
              </li>
              <li>
                下方 <Text strong>onChange 触发次数</Text> 面板可以看到具体数字对比。
              </li>
            </ol>
          }
        />

        {/* ---------- 表单 ---------- */}
        <Card title="对比表单 (validateTrigger=onChange)">
          <Form<ImeDemoFormData>
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            autoComplete="off"
            requiredMark="optional"
            validateTrigger="onChange"
            initialValues={{
              nativeAge: null,
              imeAge: null,
            }}
          >
            <Row gutter={24}>
              {/* ---------------- 左列:原生组件 (对照组) ---------------- */}
              <Col span={12}>
                <Divider type="horizontal" style={{ marginBottom: 12 }}>
                  <Tag color="default">对照组 · 原生 antd</Tag>
                </Divider>

                <Form.Item
                  label="用户名(原生 Input)"
                  name="nativeUsername"
                  extra="2-12 个字符,字母、数字、下划线、中文"
                  rules={[
                    { required: true, message: '请填写用户名' },
                    { min: 2, max: 12, message: '长度 2 到 12' },
                  ]}
                >
                  <Input
                    placeholder="用中文输入法试试:'中文用户名'"
                    onChange={() => bump('nativeUsername')}
                    allowClear
                  />
                </Form.Item>

                <Form.Item
                  label="邮箱(原生 Input)"
                  name="nativeEmail"
                  extra="校验规则:必须是合法邮箱格式"
                  rules={[
                    { required: true, message: '请填写邮箱' },
                    { type: 'email', message: '邮箱格式不正确' },
                  ]}
                >
                  <Input
                    placeholder="用中文输入法输入拼音阶段试试,比如 'zhonghua@'"
                    onChange={() => bump('nativeEmail')}
                    allowClear
                  />
                </Form.Item>

                <Form.Item
                  label="年龄(原生 InputNumber)"
                  name="nativeAge"
                  extra="18-65 之间的整数"
                  rules={[
                    { required: true, message: '请填写年龄' },
                    {
                      type: 'number',
                      min: 18,
                      max: 65,
                      message: '年龄必须在 18~65 之间',
                    },
                  ]}
                >
                  <InputNumber style={{ width: '100%' }} min={0} max={999} />
                </Form.Item>

                <Form.Item
                  label="所属部门(原生 Select)"
                  name="nativeDept"
                  extra="showSearch:输入中文搜索(不拦截合成期字符,可能乱搜)"
                  rules={[{ required: true, message: '请选择部门' }]}
                >
                  <Select
                    style={{ width: '100%' }}
                    showSearch
                    placeholder="输入 '产' 搜索,会看到拼音过程中多次 onSearch"
                    optionFilterProp="label"
                    options={deptOptions}
                  />
                </Form.Item>
              </Col>

              {/* ---------------- 右列:IME* 封装组件(实验组) ---------------- */}
              <Col span={12}>
                <Divider type="horizontal" style={{ marginBottom: 12 }}>
                  <Tag color="geekblue">实验组 · IME 封装</Tag>
                </Divider>

                <Form.Item
                  label="用户名 (IMEInput)"
                  name="imeUsername"
                  extra="同样的校验规则,但中文输入时不会中途闪错"
                  rules={[
                    { required: true, message: '请填写用户名' },
                    { min: 2, max: 12, message: '长度 2 到 12' },
                  ]}
                >
                  <IMEInput
                    placeholder="用中文输入法:'中文用户名',合成期间完全不触发 onChange"
                    onChange={() => bump('imeUsername')}
                    allowClear
                  />
                </Form.Item>

                <Form.Item
                  label="邮箱 (IMEInput)"
                  name="imeEmail"
                  extra="格式校验只在选字完成后触发"
                  rules={[
                    { required: true, message: '请填写邮箱' },
                    { type: 'email', message: '邮箱格式不正确' },
                  ]}
                >
                  <IMEInput
                    placeholder="用中文输入法,邮箱规则在合成结束后才校验"
                    onChange={() => bump('imeEmail')}
                    allowClear
                  />
                </Form.Item>

                <Form.Item
                  label="年龄 (IMENumberInput)"
                  name="imeAge"
                  extra="数字输入框 + 合成态拦截,防止中文输入法闪 undefined 错"
                  rules={[
                    { required: true, message: '请填写年龄' },
                    {
                      type: 'number',
                      min: 18,
                      max: 65,
                      message: '年龄必须在 18~65 之间',
                    },
                  ]}
                >
                  <IMENumberInput min={0} max={999} />
                </Form.Item>

                <Form.Item
                  label="所属部门 (原生 Select)"
                  name="imeDept"
                  extra="withComposition 目前仅对 <input>/<textarea> 生效,此处使用 antd Select 做对照"
                  rules={[{ required: true, message: '请选择部门' }]}
                >
                  <Select
                    showSearch
                    placeholder="中文拼音输入时,原生 Select 搜索框会逐字符触发 onSearch"
                    optionFilterProp="label"
                    options={deptOptions}
                    onSearch={(kw: string) => {
                      console.log('[Select onSearch] 触发,关键词 =', kw)
                    }}
                  />
                </Form.Item>
              </Col>
            </Row>

            <Divider />

            <Space size="middle" wrap>
              <Button type="primary" htmlType="submit" icon={<EyeOutlined />}>
                提交表单(控制台看值)
              </Button>
              <Button onClick={() => form.resetFields()}>重置</Button>
              <Button
                type="default"
                onClick={() => {
                  form.setFieldsValue({
                    nativeUsername: '员工',
                    imeUsername: '员工',
                    nativeEmail: 'staff@example.com',
                    imeEmail: 'staff@example.com',
                    nativeAge: 28,
                    imeAge: 28,
                    nativeDept: 'tech',
                    imeDept: 'tech',
                  })
                  message.success('已填入示例数据')
                }}
              >
                填入示例数据
              </Button>
            </Space>
          </Form>
        </Card>

        {/* ---------- onChange 次数对比 + 当前值 ---------- */}
        <Card title="onChange 触发次数对比 (合成态拦截效果直观展示)">
          <Row gutter={24}>
            <Col span={12}>
              <Paragraph>
                <Text strong>对照组(原生 antd):</Text>
                拼音输入每个字符都会触发 onChange → 校验。
              </Paragraph>
              <Space direction="vertical">
                <div>用户名 onChange 次数:<Tag color="red">{counters.nativeUsername}</Tag></div>
                <div>邮箱 onChange 次数:<Tag color="red">{counters.nativeEmail}</Tag></div>
              </Space>
            </Col>
            <Col span={12}>
              <Paragraph>
                <Text strong>实验组(IME 封装):</Text>
                合成态 onChange 被吞掉,选字完成后才触发一次。
              </Paragraph>
              <Space direction="vertical">
                <div>用户名 onChange 次数:<Tag color="geekblue">{counters.imeUsername}</Tag></div>
                <div>邮箱 onChange 次数:<Tag color="geekblue">{counters.imeEmail}</Tag></div>
              </Space>
            </Col>
          </Row>

          <Divider style={{ marginTop: 24 }} />
          <Text type="secondary">当前表单值 (Form.useWatch 实时同步):</Text>
          <pre
            style={{
              marginTop: 8,
              padding: 12,
              background: '#f6f8fa',
              border: '1px solid #e5e7eb',
              borderRadius: 6,
              fontSize: 12,
              maxHeight: 280,
              overflow: 'auto',
            }}
          >
{JSON.stringify(watched, null, 2)}
          </pre>
        </Card>
      </Space>
    </section>
  )
}
