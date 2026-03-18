import {
  LockOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  Col,
  Form,
  InputNumber,
  Row,
  Space,
  Statistic,
  Switch,
  Tag,
  Typography,
  message,
} from 'antd';
import { useEffect, useState } from 'react';
import ConsoleLayout from '../components/ConsoleLayout';
import {
  type SecurityPolicy,
  getSecurityPolicyRequest,
  updateSecurityPolicyRequest,
} from '../lib/api';

const { Title, Text } = Typography;
export default function AdminSecurity() {
  const [form] = Form.useForm<SecurityPolicy>();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [policy, setPolicy] = useState<SecurityPolicy | null>(null);
  const [messageApi, contextHolder] = message.useMessage();

  const loadPolicy = async () => {
    setLoading(true);
    try {
      const data = await getSecurityPolicyRequest();
      setPolicy(data);
      form.setFieldsValue(data);
    } catch {
      messageApi.error('加载安全策略失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPolicy();
  }, []);

  const onSave = async (values: SecurityPolicy) => {
    setSaving(true);
    try {
      const updated = await updateSecurityPolicyRequest(values);
      setPolicy(updated);
      form.setFieldsValue(updated);
      messageApi.success('安全策略已保存');
    } catch {
      messageApi.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ConsoleLayout
      breadcrumbItems={[{ title: '平台管理' }, { title: '安全策略' }]}
    >
      {contextHolder}

      <Row gutter={[16, 16]}>
        {/* 策略统计卡片 */}
        {policy && (
          <>
            <Col xs={24} sm={8}>
              <Card>
                <Statistic
                  title="最大失败次数"
                  value={policy.maxFailedAttempts}
                  suffix="次"
                  prefix={<LockOutlined />}
                />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card>
                <Statistic
                  title="锁定时长"
                  value={policy.lockoutMinutes}
                  suffix="分钟"
                  prefix={<SafetyCertificateOutlined />}
                />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card>
                <Statistic
                  title="最小密码长度"
                  value={policy.minPasswordLength}
                  suffix="字符"
                />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card>
                <Statistic
                  title="字符类别要求"
                  value={[
                    policy.requireUppercase,
                    policy.requireLowercase,
                    policy.requireNumbers,
                    policy.requireSymbols,
                  ].filter(Boolean).length}
                  suffix="项"
                />
              </Card>
            </Col>
          </>
        )}

        {/* 策略配置表单 */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <SafetyCertificateOutlined />
                <span>登录安全策略</span>
              </Space>
            }
            extra={
              <Button
                icon={<ReloadOutlined />}
                size="small"
                onClick={() => void loadPolicy()}
                loading={loading}
              >
                刷新
              </Button>
            }
          >
            <Form
              form={form}
              layout="vertical"
              onFinish={onSave}
              initialValues={{
                maxFailedAttempts: 5,
                lockoutMinutes: 15,
                minPasswordLength: 6,
                requireUppercase: false,
                requireLowercase: false,
                requireNumbers: false,
                requireSymbols: false,
                forcePasswordResetOnFirstLogin: false,
                rejectWeakPasswordOnLogin: false,
              }}
            >
              <Form.Item
                label="最大连续失败次数"
                name="maxFailedAttempts"
                rules={[{ required: true, message: '请输入' }, { type: 'number', min: 1, max: 20 }]}
                extra="超过该次数账号将被临时锁定"
              >
                <InputNumber min={1} max={20} style={{ width: '100%' }} addonAfter="次" />
              </Form.Item>

              <Form.Item
                label="账号锁定时长"
                name="lockoutMinutes"
                rules={[{ required: true, message: '请输入' }, { type: 'number', min: 1, max: 1440 }]}
                extra="失败次数达到上限后锁定的分钟数"
              >
                <InputNumber min={1} max={1440} style={{ width: '100%' }} addonAfter="分钟" />
              </Form.Item>

              <Form.Item
                label="最小密码长度"
                name="minPasswordLength"
                rules={[{ required: true, message: '请输入' }, { type: 'number', min: 4, max: 64 }]}
                extra="用户设置密码时的最低字符要求"
              >
                <InputNumber min={4} max={64} style={{ width: '100%' }} addonAfter="字符" />
              </Form.Item>

              <Form.Item label="要求包含大写字母" name="requireUppercase" valuePropName="checked">
                <Switch checkedChildren="开启" unCheckedChildren="关闭" />
              </Form.Item>

              <Form.Item label="要求包含小写字母" name="requireLowercase" valuePropName="checked">
                <Switch checkedChildren="开启" unCheckedChildren="关闭" />
              </Form.Item>

              <Form.Item label="要求包含数字" name="requireNumbers" valuePropName="checked">
                <Switch checkedChildren="开启" unCheckedChildren="关闭" />
              </Form.Item>

              <Form.Item label="要求包含特殊字符" name="requireSymbols" valuePropName="checked">
                <Switch checkedChildren="开启" unCheckedChildren="关闭" />
              </Form.Item>

              <Form.Item label="首次登录强制改密（可选）" name="forcePasswordResetOnFirstLogin" valuePropName="checked">
                <Switch checkedChildren="开启" unCheckedChildren="关闭" />
              </Form.Item>

              <Form.Item label="弱密码登录直接拒绝" name="rejectWeakPasswordOnLogin" valuePropName="checked">
                <Switch checkedChildren="开启" unCheckedChildren="关闭" />
              </Form.Item>

              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<SaveOutlined />}
                  loading={saving}
                  block
                >
                  保存策略
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </Col>

        {/* 说明卡片 */}
        <Col xs={24} lg={12}>
          <Card
            title="策略说明"
            styles={{ body: { padding: 20 } }}
          >
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <div>
                <Title level={5} style={{ marginBottom: 4 }}>登录锁定机制</Title>
                <Text type="secondary">
                  当同一账号在锁定时长窗口内，连续失败登录达到最大次数后，账号将被自动锁定。
                  锁定期间任何登录尝试均被拒绝，提示剩余锁定时间。锁定到期或成功登录后自动解除。
                </Text>
              </div>
              <div>
                <Title level={5} style={{ marginBottom: 4 }}>密码策略</Title>
                <Text type="secondary">
                  可配置最小长度与字符类别（大写、小写、数字、特殊字符）。
                  支持“首次登录强制改密”和“弱密码登录直接拒绝”两种策略开关。
                </Text>
              </div>
              <div>
                <Title level={5} style={{ marginBottom: 4 }}>策略存储</Title>
                <Text type="secondary">
                  安全策略已落独立表
                  <Tag style={{ margin: '0 4px' }}>auth_security_policies</Tag>
                  ，与通用平台设置解耦，便于后续策略审计与扩展。
                </Text>
              </div>
            </Space>
          </Card>
        </Col>
      </Row>
    </ConsoleLayout>
  );
}
