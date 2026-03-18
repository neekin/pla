import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';

describe('Platform APIs (e2e)', () => {
  let app: INestApplication;
  let accessToken = '';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .set('x-tenant-id', 'host')
      .send({
        username: 'admin',
        password: '123456',
      })
      .expect(201);

    accessToken = loginResponse.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /system/health should be public', () => {
    return request(app.getHttpServer())
      .get('/system/health')
      .expect(200);
  });

  it('should echo x-request-id for traceability', async () => {
    const requestId = `e2e-${Date.now()}`;

    const response = await request(app.getHttpServer())
      .get('/system/health')
      .set('x-request-id', requestId)
      .expect(200);

    expect(response.headers['x-request-id']).toBe(requestId);
  });

  it('GET /tasks/stats should work with auth', async () => {
    const response = await request(app.getHttpServer())
      .get('/tasks/stats')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', 'host')
      .expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        queued: expect.any(Number),
        running: expect.any(Number),
        done: expect.any(Number),
        total: expect.any(Number),
      }),
    );
  });

  it('GET /system/plugins should return plugin list', async () => {
    const response = await request(app.getHttpServer())
      .get('/system/plugins')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', 'host')
      .expect(200);

    expect(response.body.plugins).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'builtin.ops-audit',
        }),
      ]),
    );
  });

  it('POST/DELETE /system/features should support CRUD lifecycle', async () => {
    const key = `e2e.feature.${Date.now()}`;

    const createResponse = await request(app.getHttpServer())
      .post('/system/features')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', 'host')
      .send({ key, enabled: true })
      .expect(201);

    expect(createResponse.body).toEqual(
      expect.objectContaining({
        key,
        enabled: true,
      }),
    );

    const deleteResponse = await request(app.getHttpServer())
      .delete(`/system/features/${encodeURIComponent(key)}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', 'host')
      .expect(200);

    expect(deleteResponse.body).toEqual(
      expect.objectContaining({
        key,
        deleted: true,
      }),
    );
  });

  it('GET/DELETE /auth/sessions should list and revoke current user sessions', async () => {
    const userAgent = `e2e-session-agent-${Date.now()}`;

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .set('x-tenant-id', 'host')
      .set('user-agent', userAgent)
      .send({
        username: 'admin',
        password: '123456',
      })
      .expect(201);

    const sessionAccessToken = loginResponse.body.accessToken as string;
    const sessionRefreshToken = loginResponse.body.refreshToken as string;

    const sessionsResponse = await request(app.getHttpServer())
      .get('/auth/sessions')
      .set('Authorization', `Bearer ${sessionAccessToken}`)
      .set('x-tenant-id', 'host')
      .expect(200);

    const targetSession = (
      sessionsResponse.body as Array<{ id: string; userAgent: string | null; status: string }>
    ).find((item) => item.userAgent === userAgent && item.status === 'active');

    expect(targetSession).toBeDefined();

    await request(app.getHttpServer())
      .delete(`/auth/sessions/${targetSession!.id}`)
      .set('Authorization', `Bearer ${sessionAccessToken}`)
      .set('x-tenant-id', 'host')
      .expect(200);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('x-tenant-id', 'host')
      .send({
        refreshToken: sessionRefreshToken,
      })
      .expect(401);
  });

  it('GET/PUT /system/abac/policies should update policy and take effect immediately', async () => {
    const readResponse = await request(app.getHttpServer())
      .get('/system/abac/policies')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', 'host')
      .expect(200);

    const originalRules = readResponse.body.rules as Array<{
      key: string;
      enabled: boolean;
      allowedRoles?: string[];
      requireTenantMatch?: boolean;
      resourceTenantPath?: string;
      maskedFields?: string[];
    }>;

    const updatedRules = originalRules.map((rule) =>
      rule.key === 'tenant.self-scope'
        ? {
            ...rule,
            allowedRoles: ['viewer'],
          }
        : rule,
    );

    await request(app.getHttpServer())
      .put('/system/abac/policies')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', 'host')
      .send({ rules: updatedRules })
      .expect(200);

    await request(app.getHttpServer())
      .get('/billing/subscriptions/acme')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', 'host')
      .expect(403);

    await request(app.getHttpServer())
      .put('/system/abac/policies')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', 'host')
      .send({ rules: originalRules })
      .expect(200);

    await request(app.getHttpServer())
      .get('/billing/subscriptions/acme')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', 'host')
      .expect(200);
  });

  it('POST /tenants/domains/bind + verify + GET /tenants/resolve should resolve tenant by custom domain', async () => {
    const uniqueDomain = `acme-${Date.now()}.example.com`;

    const bindResponse = await request(app.getHttpServer())
      .post('/tenants/domains/bind')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', 'host')
      .send({
        tenantId: 'acme',
        domain: uniqueDomain,
      })
      .expect(201);

    expect(bindResponse.body).toEqual(
      expect.objectContaining({
        domain: expect.objectContaining({
          tenantId: 'acme',
          domain: uniqueDomain,
        }),
      }),
    );

    const token = bindResponse.body.verification.txtValue as string;

    await request(app.getHttpServer())
      .post('/tenants/domains/verify')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', 'host')
      .send({
        tenantId: 'acme',
        domain: uniqueDomain,
        token,
      })
      .expect(201);

    const resolveResponse = await request(app.getHttpServer())
      .get('/tenants/resolve')
      .query({
        host: uniqueDomain,
      })
      .expect(200);

    expect(resolveResponse.body).toEqual(
      expect.objectContaining({
        tenantId: 'acme',
        source: 'domain',
      }),
    );
  });

  it('PATCH /auth/security-policy + POST /auth/password-reset should enforce and clear requiresPasswordReset', async () => {
    await request(app.getHttpServer())
      .patch('/auth/security-policy')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', 'host')
      .send({
        minPasswordLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSymbols: true,
      })
      .expect(200);

    const weakLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .set('x-tenant-id', 'host')
      .send({
        username: 'admin',
        password: '123456',
      })
      .expect(201);

    expect(weakLogin.body.user).toEqual(
      expect.objectContaining({
        username: 'admin',
        requiresPasswordReset: true,
      }),
    );

    await request(app.getHttpServer())
      .post('/auth/password-reset')
      .set('Authorization', `Bearer ${weakLogin.body.accessToken as string}`)
      .set('x-tenant-id', 'host')
      .send({
        newPassword: 'Admin123!Reset',
      })
      .expect(201);

    const strongLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .set('x-tenant-id', 'host')
      .send({
        username: 'admin',
        password: 'Admin123!Reset',
      })
      .expect(201);

    expect(strongLogin.body.user).toEqual(
      expect.objectContaining({
        username: 'admin',
        requiresPasswordReset: false,
      }),
    );

    await request(app.getHttpServer())
      .patch('/auth/security-policy')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', 'host')
      .send({
        maxFailedAttempts: 5,
        lockoutMinutes: 15,
        minPasswordLength: 6,
        requireUppercase: false,
        requireLowercase: false,
        requireNumbers: false,
        requireSymbols: false,
        forcePasswordResetOnFirstLogin: false,
        rejectWeakPasswordOnLogin: false,
      })
      .expect(200);

    await request(app.getHttpServer())
      .post('/auth/password-reset/self-service')
      .set('x-tenant-id', 'host')
      .send({
        username: 'admin',
        currentPassword: 'Admin123!Reset',
        newPassword: '123456',
      })
      .expect(201);
  });

  it('security policy toggles should support first-login reset and weak-password rejection', async () => {
    await request(app.getHttpServer())
      .patch('/iam/users/u-host-viewer/access')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', 'host')
      .send({
        roles: ['viewer'],
        permissions: ['dashboard:view', 'task:read', 'tenant:read', 'audit:read'],
      })
      .expect(200);

    await request(app.getHttpServer())
      .patch('/auth/security-policy')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', 'host')
      .send({
        maxFailedAttempts: 5,
        lockoutMinutes: 15,
        minPasswordLength: 6,
        requireUppercase: false,
        requireLowercase: false,
        requireNumbers: false,
        requireSymbols: false,
        forcePasswordResetOnFirstLogin: true,
        rejectWeakPasswordOnLogin: false,
      })
      .expect(200);

    const firstLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .set('x-tenant-id', 'host')
      .send({
        username: 'viewer',
        password: '123456',
      })
      .expect(201);

    expect(firstLogin.body.user).toEqual(
      expect.objectContaining({
        username: 'viewer',
        requiresPasswordReset: true,
      }),
    );

    await request(app.getHttpServer())
      .post('/auth/password-reset/self-service')
      .set('x-tenant-id', 'host')
      .send({
        username: 'viewer',
        currentPassword: '123456',
        newPassword: 'Viewer123!',
      })
      .expect(201);

    const postResetLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .set('x-tenant-id', 'host')
      .send({
        username: 'viewer',
        password: 'Viewer123!',
      })
      .expect(201);

    expect(postResetLogin.body.user).toEqual(
      expect.objectContaining({
        username: 'viewer',
        requiresPasswordReset: false,
      }),
    );

    await request(app.getHttpServer())
      .patch('/auth/security-policy')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', 'host')
      .send({
        minPasswordLength: 20,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSymbols: true,
        forcePasswordResetOnFirstLogin: false,
        rejectWeakPasswordOnLogin: true,
      })
      .expect(200);

    const weakRejected = await request(app.getHttpServer())
      .post('/auth/login')
      .set('x-tenant-id', 'host')
      .send({
        username: 'viewer',
        password: 'Viewer123!',
      })
      .expect(401);

    expect(weakRejected.body).toEqual(
      expect.objectContaining({
        message: 'WEAK_PASSWORD_RESET_REQUIRED',
      }),
    );

    await request(app.getHttpServer())
      .post('/auth/password-reset/self-service')
      .set('x-tenant-id', 'host')
      .send({
        username: 'viewer',
        currentPassword: 'Viewer123!',
        newPassword: 'Viewer123!Strong#2026',
      })
      .expect(201);

    await request(app.getHttpServer())
      .patch('/auth/security-policy')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', 'host')
      .send({
        maxFailedAttempts: 5,
        lockoutMinutes: 15,
        minPasswordLength: 6,
        requireUppercase: false,
        requireLowercase: false,
        requireNumbers: false,
        requireSymbols: false,
        forcePasswordResetOnFirstLogin: false,
        rejectWeakPasswordOnLogin: false,
      })
      .expect(200);

    await request(app.getHttpServer())
      .post('/auth/password-reset/self-service')
      .set('x-tenant-id', 'host')
      .send({
        username: 'viewer',
        currentPassword: 'Viewer123!Strong#2026',
        newPassword: '123456',
      })
      .expect(201);
  });

  it('entity audit API should return field-level diff for user access update', async () => {
    await request(app.getHttpServer())
      .patch('/iam/users/u-host-viewer/access')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', 'host')
      .send({
        roles: ['viewer'],
        permissions: ['dashboard:view', 'task:read', 'tenant:read', 'audit:read'],
      })
      .expect(200);

    const auditsResponse = await request(app.getHttpServer())
      .get('/system/entity-audits')
      .query({ entityName: 'UserEntity', action: 'update' })
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', 'host')
      .expect(200);

    const target = (auditsResponse.body as Array<{ entityId: string; changes?: Record<string, unknown> }>).find(
      (item) => item.entityId === 'u-host-viewer',
    );

    expect(target).toBeDefined();
    expect(target?.changes).toEqual(
      expect.objectContaining({
        permissions: expect.objectContaining({
          before: expect.any(Array),
          after: expect.any(Array),
        }),
      }),
    );
  });

  it('billing APIs should support edition listing, assignment, renewal and trial expiry sync', async () => {
    const editionsResponse = await request(app.getHttpServer())
      .get('/billing/editions')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', 'host')
      .expect(200);

    const plans = (editionsResponse.body as Array<{ plan: string }>).map((item) => item.plan);
    expect(plans).toEqual(expect.arrayContaining(['free', 'pro', 'enterprise']));

    const demoSubscription = await request(app.getHttpServer())
      .get('/billing/subscriptions/demo')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', 'host')
      .expect(200);

    expect(demoSubscription.body).toEqual(
      expect.objectContaining({
        tenantId: 'demo',
        status: 'expired',
      }),
    );

    const assignResponse = await request(app.getHttpServer())
      .post('/billing/subscriptions/assign')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', 'host')
      .send({
        tenantId: 'acme',
        editionId: 'pro',
        trialDays: 0,
        quotaTaskDispatchMonthly: 2,
      })
      .expect(201);

    expect(assignResponse.body.subscription).toEqual(
      expect.objectContaining({
        tenantId: 'acme',
        status: 'active',
      }),
    );

    const previousEndAt = assignResponse.body.subscription.currentPeriodEndAt as string;

    const renewResponse = await request(app.getHttpServer())
      .post('/billing/subscriptions/renew')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', 'host')
      .send({
        tenantId: 'acme',
        months: 2,
      })
      .expect(201);

    expect(renewResponse.body.subscription).toEqual(
      expect.objectContaining({
        tenantId: 'acme',
        status: 'active',
      }),
    );

    expect(new Date(renewResponse.body.subscription.currentPeriodEndAt).getTime()).toBeGreaterThan(
      new Date(previousEndAt).getTime(),
    );
  });

  it('quota enforcement should reject or degrade over-limit requests and record audit reason', async () => {
    await request(app.getHttpServer())
      .put('/system/settings/quota.overageStrategy')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', 'host')
      .send({
        scopeType: 'host',
        scopeId: 'host',
        value: 'reject',
      })
      .expect(200);

    await request(app.getHttpServer())
      .post('/billing/subscriptions/assign')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', 'host')
      .send({
        tenantId: 'host',
        editionId: 'free',
        trialDays: 0,
        quotaTaskDispatchMonthly: 1,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/tasks/dispatch')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', 'host')
      .send({ taskType: 'sync-report', payload: { scope: 'quota-reject' } })
      .expect(201);

    const rejectedResponse = await request(app.getHttpServer())
      .post('/tasks/dispatch')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', 'host')
      .send({ taskType: 'sync-report', payload: { scope: 'quota-reject-2' } })
      .expect(429);

    expect(rejectedResponse.body).toEqual(
      expect.objectContaining({
        message: expect.stringContaining('QUOTA_LIMIT_EXCEEDED'),
      }),
    );

    await request(app.getHttpServer())
      .put('/system/settings/quota.overageStrategy')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', 'host')
      .send({
        scopeType: 'host',
        scopeId: 'host',
        value: 'degrade',
      })
      .expect(200);

    await request(app.getHttpServer())
      .post('/billing/subscriptions/renew')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', 'host')
      .send({
        tenantId: 'host',
        months: 1,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/tasks/dispatch')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', 'host')
      .send({ taskType: 'sync-report', payload: { scope: 'quota-degrade' } })
      .expect(201);

    const degradedResponse = await request(app.getHttpServer())
      .post('/tasks/dispatch')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', 'host')
      .send({ taskType: 'sync-report', payload: { scope: 'quota-degrade-2' } })
      .expect(201);

    expect(degradedResponse.headers['x-quota-overage']).toBe('degrade');
    expect(degradedResponse.body).toEqual(
      expect.objectContaining({
        message: expect.stringContaining('超限降级'),
        quota: expect.objectContaining({
          degraded: true,
        }),
      }),
    );

    const auditsResponse = await request(app.getHttpServer())
      .get('/system/audits')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', 'host')
      .expect(200);

    const overageAudit = (auditsResponse.body as Array<{ path: string; reason?: string }>).find(
      (record) =>
        record.path.includes('/tasks/dispatch')
        && typeof record.reason === 'string'
        && record.reason.includes('QUOTA_LIMIT_EXCEEDED'),
    );

    expect(overageAudit).toBeDefined();

    await request(app.getHttpServer())
      .put('/system/settings/quota.overageStrategy')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', 'host')
      .send({
        scopeType: 'host',
        scopeId: 'host',
        value: 'reject',
      })
      .expect(200);
  });

  it('tasks should support failed list and manual retry flow', async () => {
    await request(app.getHttpServer())
      .post('/billing/subscriptions/assign')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', 'host')
      .send({
        tenantId: 'host',
        editionId: 'pro',
        trialDays: 0,
        quotaTaskDispatchMonthly: 50,
      })
      .expect(201);

    const dispatchResponse = await request(app.getHttpServer())
      .post('/tasks/dispatch')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', 'host')
      .send({
        taskType: 'sync-report',
        payload: { scope: 'week3-retry', forceFail: true },
        maxRetry: 2,
      })
      .expect(201);

    const taskId = dispatchResponse.body.task.id as string;

    const firstRun = await request(app.getHttpServer())
      .post(`/tasks/${encodeURIComponent(taskId)}/run`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', 'host')
      .expect(201);

    expect(firstRun.body.task).toEqual(
      expect.objectContaining({
        id: taskId,
        status: 'retrying',
        retryCount: 1,
      }),
    );

    const secondRun = await request(app.getHttpServer())
      .post(`/tasks/${encodeURIComponent(taskId)}/run`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', 'host')
      .expect(201);

    expect(secondRun.body.task).toEqual(
      expect.objectContaining({
        id: taskId,
        status: 'failed',
        retryCount: 2,
        lastError: 'TASK_FORCE_FAIL',
      }),
    );

    const failedResponse = await request(app.getHttpServer())
      .get('/tasks/failed')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', 'host')
      .expect(200);

    expect(failedResponse.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: taskId,
          status: 'failed',
          lastError: 'TASK_FORCE_FAIL',
        }),
      ]),
    );

    const retryResponse = await request(app.getHttpServer())
      .post(`/tasks/${encodeURIComponent(taskId)}/retry`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', 'host')
      .expect(201);

    expect(retryResponse.body.task).toEqual(
      expect.objectContaining({
        id: taskId,
        status: 'queued',
      }),
    );

    const historyResponse = await request(app.getHttpServer())
      .get(`/tasks/${encodeURIComponent(taskId)}/history`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', 'host')
      .expect(200);

    expect(historyResponse.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'task.dispatched',
        }),
      ]),
    );
  });

  it('tasks should persist retry strategy template fields', async () => {
    const dispatchResponse = await request(app.getHttpServer())
      .post('/tasks/dispatch')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', 'host')
      .send({
        taskType: 'sync-report',
        payload: { scope: 'week5-retry-template' },
        maxRetry: 4,
        retryStrategy: 'exponential',
        retryBaseDelayMs: 5000,
      })
      .expect(201);

    expect(dispatchResponse.body.task).toEqual(
      expect.objectContaining({
        maxRetry: 4,
        retryStrategy: 'exponential',
        retryBaseDelayMs: 5000,
      }),
    );
  });

  it('workflow runs should be persisted and queryable', async () => {
    const runResponse = await request(app.getHttpServer())
      .post('/system/workflows/run')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', 'host')
      .send({
        workflowKey: 'tenant.onboarding.v1',
        payload: {
          tenantId: 'acme',
          forceFailStep: 'tenant.bootstrap',
        },
      })
      .expect(201);

    expect(runResponse.body).toEqual(
      expect.objectContaining({
        workflowKey: 'tenant.onboarding.v1',
        status: 'failed',
      }),
    );

    const runsResponse = await request(app.getHttpServer())
      .get('/system/workflows/runs')
      .query({ limit: 20 })
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', 'host')
      .expect(200);

    const target = (runsResponse.body as Array<{ runId: string; stepRuns: Array<{ stepKey: string }> }>).find(
      (item) => item.runId === runResponse.body.runId,
    );

    expect(target).toBeDefined();
    expect(target?.stepRuns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ stepKey: 'tenant.validate' }),
        expect.objectContaining({ stepKey: 'tenant.bootstrap' }),
        expect.objectContaining({ stepKey: 'tenant.validate.compensation' }),
      ]),
    );
  });

  it('usage metering should report, accumulate and query by tenant', async () => {
    // ensure a subscription exists so quota tracking works
    await request(app.getHttpServer())
      .post('/billing/subscriptions/assign')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', 'host')
      .send({
        tenantId: 'acme',
        editionId: 'pro',
        trialDays: 0,
        quotaTaskDispatchMonthly: 100,
      })
      .expect(201);

    const cap = `e2e.meter.${Date.now()}`;

    // report first usage
    const report1 = await request(app.getHttpServer())
      .post('/billing/usage/report')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', 'host')
      .send({
        tenantId: 'acme',
        capabilityPoint: cap,
        amount: 5,
      })
      .expect(201);

    expect(report1.body).toEqual(
      expect.objectContaining({
        message: expect.any(String),
        usage: expect.objectContaining({
          tenantId: 'acme',
          capabilityPoint: cap,
          totalUsed: 5,
        }),
      }),
    );

    // report additional usage – should accumulate
    const report2 = await request(app.getHttpServer())
      .post('/billing/usage/report')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', 'host')
      .send({
        tenantId: 'acme',
        capabilityPoint: cap,
        amount: 3,
      })
      .expect(201);

    expect(report2.body.usage.totalUsed).toBe(8);

    // query usage for tenant
    const listResponse = await request(app.getHttpServer())
      .get('/billing/usage/acme')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', 'host')
      .expect(200);

    expect(listResponse.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tenantId: 'acme',
          capabilityPoint: cap,
          totalUsed: 8,
        }),
      ]),
    );
  });
});
