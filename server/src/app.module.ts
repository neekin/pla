import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { TasksModule } from './tasks/tasks.module';
import { SystemController } from './system/system.controller';
import { AccessGuard } from './auth/guards/access.guard';
import { TenantModule } from './tenant/tenant.module';
import { IamModule } from './iam/iam.module';
import { TenantContextMiddleware } from './tenant/tenant-context.middleware';
import { AuditLogService } from './system/audit-log.service';
import { AuditLogInterceptor } from './system/audit-log.interceptor';
import { PlatformConfigModule } from './platform-config/platform-config.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PluginsModule } from './plugins/plugins.module';
import { DatabaseModule } from './database/database.module';
import { BillingModule } from './billing/billing.module';
import { QuotaEnforcementMiddleware } from './billing/quota-enforcement.middleware';
import { EntityChangeLogEntity } from './database/entities/entity-change-log.entity';
import { EntityAuditService } from './system/entity-audit.service';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { MetricsService } from './system/metrics.service';
import { OrchestrationModule } from './orchestration/orchestration.module';
import { AbacPolicyService } from './common/authorization/abac-policy.service';
import { EntityAuditInterceptor } from './common/interceptors/entity-audit.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: true,
    }),
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
      signOptions: {
        expiresIn: '2h',
      },
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 120,
      },
    ]),
    TypeOrmModule.forRootAsync({
      inject: [],
      useFactory: () => {
        return {
          type: 'postgres' as const,
          host: process.env.DB_HOST ?? '127.0.0.1',
          port: Number(process.env.DB_PORT ?? 5432),
          username: process.env.DB_USERNAME ?? 'postgres',
          password: process.env.DB_PASSWORD ?? 'postgres',
          database: process.env.DB_NAME ?? 'gigpayday',
          synchronize: (process.env.DB_SYNCHRONIZE ?? 'true') === 'true',
          autoLoadEntities: true,
        };
      },
    }),
    TypeOrmModule.forFeature([EntityChangeLogEntity]),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'static'),
      exclude: [
        '/trpc',
        '/trpc/*path',
        '/auth',
        '/auth/*path',
        '/tasks',
        '/tasks/*path',
        '/system',
        '/system/*path',
        '/tenants',
        '/tenants/*path',
        '/iam',
        '/iam/*path',
        '/billing',
        '/billing/*path',
      ],
    }),
    AuthModule,
    TasksModule,
    TenantModule,
    IamModule,
    PlatformConfigModule,
    NotificationsModule,
    PluginsModule,
    OrchestrationModule,
    DatabaseModule,
    BillingModule,
  ],
  controllers: [SystemController],
  providers: [
    AuditLogService,
    EntityAuditService,
    MetricsService,
    AbacPolicyService,
    QuotaEnforcementMiddleware,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: AccessGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: EntityAuditInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLogInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
    consumer.apply(TenantContextMiddleware).forRoutes('*');
    consumer
      .apply(QuotaEnforcementMiddleware)
      .forRoutes({ path: 'tasks/dispatch', method: RequestMethod.POST });
  }
}
