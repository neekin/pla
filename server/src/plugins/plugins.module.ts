import { Module } from '@nestjs/common';
import { PLATFORM_PLUGINS } from './plugin.constants';
import { OpsAuditPlugin } from './builtins/ops-audit.plugin';
import { PluginsController } from './plugins.controller';
import { PluginsService } from './plugins.service';

@Module({
  controllers: [PluginsController],
  providers: [
    OpsAuditPlugin,
    {
      provide: PLATFORM_PLUGINS,
      useFactory: (opsAuditPlugin: OpsAuditPlugin) => [opsAuditPlugin],
      inject: [OpsAuditPlugin],
    },
    PluginsService,
  ],
  exports: [PluginsService],
})
export class PluginsModule {}
