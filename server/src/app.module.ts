import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join, sep } from 'path';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
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
    TypeOrmModule.forRootAsync({
      inject: [],
      useFactory: () => {
        const dbType = (process.env.DB_TYPE ?? 'postgres').toLowerCase();

        if (dbType === 'postgres') {
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
        }

        const sqliteDatabasePath =
          process.env.DB_SQLITE_PATH ??
          (process.cwd().endsWith(`${sep}server`)
            ? join(process.cwd(), 'data', 'gigpayday.sqlite')
            : join(process.cwd(), 'server', 'data', 'gigpayday.sqlite'));

        return {
          type: 'sqljs' as const,
          autoSave: true,
          location: sqliteDatabasePath,
          synchronize: (process.env.DB_SYNCHRONIZE ?? 'true') === 'true',
          autoLoadEntities: true,
        };
      },
    }),
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
      ],
    }),
    AuthModule,
    TasksModule,
    TenantModule,
    IamModule,
    PlatformConfigModule,
    NotificationsModule,
    PluginsModule,
    DatabaseModule,
  ],
  controllers: [SystemController],
  providers: [
    AuditLogService,
    {
      provide: APP_GUARD,
      useClass: AccessGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLogInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantContextMiddleware).forRoutes('*');
  }
}
