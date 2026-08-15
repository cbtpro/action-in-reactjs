import { Form, Input, Row, Col } from 'antd'
import { MinusCircleOutlined } from '@ant-design/icons'
import type { FormListFieldData } from 'antd'

interface DynamicListItemProps {
  field: FormListFieldData
  onRemove?: () => void
  showRemove: boolean
}

/**
 * DynamicListItem - 封装 Form.List 中的单行表单项
 *
 * React 哲学:关注点分离
 *
 * 将 name 前缀拼接、移除按钮等重复逻辑收敛到一处,
 * 外部只需关心"这一行长什么样";Form.List 的增删逻辑由父组件负责,
 * 行组件只负责渲染与触发 onRemove,职责单一。
 */
export default function DynamicListItem({
  field,
  onRemove,
  showRemove,
}: DynamicListItemProps) {
  return (
    <Row gutter={16} align="middle" style={{ marginBottom: 8 }}>
      <Col span={10}>
        <Form.Item
          name={[field.name, 'label']}
          rules={[{ required: true, message: '请输入标签' }]}
          style={{ marginBottom: 0 }}
        >
          <Input placeholder="标签(如: 家庭、公司)" />
        </Form.Item>
      </Col>
      <Col span={12}>
        <Form.Item
          name={[field.name, 'value']}
          rules={[{ required: true, message: '请输入内容' }]}
          style={{ marginBottom: 0 }}
        >
          <Input placeholder="内容" />
        </Form.Item>
      </Col>
      <Col span={2}>
        {showRemove && (
          <MinusCircleOutlined
            style={{ color: '#ff4d4f', fontSize: 18, cursor: 'pointer' }}
            onClick={onRemove}
          />
        )}
      </Col>
    </Row>
  )
}
