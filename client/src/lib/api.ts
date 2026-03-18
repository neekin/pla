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
  refreshToken: string;
  refreshExpiresInSeconds: number;
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
  status: 'queued' | 'running' | 'done' | 'failed' | 'retrying';
  retryCount: number;
  maxRetry: number;
  retryStrategy: 'fixed' | 'exponential';
  retryBaseDelayMs: number;
  lastError: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskHistoryItem {
  id: string;
  type: string;
  source: string;
  createdAt: string;
  payload: Record<string, unknown>;
}

export interface DispatchTaskPayload {
  taskType: string;
  payload?: Record<string, unknown>;
  runAt?: string;
  maxRetry?: number;
  retryStrategy?: 'fixed' | 'exponential';
  retryBaseDelayMs?: number;
}

export interface DispatchTaskResponse {
  message: string;
  task: TaskItem;
  quota?: {
    capabilityPoint: string;
    degraded: boolean;
    reason: string | null;
    limit: number;
    used: number;
    usageRate: number;
  };
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
  reason?: string;
}

export interface EntityAuditItem {
  id: string;
  entityName: string;
  entityId: string;
  action: 'create' | 'update' | 'delete';
  changes: Record<string, { before: unknown; after: unknown }>;
  tenantId: string;
  actorUserId: string | null;
  actorUsername: string | null;
  createdAt: string;
}

