import {
  BellOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import {
  Badge,
  Breadcrumb,
  Button,
  Empty,
  Layout,
  List,
  Menu,
  message,
  Popover,
  Tag,
  theme,
  Typography,
} from 'antd';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  createNotificationsStream,
  listNotificationsRequest,
  type PlatformNotificationEvent,
} from '../lib/api';
import { logoutRequest, profileRequest } from '../lib/auth-api';
import {
  clearAuthSession,
  getCurrentUser,
  hasPermissions,
  setCurrentUser,
  type SessionUser,
} from '../router/auth';
import { buildConsoleMenuItems } from './console/console-menu';
import { UserDropdown } from './console/user-dropdown';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

interface ConsoleLayoutProps {
  children: ReactNode;
  breadcrumbItems: { title: string }[];
}

export default function ConsoleLayout({ children, breadcrumbItems }: ConsoleLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [currentUser, setLocalCurrentUser] = useState<SessionUser | null>(getCurrentUser());
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState<PlatformNotificationEvent[]>([]);
  const {
    token: { colorBgContainer },
  } = theme.useToken();

  useEffect(() => {
    const pullNotifications = async () => {
      try {
        const list = await listNotificationsRequest();
        setNotifications(list);
      } catch {
        setNotifications([]);
      }
    };

    void pullNotifications();

    let source: EventSource | null = null;

    try {
      source = createNotificationsStream();
    } catch {
      return;
    }

    source.addEventListener('snapshot', (event) => {
      try {
        const payload = JSON.parse(event.data) as {
          notifications?: PlatformNotificationEvent[];
        };

        if (Array.isArray(payload.notifications)) {
          setNotifications(payload.notifications);
          setUnreadCount(0);
        }
      } catch {
        setUnreadCount(0);
      }
    });

    source.addEventListener('notification', (event) => {
      try {
        const payload = JSON.parse(event.data) as PlatformNotificationEvent;
        setNotifications((prev) => [payload, ...prev].slice(0, 20));
        setUnreadCount((prev) => Math.min(prev + 1, 99));

        if (payload.level === 'success') {
          message.success(payload.message);
          return;
        }

        if (payload.level === 'warning') {
          message.warning(payload.message);
          return;
        }

        if (payload.level === 'error') {
          message.error(payload.message);
          return;
        }

        message.info(payload.message);
      } catch {
        message.info('收到一条系统通知');
      }
    });

    return () => {
      source?.close();
    };
  }, []);

  useEffect(() => {
    const bootstrapProfile = async () => {
      try {
        const response = await profileRequest();
        setCurrentUser(response.user);
        setLocalCurrentUser(response.user);
      } catch {
        clearAuthSession();
        navigate('/login', { replace: true });
      }
    };

    void bootstrapProfile();
  }, [navigate]);

  const username = currentUser?.username ?? 'User';
  const roleLabel = (() => {
    if (currentUser?.roles.includes('admin')) return '超级管理员';
    if (currentUser?.roles.includes('operator')) return '运营管理员';
    if (currentUser?.roles.includes('viewer')) return '只读成员';
    return '平台成员';
  })();

  const menuItems = useMemo(
    () =>
      buildConsoleMenuItems({
        hasPermission: hasPermissions,
        navigate,
      }),
    [navigate],
  );

  const selectedKey = location.pathname.startsWith('/admin/')
    ? location.pathname
    : `/${location.pathname.split('/')[1] || 'dashboard'}`;

  const notificationContent = (
    <div style={{ width: 360, maxHeight: 420, overflow: 'auto' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
        }}
      >
        <Text strong>系统通知</Text>
        <Button type="link" size="small" onClick={() => setUnreadCount(0)}>
          清空未读
        </Button>
      </div>

      {notifications.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无通知" />
      ) : (
        <List
          size="small"
          dataSource={notifications}
          renderItem={(item) => (
            <List.Item>
              <List.Item.Meta
                title={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Text>{item.title}</Text>
                    <Tag
                      color={
                        item.level === 'success'
                          ? 'success'
                          : item.level === 'warning'
                            ? 'warning'
                            : item.level === 'error'
                              ? 'error'
                              : 'processing'
                      }
                    >
                      {item.level}
                    </Tag>
                  </div>
                }
                description={
                  <div>
                    <Text type="secondary">{item.message}</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {new Date(item.createdAt).toLocaleString()}
                    </Text>
                  </div>
                }
              />
            </List.Item>
          )}
        />
      )}
    </div>
  );

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        width={220}
        style={{ boxShadow: '2px 0 8px rgba(0,0,0,0.08)' }}
      >
        <div
          style={{
            height: 56,
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            padding: collapsed ? 0 : '0 24px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            gap: 10,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'linear-gradient(135deg,#1677ff,#0958d9)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <WalletOutlined style={{ color: '#fff', fontSize: 16 }} />
          </div>
          {!collapsed && (
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 15, whiteSpace: 'nowrap' }}>
              GigPayday
            </span>
          )}
        </div>

        <Menu
          theme="dark"
          selectedKeys={[selectedKey]}
          defaultOpenKeys={['admin']}
          mode="inline"
          items={menuItems}
          style={{ marginTop: 8, borderRight: 0 }}
        />
      </Sider>

      <Layout>
        <Header
          style={{
            padding: '0 24px',
            background: colorBgContainer,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #f0f0f0',
            height: 56,
            lineHeight: '56px',
          }}
        >
          <Breadcrumb items={breadcrumbItems} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Popover
              content={notificationContent}
              trigger="click"
              placement="bottomRight"
              open={notificationOpen}
              onOpenChange={(open) => {
                setNotificationOpen(open);
                if (open) {
                  setUnreadCount(0);
                }
              }}
            >
              <Badge count={unreadCount} size="small" overflowCount={99}>
                <Button type="text" icon={<BellOutlined style={{ fontSize: 18 }} />} />
              </Badge>
            </Popover>

            <UserDropdown
              username={username}
              roleLabel={roleLabel}
              onLogout={() => {
                void logoutRequest().finally(() => {
                  clearAuthSession();
                  navigate('/login', { replace: true });
                });
              }}
            />
          </div>
        </Header>

        <Content style={{ margin: 24, minHeight: 0 }}>{children}</Content>
      </Layout>
    </Layout>
  );
}
