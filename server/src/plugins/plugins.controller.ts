import { Controller, Get } from '@nestjs/common';
import { Permissions } from '../common/decorators/permissions.decorator';
import { PluginsService } from './plugins.service';

@Controller('system/plugins')
export class PluginsController {
  constructor(private readonly pluginsService: PluginsService) {}

  @Permissions('system:read')
  @Get()
  list() {
    return {
      plugins: this.pluginsService.list(),
    };
  }

  @Permissions('system:read')
  @Get('compatibility')
  compatibility() {
    return this.pluginsService.compatibility();
  }

  @Permissions('system:read')
  @Get('marketplace')
  marketplace() {
    return this.pluginsService.marketplaceCatalog();
  }
}
