import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantDomainEntity } from '../database/entities/tenant-domain.entity';
import { TenantEntity } from '../database/entities/tenant.entity';

export interface PlatformTenant {
  id: string;
  name: string;
  status: 'active' | 'inactive';
  edition: 'free' | 'pro' | 'enterprise';
}

export interface TenantDomain {
  tenantId: string;
  domain: string;
  verified: boolean;
  isPrimary: boolean;
  verificationToken: string;
  createdAt: string;
  verifiedAt: string | null;
}

type TenantResolutionSource = 'header' | 'domain' | 'subdomain' | 'fallback';

@Injectable()
export class TenantService {
  constructor(
    @InjectRepository(TenantEntity)
    private readonly tenantRepository: Repository<TenantEntity>,
    @InjectRepository(TenantDomainEntity)
    private readonly tenantDomainRepository: Repository<TenantDomainEntity>,
  ) {}

  async listTenants() {
    const tenants = await this.tenantRepository.find({ order: { id: 'ASC' } });

    return tenants.map((tenant) => ({
      id: tenant.id,
      name: tenant.name,
      status: tenant.status,
      edition: tenant.edition,
    }));
  }

  async resolveTenant(tenantId?: string) {
    const fallback = await this.tenantRepository.findOne({
      where: { id: 'host' },
    });

    if (!fallback) {
      throw new NotFoundException('Host 租户不存在');
    }

    if (!tenantId) {
      return fallback;
    }

    const tenant = await this.tenantRepository.findOne({
      where: { id: tenantId },
    });

    return tenant ?? fallback;
  }

  async resolveByRequest(input: {
    headerTenant?: string;
    forwardedHost?: string;
    host?: string;
  }) {
    const fromHeader = input.headerTenant?.trim().toLowerCase();

    if (fromHeader) {
      const resolved = await this.resolveTenant(fromHeader);

      return {
        tenantId: resolved.id,
        source: 'header' as TenantResolutionSource,
      };
    }

    const normalizedHost = this.normalizeHost(input.forwardedHost || input.host || '');
    const fromDomain = await this.resolveTenantIdByDomain(normalizedHost);

    if (fromDomain) {
      return {
        tenantId: fromDomain,
        source: 'domain' as TenantResolutionSource,
      };
    }

    const fromSubdomain = await this.resolveTenantIdBySubdomain(normalizedHost);

    if (fromSubdomain) {
      return {
        tenantId: fromSubdomain,
        source: 'subdomain' as TenantResolutionSource,
      };
    }

    return {
      tenantId: 'host',
      source: 'fallback' as TenantResolutionSource,
    };
  }

  async resolveByHost(host: string) {
    const normalizedHost = this.normalizeHost(host);
    const byDomain = await this.resolveTenantIdByDomain(normalizedHost);

    if (byDomain) {
      return {
        tenantId: byDomain,
        source: 'domain' as TenantResolutionSource,
      };
    }

    const bySubdomain = await this.resolveTenantIdBySubdomain(normalizedHost);

    if (bySubdomain) {
      return {
        tenantId: bySubdomain,
        source: 'subdomain' as TenantResolutionSource,
      };
    }

    return {
      tenantId: 'host',
      source: 'fallback' as TenantResolutionSource,
    };
  }

  async listTenantDomains(tenantId: string) {
    const resolvedTenant = await this.resolveTenant(tenantId);
    const domains = await this.tenantDomainRepository.find({
      where: { tenantId: resolvedTenant.id },
      order: { createdAt: 'DESC' },
    });

    return domains.map((item) => ({
      tenantId: item.tenantId,
      domain: item.domain,
      verified: item.verified,
      isPrimary: item.isPrimary,
      verificationToken: item.verificationToken,
      createdAt: item.createdAt.toISOString(),
      verifiedAt: item.verifiedAt ? item.verifiedAt.toISOString() : null,
    }));
  }

