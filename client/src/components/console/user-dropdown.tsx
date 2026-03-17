import {
  LogoutOutlined,
  SettingOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Avatar, Dropdown } from 'antd';

interface UserDropdownProps {
  username: string;
  roleLabel: string;
  onLogout: () => void;
}

export function UserDropdown({ username, roleLabel, onLogout }: UserDropdownProps) {
  return (
    <Dropdown
      menu={{
        items: [
          { key: 'profile', icon: <UserOutlined />, label: '个人信息' },
          { key: 'settings', icon: <SettingOutlined />, label: '账号设置' },
          { type: 'divider' as const },
          {
            key: 'logout',
            icon: <LogoutOutlined />,
            label: '退出登录',
            danger: true,
          },
        ],
        onClick: ({ key }) => {
          if (key === 'logout') {
            onLogout();
          }
        },
      }}
      placement="bottomRight"
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          cursor: 'pointer',
          padding: '4px 8px',
          borderRadius: 6,
        }}
      >
        <Avatar size={32} style={{ background: 'linear-gradient(135deg,#1677ff,#0958d9)' }}>
          {username.slice(0, 1).toUpperCase()}
        </Avatar>
        <div style={{ lineHeight: 1.3 }}>
          <div style={{ fontSize: 13, fontWeight: 500 }}>{username}</div>
          <div style={{ fontSize: 11, color: '#8c8c8c' }}>{roleLabel}</div>
        </div>
      </div>
    </Dropdown>
  );
}
