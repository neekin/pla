import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BillingModule } from '../billing/billing.module';
import { TaskEntity } from '../database/entities/task.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { OrchestrationModule } from '../orchestration/orchestration.module';
import { PluginsModule } from '../plugins/plugins.module';
import { PlatformConfigModule } from '../platform-config/platform-config.module';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([TaskEntity]),
    BillingModule,
    PlatformConfigModule,
    NotificationsModule,
    PluginsModule,
    OrchestrationModule,
  ],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
