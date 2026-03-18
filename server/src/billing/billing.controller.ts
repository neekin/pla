import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { Permissions } from '../common/decorators/permissions.decorator';
import { AbacPolicy } from '../common/decorators/abac-policy.decorator';
import type { RequestWithUser } from '../common/types/request-with-user.type';
import { AssignSubscriptionDto } from './dto/assign-subscription.dto';
import { ListUsageDto } from './dto/list-usage.dto';
import { ReportUsageDto } from './dto/report-usage.dto';
import { RenewSubscriptionDto } from './dto/renew-subscription.dto';
import { BillingService } from './billing.service';

@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Permissions('tenant:read')
  @Get('editions')
  editions() {
    return this.billingService.listEditions();
  }

  @Permissions('config:write')
  @Post('subscriptions/assign')
  assign(
    @Body() dto: AssignSubscriptionDto,
    @Req() request: RequestWithUser,
  ) {
    return this.billingService.assignSubscription(dto, request.user?.username ?? 'system');
  }

  @Permissions('config:write')
  @Post('subscriptions/renew')
  renew(
    @Body() dto: RenewSubscriptionDto,
    @Req() request: RequestWithUser,
  ) {
    return this.billingService.renewSubscription(dto, request.user?.username ?? 'system');
  }

  @Permissions('tenant:read')
  @AbacPolicy('tenant.self-scope')
  @Get('subscriptions/:tenantId')
  subscription(@Param('tenantId') tenantId: string) {
    return this.billingService.getTenantSubscription(tenantId);
  }

  @Permissions('config:write')
  @Post('usage/report')
  reportUsage(@Body() dto: ReportUsageDto, @Req() request: RequestWithUser) {
    return this.billingService.reportUsage(dto, request.user?.username ?? 'system');
  }

  @Permissions('tenant:read')
  @AbacPolicy('tenant.self-scope')
  @Get('usage/:tenantId')
  usage(
    @Param('tenantId') tenantId: string,
    @Query() query: ListUsageDto,
  ) {
    return this.billingService.listUsage(tenantId, query);
  }
}
