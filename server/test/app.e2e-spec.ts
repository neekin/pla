import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { existsSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { AppModule } from './../src/app.module';

describe('Platform APIs (e2e)', () => {
  let app: INestApplication;
  let accessToken = '';
  let dbFilePath = '';

  beforeAll(async () => {
    dbFilePath = join(tmpdir(), `gigpayday.e2e.${process.pid}.${Date.now()}.sqlite`);
    process.env.DB_SQLITE_PATH = dbFilePath;

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

    if (dbFilePath && existsSync(dbFilePath)) {
      unlinkSync(dbFilePath);
    }
  });

  it('GET /system/health should be public', () => {
    return request(app.getHttpServer())
      .get('/system/health')
      .expect(200);
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
        username: 'operator',
        password: '123456',
      })
      .expect(201);

    expect(firstLogin.body.user).toEqual(
      expect.objectContaining({
        username: 'operator',
        requiresPasswordReset: true,
      }),
    );

    await request(app.getHttpServer())
      .post('/auth/password-reset/self-service')
      .set('x-tenant-id', 'host')
      .send({
        username: 'operator',
        currentPassword: '123456',
        newPassword: 'Operator123!',
      })
      .expect(201);

    const postResetLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .set('x-tenant-id', 'host')
      .send({
        username: 'operator',
        password: 'Operator123!',
      })
      .expect(201);

    expect(postResetLogin.body.user).toEqual(
      expect.objectContaining({
        username: 'operator',
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
        username: 'operator',
        password: 'Operator123!',
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
        username: 'operator',
        currentPassword: 'Operator123!',
        newPassword: 'Operator123!Strong#2026',
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
        username: 'operator',
        currentPassword: 'Operator123!Strong#2026',
        newPassword: '123456',
      })
      .expect(201);
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
});