  async bindDomain(tenantId: string, domain: string) {
    const resolvedTenant = await this.resolveTenant(tenantId);
    const normalizedDomain = this.normalizeHost(domain);

    if (!normalizedDomain) {
      throw new BadRequestException('域名不能为空');
    }

    const domainTaken = await this.tenantDomainRepository.findOne({
      where: {
        domain: normalizedDomain,
      },
    });

    if (domainTaken && domainTaken.tenantId !== resolvedTenant.id) {
      throw new BadRequestException(`域名 ${normalizedDomain} 已绑定到其他租户`);
    }

    const exists = await this.tenantDomainRepository.findOne({
      where: {
        tenantId: resolvedTenant.id,
        domain: normalizedDomain,
      },
    });

    if (exists) {
      return {
        domain: {
          tenantId: exists.tenantId,
          domain: exists.domain,
          verified: exists.verified,
          isPrimary: exists.isPrimary,
          verificationToken: exists.verificationToken,
          createdAt: exists.createdAt.toISOString(),
          verifiedAt: exists.verifiedAt ? exists.verifiedAt.toISOString() : null,
        },
        verification: this.buildVerificationGuide({
          tenantId: exists.tenantId,
          domain: exists.domain,
          verified: exists.verified,
          isPrimary: exists.isPrimary,
          verificationToken: exists.verificationToken,
          createdAt: exists.createdAt.toISOString(),
          verifiedAt: exists.verifiedAt ? exists.verifiedAt.toISOString() : null,
        }),
      };
    }

    const toSave = this.tenantDomainRepository.create({
      tenantId: resolvedTenant.id,
      domain: normalizedDomain,
      verified: false,
      isPrimary: false,
      verificationToken: this.generateVerificationToken(normalizedDomain),
      createdAt: new Date(),
      verifiedAt: null,
    });
    const entity = await this.tenantDomainRepository.save(toSave);

    return {
      domain: {
        tenantId: entity.tenantId,
        domain: entity.domain,
        verified: entity.verified,
        isPrimary: entity.isPrimary,
        verificationToken: entity.verificationToken,
        createdAt: entity.createdAt.toISOString(),
        verifiedAt: entity.verifiedAt ? entity.verifiedAt.toISOString() : null,
      },
      verification: this.buildVerificationGuide({
        tenantId: entity.tenantId,
        domain: entity.domain,
        verified: entity.verified,
        isPrimary: entity.isPrimary,
        verificationToken: entity.verificationToken,
        createdAt: entity.createdAt.toISOString(),
        verifiedAt: entity.verifiedAt ? entity.verifiedAt.toISOString() : null,
      }),
    };
  }

  async verifyDomain(tenantId: string, domain: string, token: string) {
    const resolvedTenant = await this.resolveTenant(tenantId);
    const normalizedDomain = this.normalizeHost(domain);
    const normalizedToken = token.trim();
    const target = await this.tenantDomainRepository.findOne({
      where: {
        tenantId: resolvedTenant.id,
        domain: normalizedDomain,
      },
    });

    if (!target) {
      throw new NotFoundException('域名绑定记录不存在');
    }

    if (target.verificationToken !== normalizedToken) {
      throw new BadRequestException('域名验证 token 不匹配');
    }

    target.verified = true;
    target.verifiedAt = new Date();

    const hasPrimary = await this.tenantDomainRepository.exist({
      where: {
        tenantId: resolvedTenant.id,
        isPrimary: true,
      },
    });

    if (!hasPrimary) {
      target.isPrimary = true;
    }

    await this.tenantDomainRepository.save(target);

    return {
      message: '域名验证成功',
      domain: {
        tenantId: target.tenantId,
        domain: target.domain,
        verified: target.verified,
        isPrimary: target.isPrimary,
        verificationToken: target.verificationToken,
        createdAt: target.createdAt.toISOString(),
        verifiedAt: target.verifiedAt ? target.verifiedAt.toISOString() : null,
      },
    };
  }

  private async resolveTenantIdByDomain(host: string) {
    if (!host) {
      return null;
    }

    const match = await this.tenantDomainRepository.findOne({
      where: {
        verified: true,
        domain: host,
      },
    });

    return match?.tenantId ?? null;
  }

  private async resolveTenantIdBySubdomain(host: string) {
    if (!host || host === 'localhost') {
      return null;
    }

    const hostWithoutPort = host.split(':')[0];
    const parts = hostWithoutPort.split('.').filter(Boolean);

    if (parts.length < 3) {
      return null;
    }

    const subdomain = parts[0];
    const tenant = await this.tenantRepository.findOne({
      where: {
        id: subdomain,
      },
    });

    return tenant?.id ?? null;
  }

  private normalizeHost(value: string) {
    const host = value.split(',')[0]?.trim().toLowerCase() ?? '';
    return host.replace(/:\d+$/, '');
  }

  private generateVerificationToken(seed: string) {
    const random = Math.random().toString(16).slice(2, 10);
    return `gp_${seed.replace(/[^a-z0-9]/g, '').slice(0, 12)}_${random}`;
  }

  private buildVerificationGuide(domain: TenantDomain) {
    return {
      cnameTarget: process.env.PLATFORM_DOMAIN_CNAME_TARGET ?? 'tenant-gateway.gigpayday.local',
      txtName: `_gp-verify.${domain.domain}`,
      txtValue: domain.verificationToken,
    };
  }
}
