import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseSeedService } from './database-seed.service';
import { AuthLoginAttemptEntity } from './entities/auth-login-attempt.entity';
import { PlatformSettingEntity } from './entities/platform-setting.entity';
import { TaskEntity } from './entities/task.entity';
import { TenantDomainEntity } from './entities/tenant-domain.entity';
import { TenantEntity } from './entities/tenant.entity';
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
    ]),
  ],
  providers: [DatabaseSeedService],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
