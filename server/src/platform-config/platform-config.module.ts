import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlatformSettingEntity } from '../database/entities/platform-setting.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { PluginsModule } from '../plugins/plugins.module';
import { PlatformConfigController } from './platform-config.controller';
import { PlatformConfigService } from './platform-config.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PlatformSettingEntity]),
    NotificationsModule,
    PluginsModule,
  ],
  controllers: [PlatformConfigController],
  providers: [PlatformConfigService],
  exports: [PlatformConfigService],
})
export class PlatformConfigModule {}
