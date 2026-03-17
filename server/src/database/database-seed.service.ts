import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantDomainEntity } from './entities/tenant-domain.entity';
import { TenantEntity } from './entities/tenant.entity';
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
  ) {}

  async onModuleInit() {
    await this.seedTenants();
    await this.seedUsers();
    await this.seedDomains();
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
    ].map((u) => ({ ...u, lockedUntil: null, requiresPasswordReset: false }));

    for (const user of users) {
      const exists = await this.userRepository.findOne({ where: { id: user.id } });

      if (!exists) {
        await this.userRepository.save(user);
      }
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
}
