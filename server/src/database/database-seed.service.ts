import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthSecurityPolicyEntity } from './entities/auth-security-policy.entity';
import { EditionEntity } from './entities/edition.entity';
import { PlatformSettingEntity } from './entities/platform-setting.entity';
import { TenantDomainEntity } from './entities/tenant-domain.entity';
import { TenantEntity } from './entities/tenant.entity';
import { TenantSubscriptionEntity } from './entities/tenant-subscription.entity';
import { UserEntity } from './entities/user.entity';

@Injectable()
export class DatabaseSeedService implements OnModuleInit {
  constructor(
    @InjectRepository(TenantEntity)
    private readonly tenantRepository: Repository<TenantEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(TenantDomainEntity)
    private readonly tenantDomainRepository: Repository<TenantDomainEntity>,
    @InjectRepository(AuthSecurityPolicyEntity)
    private readonly authSecurityPolicyRepository: Repository<AuthSecurityPolicyEntity>,
    @InjectRepository(EditionEntity)
    private readonly editionRepository: Repository<EditionEntity>,
    @InjectRepository(TenantSubscriptionEntity)
    private readonly tenantSubscriptionRepository: Repository<TenantSubscriptionEntity>,
    @InjectRepository(PlatformSettingEntity)
    private readonly settingRepository: Repository<PlatformSettingEntity>,
  ) {}

  async onModuleInit() {
    await this.seedTenants();
    await this.seedUsers();
    await this.seedDomains();
    await this.seedAuthSecurityPolicy();
    await this.seedEditions();
    await this.seedTenantSubscriptions();
    await this.seedQuotaOverageStrategy();
  }

