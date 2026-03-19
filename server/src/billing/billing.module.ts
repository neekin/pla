import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BillingReconciliationEntity } from '../database/entities/billing-reconciliation.entity';
import { EditionEntity } from '../database/entities/edition.entity';
import { PlatformSettingEntity } from '../database/entities/platform-setting.entity';
import { SubscriptionEventEntity } from '../database/entities/subscription-event.entity';
import { TenantEntity } from '../database/entities/tenant.entity';
import { TenantSubscriptionEntity } from '../database/entities/tenant-subscription.entity';
import { UsageMeterEntity } from '../database/entities/usage-meter.entity';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BillingReconciliationEntity,
      EditionEntity,
      TenantSubscriptionEntity,
      SubscriptionEventEntity,
      TenantEntity,
      PlatformSettingEntity,
      UsageMeterEntity,
    ]),
  ],
  controllers: [BillingController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
