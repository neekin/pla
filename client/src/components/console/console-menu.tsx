import {
  DashboardOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import type { ItemType } from 'antd/es/menu/interface';
import type { NavigateFunction } from 'react-router-dom';

interface BuildMenuOptions {
  hasPermission: (permissions: string[]) => boolean;
  navigate: NavigateFunction;
}

export function buildConsoleMenuItems({
  hasPermission,
  navigate,
}: BuildMenuOptions): ItemType[] {
  const items: ItemType[] = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: '数据概览',
      onClick: () => navigate('/dashboard'),
    },
  ];

  if (hasPermission(['task:read'])) {
    items.push({
      key: '/tasks',
      icon: <WalletOutlined />,
      label: '任务中心',
      onClick: () => navigate('/tasks'),
    });
  }

  if (
    hasPermission(['tenant:read']) ||
    hasPermission(['iam:manage']) ||
    hasPermission(['audit:read']) ||
    hasPermission(['config:read'])
  ) {
    const children: ItemType[] = [];

    if (hasPermission(['tenant:read'])) {
      children.push({
        key: '/admin/tenants',
        label: '租户管理',
        onClick: () => navigate('/admin/tenants'),
      });

      children.push({
        key: '/admin/billing',
        label: '版本与订阅',
        onClick: () => navigate('/admin/billing'),
      });
    }

    if (hasPermission(['iam:manage'])) {
      children.push({
        key: '/admin/users',
        label: '用户权限',
        onClick: () => navigate('/admin/users'),
      });
    }

    if (hasPermission(['audit:read'])) {
      children.push({
        key: '/admin/audits',
        label: '审计日志',
        onClick: () => navigate('/admin/audits'),
      });
    }

    if (hasPermission(['config:read'])) {
      children.push({
        key: '/admin/config',
        label: '配置中心',
        onClick: () => navigate('/admin/config'),
      });
    }

    if (hasPermission(['config:write'])) {
      children.push({
        key: '/admin/security',
        icon: <SafetyCertificateOutlined />,
        label: '安全策略',
        onClick: () => navigate('/admin/security'),
      });
    }

    items.push({
      key: 'admin',
      icon: <TeamOutlined />,
      label: '平台管理',
      children,
    });
  }

  return items;
}
