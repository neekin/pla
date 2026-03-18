import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseSeedService } from './database-seed.service';
import { AuthLoginAttemptEntity } from './entities/auth-login-attempt.entity';
import { AuthSecurityPolicyEntity } from './entities/auth-security-policy.entity';
import { EditionEntity } from './entities/edition.entity';
import { PlatformSettingEntity } from './entities/platform-setting.entity';
import { SubscriptionEventEntity } from './entities/subscription-event.entity';
import { TaskEntity } from './entities/task.entity';
import { TenantDomainEntity } from './entities/tenant-domain.entity';
import { TenantEntity } from './entities/tenant.entity';
import { TenantSubscriptionEntity } from './entities/tenant-subscription.entity';
import { UserEntity } from './entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TenantEntity,
      UserEntity,
      TenantDomainEntity,
      TaskEntity,
      PlatformSettingEntity,
      AuthLoginAttemptEntity,
      AuthSecurityPolicyEntity,
      EditionEntity,
      TenantSubscriptionEntity,
      SubscriptionEventEntity,
    ]),
  ],
  providers: [DatabaseSeedService],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
