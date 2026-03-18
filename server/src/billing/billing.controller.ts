import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { Permissions } from '../common/decorators/permissions.decorator';
import type { RequestWithUser } from '../common/types/request-with-user.type';
import { AssignSubscriptionDto } from './dto/assign-subscription.dto';
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
  @Get('subscriptions/:tenantId')
  subscription(@Param('tenantId') tenantId: string) {
    return this.billingService.getTenantSubscription(tenantId);
  }
}
