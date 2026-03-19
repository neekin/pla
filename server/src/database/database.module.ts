import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseSeedService } from './database-seed.service';
import { AuthLoginAttemptEntity } from './entities/auth-login-attempt.entity';
import { AuthRefreshTokenEntity } from './entities/auth-refresh-token.entity';
import { AuthSecurityPolicyEntity } from './entities/auth-security-policy.entity';
import { BillingReconciliationEntity } from './entities/billing-reconciliation.entity';
import { EditionEntity } from './entities/edition.entity';
import { EntityChangeLogEntity } from './entities/entity-change-log.entity';
import { PlatformSettingEntity } from './entities/platform-setting.entity';
import { SubscriptionEventEntity } from './entities/subscription-event.entity';
import { TaskEntity } from './entities/task.entity';
import { TenantDomainEntity } from './entities/tenant-domain.entity';
import { TenantEntity } from './entities/tenant.entity';
import { TenantSubscriptionEntity } from './entities/tenant-subscription.entity';
import { UsageMeterEntity } from './entities/usage-meter.entity';
import { UserEntity } from './entities/user.entity';
import { WorkflowRunEntity } from './entities/workflow-run.entity';
import { WorkflowStepRunEntity } from './entities/workflow-step-run.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TenantEntity,
      UserEntity,
      TenantDomainEntity,
      TaskEntity,
      PlatformSettingEntity,
      AuthLoginAttemptEntity,
      AuthRefreshTokenEntity,
      AuthSecurityPolicyEntity,
      BillingReconciliationEntity,
      EditionEntity,
      TenantSubscriptionEntity,
      SubscriptionEventEntity,
      UsageMeterEntity,
      EntityChangeLogEntity,
      WorkflowRunEntity,
      WorkflowStepRunEntity,
    ]),
  ],
  providers: [DatabaseSeedService],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
