import { lazy, type ReactElement } from 'react';
import { Navigate } from 'react-router-dom';

const Dashboard = lazy(() => import('../pages/Dashboard'));
const Forbidden = lazy(() => import('../pages/Forbidden'));
const Login = lazy(() => import('../pages/Login'));
const Tasks = lazy(() => import('../pages/Tasks'));
const AdminTenants = lazy(() => import('../pages/AdminTenants'));
const AdminUsers = lazy(() => import('../pages/AdminUsers'));
const AdminAudits = lazy(() => import('../pages/AdminAudits'));
const AdminConfig = lazy(() => import('../pages/AdminConfig'));
const AdminSecurity = lazy(() => import('../pages/AdminSecurity'));

export interface AppRouteItem {
  path: string;
  element: ReactElement;
  requiresAuth?: boolean;
  guestOnly?: boolean;
  requiredPermissions?: string[];
}

export const appRoutes: AppRouteItem[] = [
  {
    path: '/',
    element: <Navigate to="/dashboard" replace />,
  },
  {
    path: '/login',
    element: <Login />,
    guestOnly: true,
  },
  {
    path: '/dashboard',
    element: <Dashboard />,
    requiresAuth: true,
    requiredPermissions: ['dashboard:view'],
  },
  {
    path: '/tasks',
    element: <Tasks />,
    requiresAuth: true,
    requiredPermissions: ['task:read'],
  },
  {
    path: '/admin/tenants',
    element: <AdminTenants />,
    requiresAuth: true,
    requiredPermissions: ['tenant:read'],
  },
  {
    path: '/admin/users',
    element: <AdminUsers />,
    requiresAuth: true,
    requiredPermissions: ['iam:manage'],
  },
  {
    path: '/admin/audits',
    element: <AdminAudits />,
    requiresAuth: true,
    requiredPermissions: ['audit:read'],
  },
  {
    path: '/admin/config',
    element: <AdminConfig />,
    requiresAuth: true,
    requiredPermissions: ['config:read'],
  },
  {
    path: '/admin/security',
    element: <AdminSecurity />,
    requiresAuth: true,
    requiredPermissions: ['config:write'],
  },
  {
    path: '/403',
    element: <Forbidden />,
    requiresAuth: true,
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
];
