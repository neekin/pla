import {
  LockOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  Checkbox,
  Divider,
  Form,
  Grid,
  Input,
  Modal,
  Space,
  Typography,
  message,
  theme,
} from 'antd';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  loginRequest,
  resetPasswordRequest,
  resetPasswordSelfServiceRequest,
} from '../lib/auth-api';
import { getCurrentUser, setAuthSession, setCurrentUser } from '../router/auth';

const { Title, Text, Paragraph, Link } = Typography;

interface LoginForm {
  username: string;
  password: string;
  remember: boolean;
}

interface ResetPasswordForm {
  currentPassword?: string;
  newPassword: string;
  confirmPassword: string;
}

type ResetMode = 'authenticated' | 'self-service';

interface PendingResetContext {
  username: string;
  currentPassword: string;
  remember: boolean;
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [messageApi, contextHolder] = message.useMessage();
  const [resetForm] = Form.useForm<ResetPasswordForm>();
  const screens = Grid.useBreakpoint();
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [pendingRedirect, setPendingRedirect] = useState('/dashboard');
  const [resetMode, setResetMode] = useState<ResetMode>('authenticated');
  const [pendingResetContext, setPendingResetContext] = useState<PendingResetContext | null>(null);
  const {
    token: { colorBgLayout, colorBgContainer, colorPrimary, colorTextSecondary },
  } = theme.useToken();

  const onFinish = async (values: LoginForm) => {
    const from =
      (location.state as { from?: { pathname?: string } } | null)?.from
        ?.pathname || '/dashboard';

    try {
      const response = await loginRequest({
        username: values.username,
        password: values.password,
      });

      setAuthSession({
        token: response.accessToken,
        refreshToken: response.refreshToken,
        remember: values.remember,
        permissions: response.user.permissions,
        user: response.user,
      });

      if (response.user.requiresPasswordReset) {
        setPendingRedirect(from);
        setResetMode('authenticated');
        setPendingResetContext({
          username: values.username,
          currentPassword: values.password,
          remember: values.remember,
        });
        resetForm.resetFields();
        setResetModalOpen(true);
        messageApi.warning('账号需要先重置密码后再进入系统');
        return;
      }

      messageApi.success('登录成功，正在跳转…');
      setTimeout(() => navigate(from, { replace: true }), 500);
    } catch (error) {
      if (error instanceof Error && error.message === 'WEAK_PASSWORD_RESET_REQUIRED') {
        setPendingRedirect(from);
        setResetMode('self-service');
        setPendingResetContext({
          username: values.username,
          currentPassword: values.password,
          remember: values.remember,
        });
        resetForm.setFieldsValue({ currentPassword: values.password });
        setResetModalOpen(true);
        messageApi.warning('当前密码不符合安全策略，请先重置密码');
        return;
      }

      if (error instanceof Error && error.message !== 'LOGIN_FAILED') {
        messageApi.error(error.message);
      } else {
        messageApi.error('登录失败，请检查用户名或密码');
      }
    }
  };

  const onResetPassword = async () => {
    const values = await resetForm.validateFields();

    if (values.newPassword !== values.confirmPassword) {
      messageApi.error('两次输入的密码不一致');
      return;
    }

    setResetSubmitting(true);
    try {
      if (resetMode === 'authenticated') {
        await resetPasswordRequest({ newPassword: values.newPassword });

        const currentUser = getCurrentUser();
        if (currentUser) {
          setCurrentUser({
            ...currentUser,
            requiresPasswordReset: false,
          });
        }

        setResetModalOpen(false);
        messageApi.success('密码重置成功，正在进入控制台…');
        navigate(pendingRedirect, { replace: true });
        return;
      }

      if (!pendingResetContext) {
        messageApi.error('缺少重置上下文，请重新登录后再试');
        return;
      }

      await resetPasswordSelfServiceRequest({
        username: pendingResetContext.username,
        currentPassword: values.currentPassword ?? pendingResetContext.currentPassword,
        newPassword: values.newPassword,
      });

      const reLogin = await loginRequest({
        username: pendingResetContext.username,
        password: values.newPassword,
      });

      setAuthSession({
        token: reLogin.accessToken,
        refreshToken: reLogin.refreshToken,
        remember: pendingResetContext.remember,
        permissions: reLogin.user.permissions,
        user: reLogin.user,
      });

      setResetModalOpen(false);
      setPendingResetContext(null);
      messageApi.success('密码重置成功，正在进入控制台…');
      navigate(pendingRedirect, { replace: true });
    } catch (error) {
      if (error instanceof Error) {
        messageApi.error(error.message);
      } else {
        messageApi.error('密码重置失败');
      }
    } finally {
      setResetSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: screens.xs ? 16 : 32,
        background: colorBgLayout,
      }}
    >
      {contextHolder}