export interface WorkflowRunItem {
  runId: string;
  workflowKey: string;
  status: 'running' | 'done' | 'failed';
  payload: Record<string, unknown>;
  stepRuns: Array<{
    stepKey: string;
    status: 'done' | 'failed' | 'compensated';
    attempts: number;
    errorMessage: string | null;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface BillingEditionItem {
  id: string;
  plan: string;
  name: string;
  status: 'active' | 'inactive';
  trialDays: number;
  quota: Record<string, number>;
  description: string | null;
  updatedAt: string;
}

export interface TenantSubscriptionQuota {
  capabilityPoint: string;
  limit: number;
  used: number;
  usageRate: number;
  exceeded: boolean;
  unlimited: boolean;
}

export interface TenantSubscriptionItem {
  tenantId: string;
  editionId: string;
  plan: string;
  editionName: string;
  status: 'trialing' | 'active' | 'expired';
  trialStartAt: string | null;
  trialEndAt: string | null;
  currentPeriodStartAt: string | null;
  currentPeriodEndAt: string | null;
  overageStrategy: 'reject' | 'degrade';
  quota: TenantSubscriptionQuota;
  updatedAt: string;
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
  failed: number;
  retrying: number;
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

export async function dispatchTaskRequest(payload: DispatchTaskPayload): Promise<DispatchTaskResponse> {
  const response = await fetch(buildUrl('/tasks/dispatch'), {
    method: 'POST',
    headers: {
      Authorization: requireAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = (await response.json().catch(() => ({}))) as {
      message?: string | string[];
    };
    const normalizedMessage = Array.isArray(err.message) ? err.message[0] : err.message;
    throw new Error(normalizedMessage ?? 'TASK_DISPATCH_FAILED');
  }

  const result = (await response.json()) as DispatchTaskResponse;

  if (response.headers.get('x-quota-overage') === 'degrade') {
    return {
      ...result,
      quota: {
        capabilityPoint: result.quota?.capabilityPoint ?? 'task.dispatch',
        degraded: true,
        reason: result.quota?.reason ?? 'QUOTA_LIMIT_EXCEEDED',
        limit: result.quota?.limit ?? 0,
        used: result.quota?.used ?? 0,
        usageRate: result.quota?.usageRate ?? 100,
      },
    };
  }

  return result;
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

export async function listFailedTasksRequest(): Promise<TaskItem[]> {
  const response = await fetch(buildUrl('/tasks/failed'), {
    method: 'GET',
    headers: {
      Authorization: requireAuthHeader(),
    },
  });

  if (!response.ok) {
    throw new Error('TASK_FAILED_LIST_FAILED');
  }

  return response.json() as Promise<TaskItem[]>;
}

export async function retryTaskRequest(taskId: string): Promise<{ message: string; task: TaskItem }> {
  const response = await fetch(buildUrl(`/tasks/${taskId}/retry`), {
    method: 'POST',
    headers: {
      Authorization: requireAuthHeader(),
    },
  });

  if (!response.ok) {
    throw new Error('TASK_RETRY_FAILED');
  }

  return response.json() as Promise<{ message: string; task: TaskItem }>;
}

export async function listTaskHistoryRequest(taskId: string): Promise<TaskHistoryItem[]> {
  const response = await fetch(buildUrl(`/tasks/${taskId}/history`), {
    method: 'GET',
    headers: {
      Authorization: requireAuthHeader(),
    },
  });

  if (!response.ok) {
    throw new Error('TASK_HISTORY_LIST_FAILED');
  }

  return response.json() as Promise<TaskHistoryItem[]>;
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

export async function listBillingEditionsRequest(): Promise<BillingEditionItem[]> {
  const response = await fetch(buildUrl('/billing/editions'), {
    method: 'GET',
    headers: {
      Authorization: requireAuthHeader(),
    },
  });

  if (!response.ok) {
    throw new Error('BILLING_EDITIONS_FAILED');
  }

  return response.json() as Promise<BillingEditionItem[]>;
}

export async function assignTenantSubscriptionRequest(payload: {
  tenantId: string;
  editionId: string;
  trialDays?: number;
  quotaTaskDispatchMonthly?: number;
}): Promise<{ message: string; subscription: TenantSubscriptionItem }> {
  const response = await fetch(buildUrl('/billing/subscriptions/assign'), {
    method: 'POST',
    headers: {
      Authorization: requireAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error('BILLING_ASSIGN_FAILED');
  }

  return response.json() as Promise<{ message: string; subscription: TenantSubscriptionItem }>;
}

export async function renewTenantSubscriptionRequest(payload: {
  tenantId: string;
  months?: number;
}): Promise<{ message: string; subscription: TenantSubscriptionItem }> {
  const response = await fetch(buildUrl('/billing/subscriptions/renew'), {
    method: 'POST',
    headers: {
      Authorization: requireAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error('BILLING_RENEW_FAILED');
  }

  return response.json() as Promise<{ message: string; subscription: TenantSubscriptionItem }>;
}

export async function getTenantSubscriptionRequest(
  tenantId: string,
): Promise<TenantSubscriptionItem> {
  const response = await fetch(buildUrl(`/billing/subscriptions/${encodeURIComponent(tenantId)}`), {
    method: 'GET',
    headers: {
      Authorization: requireAuthHeader(),
    },
  });

  if (!response.ok) {
    throw new Error('BILLING_SUBSCRIPTION_FAILED');
  }

  return response.json() as Promise<TenantSubscriptionItem>;
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

export async function listEntityAuditsRequest(payload?: {
  entityName?: string;
  actorUsername?: string;
  action?: 'create' | 'update' | 'delete';
  from?: string;
  to?: string;
}): Promise<EntityAuditItem[]> {
  const query = new URLSearchParams();

  if (payload?.entityName) query.set('entityName', payload.entityName);
  if (payload?.actorUsername) query.set('actorUsername', payload.actorUsername);
  if (payload?.action) query.set('action', payload.action);
  if (payload?.from) query.set('from', payload.from);
  if (payload?.to) query.set('to', payload.to);

  const suffix = query.toString() ? `?${query.toString()}` : '';

  const response = await fetch(buildUrl(`/system/entity-audits${suffix}`), {
    method: 'GET',
    headers: {
      Authorization: requireAuthHeader(),
    },
  });

  if (!response.ok) {
    throw new Error('ENTITY_AUDIT_LIST_FAILED');
  }

  return response.json() as Promise<EntityAuditItem[]>;
}

export async function listWorkflowRunsRequest(limit = 50): Promise<WorkflowRunItem[]> {
  const response = await fetch(buildUrl(`/system/workflows/runs?limit=${encodeURIComponent(String(limit))}`), {
    method: 'GET',
    headers: {
      Authorization: requireAuthHeader(),
    },
  });

  if (!response.ok) {
    throw new Error('WORKFLOW_RUNS_LIST_FAILED');
  }

  return response.json() as Promise<WorkflowRunItem[]>;
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
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSymbols: boolean;
  forcePasswordResetOnFirstLogin: boolean;
  rejectWeakPasswordOnLogin: boolean;
}

export interface AuthSessionItem {
  id: string;
  userId: string;
  tenantId: string;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  createdByIp: string | null;
  userAgent: string | null;
  status: 'active' | 'expired' | 'revoked';
}

export interface AbacPolicyRule {
  key: string;
  enabled: boolean;
  allowedRoles?: string[];
  requireTenantMatch?: boolean;
  resourceTenantPath?: string;
  maskedFields?: string[];
}

export interface AbacPoliciesResponse {
  version: string;
  updatedAt: string;
  updatedBy: string;
  rules: AbacPolicyRule[];
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

export async function listAuthSessionsRequest(): Promise<AuthSessionItem[]> {
  const response = await fetch(buildUrl('/auth/sessions'), {
    method: 'GET',
    headers: { Authorization: requireAuthHeader() },
  });

  if (!response.ok) {
    throw new Error('AUTH_SESSION_LIST_FAILED');
  }

  return response.json() as Promise<AuthSessionItem[]>;
}

export async function revokeAuthSessionRequest(sessionId: string): Promise<{
  message: string;
  sessionId: string;
  revokedAt: string | null;
}> {
  const response = await fetch(buildUrl(`/auth/sessions/${encodeURIComponent(sessionId)}`), {
    method: 'DELETE',
    headers: { Authorization: requireAuthHeader() },
  });

  if (!response.ok) {
    throw new Error('AUTH_SESSION_REVOKE_FAILED');
  }

  return response.json() as Promise<{ message: string; sessionId: string; revokedAt: string | null }>;
}

export async function getAbacPoliciesRequest(): Promise<AbacPoliciesResponse> {
  const response = await fetch(buildUrl('/system/abac/policies'), {
    method: 'GET',
    headers: { Authorization: requireAuthHeader() },
  });

  if (!response.ok) {
    throw new Error('ABAC_POLICIES_READ_FAILED');
  }

  return response.json() as Promise<AbacPoliciesResponse>;
}

export async function updateAbacPoliciesRequest(payload: {
  rules: AbacPolicyRule[];
}): Promise<AbacPoliciesResponse> {
  const response = await fetch(buildUrl('/system/abac/policies'), {
    method: 'PUT',
    headers: {
      Authorization: requireAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error('ABAC_POLICIES_UPDATE_FAILED');
  }

  return response.json() as Promise<AbacPoliciesResponse>;
}

export interface UsageMeterItem {
  id: string;
  tenantId: string;
  capabilityPoint: string;
  totalUsed: number;
  periodStart: string;
  periodEnd: string;
  updatedBy: string;
  updatedAt: string;
}

export interface SystemHealthResponse {
  status: 'ok' | 'degraded' | 'down';
  timestamp: string;
  service: string;
  mode: string;
}

export async function reportUsageRequest(payload: {
  tenantId: string;
  capabilityPoint: string;
  amount: number;
}): Promise<{ message: string; meter: UsageMeterItem }> {
  const response = await fetch(buildUrl('/billing/usage/report'), {
    method: 'POST',
    headers: {
      Authorization: requireAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error('USAGE_REPORT_FAILED');
  }

  return response.json() as Promise<{ message: string; meter: UsageMeterItem }>;
}

export async function listUsageRequest(
  tenantId: string,
  query?: { from?: string; to?: string; capabilityPoint?: string },
): Promise<UsageMeterItem[]> {
  const params = new URLSearchParams();
  if (query?.from) params.set('from', query.from);
  if (query?.to) params.set('to', query.to);
  if (query?.capabilityPoint) params.set('capabilityPoint', query.capabilityPoint);

  const suffix = params.toString() ? `?${params.toString()}` : '';

  const response = await fetch(buildUrl(`/billing/usage/${encodeURIComponent(tenantId)}${suffix}`), {
    method: 'GET',
    headers: {
      Authorization: requireAuthHeader(),
    },
  });

  if (!response.ok) {
    throw new Error('USAGE_LIST_FAILED');
  }

  return response.json() as Promise<UsageMeterItem[]>;
}

export async function getSystemHealthRequest(): Promise<SystemHealthResponse> {
  const response = await fetch(buildUrl('/system/health'));
  if (!response.ok) throw new Error('HEALTH_CHECK_FAILED');
  return response.json() as Promise<SystemHealthResponse>;
}
