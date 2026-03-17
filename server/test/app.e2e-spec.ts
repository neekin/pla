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
});