      <div
        style={{
          width: '100%',
          maxWidth: 1080,
          minHeight: screens.md ? 620 : 'auto',
          display: 'grid',
          gridTemplateColumns: screens.lg ? '1.1fr 0.9fr' : '1fr',
          overflow: 'hidden',
          borderRadius: 16,
          boxShadow: '0 16px 48px rgba(0,0,0,0.08)',
          background: colorBgContainer,
        }}
      >
        {screens.lg ? (
          <div
            style={{
              background: `linear-gradient(135deg, ${colorPrimary} 0%, #0958d9 100%)`,
              color: '#fff',
              padding: 48,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <Space size={12} align="center" style={{ marginBottom: 28 }}>
                <SafetyCertificateOutlined style={{ fontSize: 28 }} />
                <Title level={3} style={{ margin: 0, color: '#fff' }}>
                  GigPayday
                </Title>
              </Space>

              <Title level={2} style={{ color: '#fff', marginBottom: 12 }}>
                让财务协作变得更简单
              </Title>
              <Paragraph style={{ color: 'rgba(255,255,255,0.8)', fontSize: 16 }}>
                统一管理成员、收入、结算与合同，像优秀 SaaS 平台一样提供稳定、清晰的工作流体验。
              </Paragraph>
            </div>

            <div>
              <Divider style={{ borderColor: 'rgba(255,255,255,0.25)' }} />
              <Space direction="vertical" size={10}>
                <Text style={{ color: 'rgba(255,255,255,0.92)' }}>• 今日待处理事项实时汇总</Text>
                <Text style={{ color: 'rgba(255,255,255,0.92)' }}>• 结算、发票、合同一体化协同</Text>
                <Text style={{ color: 'rgba(255,255,255,0.92)' }}>• 全链路权限与操作审计</Text>
              </Space>
            </div>
          </div>
        ) : null}

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: screens.xs ? 20 : 40,
          }}
        >
          <Card
            bordered={false}
            style={{ width: '100%', maxWidth: 420, boxShadow: 'none' }}
            styles={{ body: { padding: 0 } }}
          >
            <Title level={3} style={{ marginBottom: 4 }}>
              欢迎回来
            </Title>
            <Text type="secondary" style={{ fontSize: 14 }}>
              使用账号密码登录，进入你的控制台。
            </Text>

            <Form<LoginForm>
              name="login"
              onFinish={onFinish}
              autoComplete="off"
              size="large"
              style={{ marginTop: 28 }}
              initialValues={{ remember: true }}
              layout="vertical"
            >
              <Form.Item
                label="用户名"
                name="username"
                rules={[{ required: true, message: '请输入用户名' }]}
              >
                <Input
                  prefix={<UserOutlined style={{ color: colorTextSecondary }} />}
                  placeholder="请输入用户名"
                  style={{ borderRadius: 10, height: 46 }}
                />
              </Form.Item>

              <Form.Item
                label="密码"
                name="password"
                rules={[{ required: true, message: '请输入密码' }]}
              >
                <Input.Password
                  prefix={<LockOutlined style={{ color: colorTextSecondary }} />}
                  placeholder="请输入密码"
                  style={{ borderRadius: 10, height: 46 }}
                />
              </Form.Item>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 20,
                }}
              >
                <Form.Item name="remember" valuePropName="checked" style={{ margin: 0 }}>
                  <Checkbox>记住我</Checkbox>
                </Form.Item>
                <Link style={{ fontSize: 13 }}>忘记密码？</Link>
              </div>

              <Form.Item style={{ marginBottom: 0 }}>
                <Button
                  type="primary"
                  htmlType="submit"
                  block
                  style={{ height: 46, borderRadius: 10, fontSize: 15, fontWeight: 600 }}
                >
                  登录
                </Button>
              </Form.Item>
            </Form>

            <div
              style={{
                marginTop: 16,
                padding: '10px 12px',
                borderRadius: 10,
                background: '#f5f7fa',
                textAlign: 'center',
              }}
            >
              <Text type="secondary" style={{ fontSize: 12 }}>
                测试账号：admin / 123456
              </Text>
            </div>

            <div style={{ marginTop: 16, textAlign: 'center' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                登录即表示同意服务协议与隐私政策
              </Text>
            </div>
          </Card>

          <div style={{ marginTop: 18, textAlign: 'center' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              © 2026 GigPayday
            </Text>
          </div>
        </div>
      </div>

      <Modal
        title="请先重置密码"
        open={resetModalOpen}
        okText="提交"
        cancelButtonProps={{ style: { display: 'none' } }}
        maskClosable={false}
        closable={false}
        confirmLoading={resetSubmitting}
        onOk={() => void onResetPassword()}
      >
        <Form form={resetForm} layout="vertical">
          {resetMode === 'self-service' && (
            <Form.Item
              label="当前密码"
              name="currentPassword"
              rules={[{ required: true, message: '请输入当前密码' }]}
            >
              <Input.Password placeholder="请输入当前密码" />
            </Form.Item>
          )}
          <Form.Item
            label="新密码"
            name="newPassword"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 4, message: '密码长度至少 4 位' },
            ]}
          >
            <Input.Password placeholder="请输入新密码" />
          </Form.Item>
          <Form.Item
            label="确认新密码"
            name="confirmPassword"
            rules={[{ required: true, message: '请再次输入新密码' }]}
          >
            <Input.Password placeholder="请再次输入新密码" />
          </Form.Item>
          <Text type="secondary" style={{ fontSize: 12 }}>
            密码需满足管理员配置的安全策略（长度与字符类别要求）。
          </Text>
        </Form>
      </Modal>
    </div>
  );
}
