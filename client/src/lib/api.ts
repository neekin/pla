import {
  getAccessToken,
  getAuthorizationHeader,
  type SessionUser,
} from '../router/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export interface LoginPayload {
  username: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  tokenType: string;
  user: {
    userId: string;
    username: string;
    tenantId: string;
    roles: string[];
    permissions: string[];
  };
}

export interface ProfileResponse {
  user: SessionUser;
  platform: {
    mode: string;
    message: string;
  };
}

export interface TaskItem {
  id: string;
  taskType: string;
  payload: Record<string, unknown>;
  runAt: string;
  status: 'queued' | 'running' | 'done';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface DispatchTaskPayload {
  taskType: string;
  payload?: Record<string, unknown>;
  runAt?: string;
}

export interface TenantItem {
  id: string;
  name: string;
  status: 'active' | 'inactive';
  edition: 'free' | 'pro' | 'enterprise';
}

export interface IamUserItem {
  id: string;
  username: string;
  roles: string[];
  permissions: string[];
}

export interface AuditLogItem {
  timestamp: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  tenantId: string;
  username: string;
  userId: string;
  ip: string;
}

export interface PlatformConfigResponse {
  updatedAt: string;
  featureFlags: Record<string, boolean>;
  taskQueue: {
    persistenceEnabled: boolean;
    runnerEnabled: boolean;
  };
}

export interface PlatformConfigRuntimeStatusResponse {
  dataDirectory: string;
  configFilePath: string;
  taskQueueFilePath: string;
  taskQueueFileExists: boolean;
  taskQueueFileSizeBytes: number;
  taskQueueFileUpdatedAt: string | null;
}

export interface QueueStorageHealthResponse {
  ok: boolean;
  checkedAt: string;
  taskQueueFilePath: string;
  taskQueueFileExists: boolean;
  dataDirectoryWritable: boolean;
  taskQueueFileReadable: boolean;
  taskQueueFileWritable: boolean;
  taskQueueJsonValid: boolean | null;
  detail: string;
}

export interface TaskStatsResponse {
  queued: number;
  running: number;
  done: number;
  total: number;
}

export interface PlatformNotificationEvent {
  id: string;
  type: string;
  title: string;
  message: string;
  level: 'info' | 'success' | 'warning' | 'error';
  createdAt: string;
  meta?: Record<string, unknown>;
}

export interface PlatformPluginInfo {
  key: string;
  name: string;
  description: string;
  version: string;
  source?: 'builtin' | 'external';
}

export type PlatformSettingScopeType = 'host' | 'tenant' | 'user';

export interface PlatformSettingItem {
  id?: string;
  key: string;
  value: unknown;
  scopeType?: PlatformSettingScopeType;
  scopeId?: string;
  source?: PlatformSettingScopeType;
  sourceScopeId?: string;
  updatedBy?: string | null;
  updatedAt?: string;
}

export interface EffectiveSettingsResponse {
  scope: {
    tenantId: string | null;
    userId: string | null;
  };
  settings: PlatformSettingItem[];
  resolutionOrder: string[];
}

function buildUrl(path: string) {
  return `${API_BASE_URL}${path}`;
}

function requireAuthHeader() {
  const authorization = getAuthorizationHeader();

  if (!authorization) {
    throw new Error('UNAUTHORIZED');
  }

  return authorization;
}

export async function loginRequest(payload: LoginPayload): Promise<LoginResponse> {
  const response = await fetch(buildUrl('/auth/login'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error('LOGIN_FAILED');
  }

  return response.json() as Promise<LoginResponse>;
}

export async function profileRequest(): Promise<ProfileResponse> {
  const authorization = requireAuthHeader();

  const response = await fetch(buildUrl('/auth/profile'), {
    method: 'GET',
    headers: {
      Authorization: authorization,
    },
  });

  if (!response.ok) {
    throw new Error('PROFILE_FAILED');
  }

  return response.json() as Promise<ProfileResponse>;
}

export async function listTasksRequest(): Promise<TaskItem[]> {
  const response = await fetch(buildUrl('/tasks'), {
    method: 'GET',
    headers: {
      Authorization: requireAuthHeader(),
    },
  });

  if (!response.ok) {
    throw new Error('TASK_LIST_FAILED');
  }

  return response.json() as Promise<TaskItem[]>;
}

export async function dispatchTaskRequest(payload: DispatchTaskPayload): Promise<{
  message: string;
  task: TaskItem;
}> {
  const response = await fetch(buildUrl('/tasks/dispatch'), {
    method: 'POST',
    headers: {
      Authorization: requireAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error('TASK_DISPATCH_FAILED');
  }

  return response.json() as Promise<{ message: string; task: TaskItem }>;
}

export async function runTaskNowRequest(taskId: string): Promise<{
  message: string;
  task: TaskItem;
}> {
  const response = await fetch(buildUrl(`/tasks/${taskId}/run`), {
    method: 'POST',
    headers: {
      Authorization: requireAuthHeader(),
    },
  });

  if (!response.ok) {
    throw new Error('TASK_RUN_FAILED');
  }

  return response.json() as Promise<{ message: string; task: TaskItem }>;
}

export async function listTenantsRequest(): Promise<TenantItem[]> {
  const response = await fetch(buildUrl('/tenants'), {
    method: 'GET',
    headers: {
      Authorization: requireAuthHeader(),
    },
  });

  if (!response.ok) {
    throw new Error('TENANT_LIST_FAILED');
  }

  return response.json() as Promise<TenantItem[]>;
}

export async function listIamUsersRequest(): Promise<IamUserItem[]> {
  const response = await fetch(buildUrl('/iam/users'), {
    method: 'GET',
    headers: {
      Authorization: requireAuthHeader(),
    },
  });

  if (!response.ok) {
    throw new Error('IAM_USERS_FAILED');
  }

  return response.json() as Promise<IamUserItem[]>;
}

export async function listPermissionCatalogRequest(): Promise<string[]> {
  const response = await fetch(buildUrl('/iam/permissions'), {
    method: 'GET',
    headers: {
      Authorization: requireAuthHeader(),
    },
  });

  if (!response.ok) {
    throw new Error('IAM_PERMISSIONS_FAILED');
  }

  return response.json() as Promise<string[]>;
}

export async function updateUserAccessRequest(
  userId: string,
  payload: { roles?: string[]; permissions?: string[] },
): Promise<{ message: string; user: IamUserItem }> {
  const response = await fetch(buildUrl(`/iam/users/${userId}/access`), {
    method: 'PATCH',
    headers: {
      Authorization: requireAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error('IAM_UPDATE_FAILED');
  }

  return response.json() as Promise<{ message: string; user: IamUserItem }>;
}

export async function listAuditLogsRequest(): Promise<AuditLogItem[]> {
  const response = await fetch(buildUrl('/system/audits'), {
    method: 'GET',
    headers: {
      Authorization: requireAuthHeader(),
    },
  });

  if (!response.ok) {
    throw new Error('AUDIT_LIST_FAILED');
  }

  return response.json() as Promise<AuditLogItem[]>;
}

export async function getPlatformConfigRequest(): Promise<PlatformConfigResponse> {
  const response = await fetch(buildUrl('/system/config'), {
    method: 'GET',
    headers: {
      Authorization: requireAuthHeader(),
    },
  });

  if (!response.ok) {
    throw new Error('CONFIG_READ_FAILED');
  }

  return response.json() as Promise<PlatformConfigResponse>;
}

export async function updatePlatformConfigRequest(payload: {
  taskQueuePersistenceEnabled?: boolean;
  taskQueueRunnerEnabled?: boolean;
  featureFlags?: Record<string, boolean>;
}): Promise<PlatformConfigResponse> {
  const response = await fetch(buildUrl('/system/config'), {
    method: 'PATCH',
    headers: {
      Authorization: requireAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error('CONFIG_UPDATE_FAILED');
  }

  return response.json() as Promise<PlatformConfigResponse>;
}

export async function listFeatureFlagsRequest(): Promise<Record<string, boolean>> {
  const response = await fetch(buildUrl('/system/features'), {
    method: 'GET',
    headers: {
      Authorization: requireAuthHeader(),
    },
  });

  if (!response.ok) {
    throw new Error('FEATURE_LIST_FAILED');
  }

  const result = (await response.json()) as { featureFlags: Record<string, boolean> };
  return result.featureFlags;
}

export async function updateFeatureFlagRequest(
  key: string,
  enabled: boolean,
): Promise<{ key: string; enabled: boolean }> {
  const response = await fetch(buildUrl(`/system/features/${encodeURIComponent(key)}`), {
    method: 'PUT',
    headers: {
      Authorization: requireAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ enabled }),
  });

  if (!response.ok) {
    throw new Error('FEATURE_UPDATE_FAILED');
  }

  return response.json() as Promise<{ key: string; enabled: boolean }>;
}

export async function createFeatureFlagRequest(
  key: string,
  enabled: boolean,
): Promise<{ key: string; enabled: boolean }> {
  const response = await fetch(buildUrl('/system/features'), {
    method: 'POST',
    headers: {
      Authorization: requireAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ key, enabled }),
  });

  if (!response.ok) {
    const err = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(err.message ?? 'FEATURE_CREATE_FAILED');
  }

  return response.json() as Promise<{ key: string; enabled: boolean }>;
}

export async function deleteFeatureFlagRequest(
  key: string,
): Promise<{ key: string; deleted: boolean }> {
  const response = await fetch(buildUrl(`/system/features/${encodeURIComponent(key)}`), {
    method: 'DELETE',
    headers: {
      Authorization: requireAuthHeader(),
    },
  });

  if (!response.ok) {
    throw new Error('FEATURE_DELETE_FAILED');
  }

  return response.json() as Promise<{ key: string; deleted: boolean }>;
}

export async function getTaskStatsRequest(): Promise<TaskStatsResponse> {
  const response = await fetch(buildUrl('/tasks/stats'), {
    method: 'GET',
    headers: {
      Authorization: requireAuthHeader(),
    },
  });

  if (!response.ok) {
    throw new Error('TASK_STATS_FAILED');
  }

  return response.json() as Promise<TaskStatsResponse>;
}

export async function getPlatformConfigRuntimeStatusRequest(): Promise<PlatformConfigRuntimeStatusResponse> {
  const response = await fetch(buildUrl('/system/config/runtime'), {
    method: 'GET',
    headers: {
      Authorization: requireAuthHeader(),
    },
  });

  if (!response.ok) {
    throw new Error('CONFIG_RUNTIME_READ_FAILED');
  }

  return response.json() as Promise<PlatformConfigRuntimeStatusResponse>;
}

export async function checkQueueStorageHealthRequest(): Promise<QueueStorageHealthResponse> {
  const response = await fetch(buildUrl('/system/config/runtime/health'), {
    method: 'GET',
    headers: {
      Authorization: requireAuthHeader(),
    },
  });

  if (!response.ok) {
    throw new Error('CONFIG_RUNTIME_HEALTH_FAILED');
  }

  return response.json() as Promise<QueueStorageHealthResponse>;
}

export async function listPluginsRequest(): Promise<PlatformPluginInfo[]> {
  const response = await fetch(buildUrl('/system/plugins'), {
    method: 'GET',
    headers: {
      Authorization: requireAuthHeader(),
    },
  });

  if (!response.ok) {
    throw new Error('PLUGINS_LIST_FAILED');
  }

  const result = (await response.json()) as { plugins: PlatformPluginInfo[] };
  return result.plugins;
}

export async function listNotificationsRequest(): Promise<PlatformNotificationEvent[]> {
  const response = await fetch(buildUrl('/system/notifications'), {
    method: 'GET',
    headers: {
      Authorization: requireAuthHeader(),
    },
  });

  if (!response.ok) {
    throw new Error('NOTIFICATIONS_LIST_FAILED');
  }

  const result = (await response.json()) as {
    notifications: PlatformNotificationEvent[];
  };

  return result.notifications;
}

export async function getEffectiveSettingsRequest(payload?: {
  tenantId?: string;
  userId?: string;
}): Promise<EffectiveSettingsResponse> {
  const query = new URLSearchParams({ scope: 'effective' });

  if (payload?.tenantId) {
    query.set('tenantId', payload.tenantId);
  }

  if (payload?.userId) {
    query.set('userId', payload.userId);
  }

  const response = await fetch(buildUrl(`/system/settings?${query.toString()}`), {
    method: 'GET',
    headers: {
      Authorization: requireAuthHeader(),
    },
  });

  if (!response.ok) {
    throw new Error('SETTINGS_EFFECTIVE_READ_FAILED');
  }

  return response.json() as Promise<EffectiveSettingsResponse>;
}

export async function listScopedSettingsRequest(payload: {
  scopeType: PlatformSettingScopeType;
  scopeId?: string;
  tenantId?: string;
  userId?: string;
}): Promise<PlatformSettingItem[]> {
  const query = new URLSearchParams({ scope: payload.scopeType });

  if (payload.scopeId) {
    query.set('scopeId', payload.scopeId);
  }

  if (payload.tenantId) {
    query.set('tenantId', payload.tenantId);
  }

  if (payload.userId) {
    query.set('userId', payload.userId);
  }

  const response = await fetch(buildUrl(`/system/settings?${query.toString()}`), {
    method: 'GET',
    headers: {
      Authorization: requireAuthHeader(),
    },
  });

  if (!response.ok) {
    throw new Error('SETTINGS_SCOPE_READ_FAILED');
  }

  return response.json() as Promise<PlatformSettingItem[]>;
}

export async function upsertScopedSettingRequest(
  key: string,
  payload: {
    scopeType: PlatformSettingScopeType;
    scopeId?: string;
    value: unknown;
  },
): Promise<PlatformSettingItem> {
  const response = await fetch(buildUrl(`/system/settings/${encodeURIComponent(key)}`), {
    method: 'PUT',
    headers: {
      Authorization: requireAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error('SETTINGS_UPSERT_FAILED');
  }

  return response.json() as Promise<PlatformSettingItem>;
}

export async function deleteScopedSettingRequest(
  key: string,
  payload: {
    scopeType: PlatformSettingScopeType;
    scopeId?: string;
  },
): Promise<{ key: string; scopeType: PlatformSettingScopeType; scopeId: string; deleted: boolean }> {
  const query = new URLSearchParams({ scopeType: payload.scopeType });

  if (payload.scopeId) {
    query.set('scopeId', payload.scopeId);
  }

  const response = await fetch(
    buildUrl(`/system/settings/${encodeURIComponent(key)}?${query.toString()}`),
    {
      method: 'DELETE',
      headers: {
        Authorization: requireAuthHeader(),
      },
    },
  );

  if (!response.ok) {
    throw new Error('SETTINGS_DELETE_FAILED');
  }

  return response.json() as Promise<{ key: string; scopeType: PlatformSettingScopeType; scopeId: string; deleted: boolean }>;
}

export function createNotificationsStream() {
  const token = getAccessToken();

  if (!token) {
    throw new Error('UNAUTHORIZED');
  }

  const url = new URL(buildUrl('/system/notifications/stream'), window.location.origin);
  url.searchParams.set('accessToken', token);

  return new EventSource(url.toString());
}

export interface SecurityPolicy {
  maxFailedAttempts: number;
  lockoutMinutes: number;
  minPasswordLength: number;
}

export async function getSecurityPolicyRequest(): Promise<SecurityPolicy> {
  const response = await fetch(buildUrl('/auth/security-policy'), {
    headers: { Authorization: requireAuthHeader() },
  });
  if (!response.ok) throw new Error('SECURITY_POLICY_READ_FAILED');
  return response.json() as Promise<SecurityPolicy>;
}

export async function updateSecurityPolicyRequest(patch: Partial<SecurityPolicy>): Promise<SecurityPolicy> {
  const response = await fetch(buildUrl('/auth/security-policy'), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: requireAuthHeader() },
    body: JSON.stringify(patch),
  });
  if (!response.ok) throw new Error('SECURITY_POLICY_UPDATE_FAILED');
  return response.json() as Promise<SecurityPolicy>;
}