  private async seedTenants() {
    const tenants: TenantEntity[] = [
      {
        id: 'host',
        name: 'Host Tenant',
        status: 'active',
        edition: 'enterprise',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'acme',
        name: 'Acme Corp',
        status: 'active',
        edition: 'pro',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'demo',
        name: 'Demo Studio',
        status: 'active',
        edition: 'free',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    for (const tenant of tenants) {
      const exists = await this.tenantRepository.findOne({
        where: { id: tenant.id },
      });

      if (!exists) {
        await this.tenantRepository.save(tenant);
      }
    }
  }

  private async seedUsers() {
    const defaultPermissions = {
      admin: [
        'dashboard:view',
        'task:read',
        'task:dispatch',
        'system:read',
        'tenant:read',
        'iam:manage',
        'domain:manage',
        'audit:read',
        'config:read',
        'config:write',
      ],
      operator: [
        'dashboard:view',
        'task:read',
        'task:dispatch',
        'tenant:read',
        'domain:manage',
        'config:read',
      ],
      viewer: ['dashboard:view', 'task:read', 'tenant:read'],
    };

    const users: UserEntity[] = [
      {
        id: 'u-host-admin',
        tenantId: 'host',
        username: 'admin',
        password: '123456',
        roles: ['admin'],
        permissions: defaultPermissions.admin,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'u-host-operator',
        tenantId: 'host',
        username: 'operator',
        password: '123456',
        roles: ['operator'],
        permissions: defaultPermissions.operator,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'u-host-viewer',
        tenantId: 'host',
        username: 'viewer',
        password: '123456',
        roles: ['viewer'],
        permissions: defaultPermissions.viewer,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ].map((u) => ({
      ...u,
      lockedUntil: null,
      requiresPasswordReset: false,
      passwordResetAt: null,
    }));

    for (const user of users) {
      const exists = await this.userRepository.findOne({ where: { id: user.id } });

      if (!exists) {
        await this.userRepository.save(user);
        continue;
      }

      exists.tenantId = user.tenantId;
      exists.username = user.username;
      exists.password = user.password;
      exists.roles = user.roles;
      exists.permissions = user.permissions;
      exists.lockedUntil = null;
      exists.requiresPasswordReset = false;
      exists.passwordResetAt = null;
      exists.updatedAt = new Date();

      await this.userRepository.save(exists);
    }
  }

  private async seedDomains() {
    const localhost = await this.tenantDomainRepository.findOne({
      where: { domain: 'localhost' },
    });

    if (!localhost) {
      await this.tenantDomainRepository.save({
        tenantId: 'host',
        domain: 'localhost',
        verified: true,
        isPrimary: true,
        verificationToken: 'builtin-localhost',
        createdAt: new Date(),
        verifiedAt: new Date(),
      });
    }
  }

  private async seedAuthSecurityPolicy() {
    const existing = await this.authSecurityPolicyRepository.findOne({
      where: {
        scopeType: 'host',
        scopeId: 'host',
      },
    });

    if (!existing) {
      await this.authSecurityPolicyRepository.save(
        this.authSecurityPolicyRepository.create({
          scopeType: 'host',
          scopeId: 'host',
          maxFailedAttempts: 5,
          lockoutMinutes: 15,
          minPasswordLength: 6,
          requireUppercase: false,
          requireLowercase: false,
          requireNumbers: false,
          requireSymbols: false,
          forcePasswordResetOnFirstLogin: false,
          rejectWeakPasswordOnLogin: false,
          updatedBy: 'system-seed',
        }),
      );
    }
  }

  private async seedEditions() {
    const editions: EditionEntity[] = [
      {
        id: 'free',
        plan: 'free',
        name: 'Free',
        status: 'active',
        trialDays: 14,
        quota: {
          'task.dispatch': 2,
        },
        description: '适用于个人与演示环境',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'pro',
        plan: 'pro',
        name: 'Pro',
        status: 'active',
        trialDays: 14,
        quota: {
          'task.dispatch': 20,
        },
        description: '适用于中小团队生产环境',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'enterprise',
        plan: 'enterprise',
        name: 'Enterprise',
        status: 'active',
        trialDays: 0,
        quota: {
          'task.dispatch': -1,
        },
        description: '企业版，不限制任务派发额度',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    for (const edition of editions) {
      const exists = await this.editionRepository.findOne({ where: { id: edition.id } });

      if (!exists) {
        await this.editionRepository.save(edition);
      }
    }
  }

  private async seedTenantSubscriptions() {
    const tenants = await this.tenantRepository.find({
      order: {
        id: 'ASC',
      },
    });
    const editions = await this.editionRepository.find();

    if (editions.length === 0) {
      return;
    }

    const editionById = new Map(editions.map((item) => [item.id, item]));
    const editionByPlan = new Map(editions.map((item) => [item.plan, item]));
    const now = new Date();

    for (const tenant of tenants) {
      const existing = await this.tenantSubscriptionRepository.findOne({
        where: {
          tenantId: tenant.id,
        },
      });

      if (existing) {
        continue;
      }

      const edition =
        editionById.get(tenant.edition)
        ?? editionByPlan.get(tenant.edition)
        ?? editionById.get('free')
        ?? editions[0];

      const quota = {
        ...edition.quota,
      };

      if (quota['task.dispatch'] === undefined) {
        quota['task.dispatch'] = this.defaultTaskDispatchQuota(edition.plan);
      }

      const isTrialing = tenant.id !== 'host' && edition.trialDays > 0;
      const isExpiredDemoTrial = tenant.id === 'demo' && isTrialing;
      const trialStartAt = isTrialing
        ? this.addDays(now, -(isExpiredDemoTrial ? edition.trialDays + 1 : 1))
        : null;
      const trialEndAt = trialStartAt
        ? this.addDays(trialStartAt, edition.trialDays)
        : null;

      await this.tenantSubscriptionRepository.save(
        this.tenantSubscriptionRepository.create({
          tenantId: tenant.id,
          editionId: edition.id,
          plan: edition.plan,
          status: isTrialing ? 'trialing' : 'active',
          trialStartAt,
          trialEndAt,
          currentPeriodStartAt: isTrialing ? null : now,
          currentPeriodEndAt: isTrialing ? null : this.addMonths(now, 1),
          quota,
          usage: {},
          updatedBy: 'system-seed',
        }),
      );
    }
  }

  private async seedQuotaOverageStrategy() {
    const exists = await this.settingRepository.findOne({
      where: {
        scopeType: 'host',
        scopeId: 'host',
        key: 'quota.overageStrategy',
      },
    });

    if (!exists) {
      await this.settingRepository.save(
        this.settingRepository.create({
          scopeType: 'host',
          scopeId: 'host',
          key: 'quota.overageStrategy',
          value: 'reject',
          updatedBy: 'system-seed',
        }),
      );
    }
  }

  private defaultTaskDispatchQuota(plan: string) {
    if (plan === 'enterprise') {
      return -1;
    }

    if (plan === 'pro') {
      return 20;
    }

    return 2;
  }

  private addDays(base: Date, days: number) {
    const next = new Date(base);
    next.setDate(next.getDate() + days);
    return next;
  }

  private addMonths(base: Date, months: number) {
    const next = new Date(base);
    next.setMonth(next.getMonth() + months);
    return next;
  }
}
