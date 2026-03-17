import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { RequestWithUser } from '../common/types/request-with-user.type';
import { BindTenantDomainDto } from './dto/bind-tenant-domain.dto';
import { ResolveTenantDto } from './dto/resolve-tenant.dto';
import { VerifyTenantDomainDto } from './dto/verify-tenant-domain.dto';
import { TenantService } from './tenant.service';

@Controller('tenants')
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Permissions('tenant:read')
  @Get()
  async list() {
    return this.tenantService.listTenants();
  }

  @Public()
  @Get('current')
  async current(@Req() request: RequestWithUser) {
    return {
      tenant: await this.tenantService.resolveTenant(request.tenantId),
      tenantId: request.tenantId,
    };
  }

  @Permissions('tenant:read')
  @Get('domains')
  async domains(@Query('tenantId') tenantId: string) {
    return {
      tenantId,
      domains: await this.tenantService.listTenantDomains(tenantId),
    };
  }

  @Permissions('domain:manage')
  @Post('domains/bind')
  async bindDomain(@Body() dto: BindTenantDomainDto) {
    return await this.tenantService.bindDomain(dto.tenantId, dto.domain);
  }

  @Permissions('domain:manage')
  @Post('domains/verify')
  async verifyDomain(@Body() dto: VerifyTenantDomainDto) {
    return await this.tenantService.verifyDomain(
      dto.tenantId,
      dto.domain,
      dto.token,
    );
  }

  @Public()
  @Get('resolve')
  async resolve(@Query() dto: ResolveTenantDto) {
    return await this.tenantService.resolveByHost(dto.host);
  }
}
