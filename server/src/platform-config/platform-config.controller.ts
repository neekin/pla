import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { Permissions } from '../common/decorators/permissions.decorator';
import type { RequestWithUser } from '../common/types/request-with-user.type';
import { CreateFeatureFlagDto } from './dto/create-feature-flag.dto';
import { ListPlatformSettingsDto } from './dto/list-platform-settings.dto';
import { RemovePlatformSettingDto } from './dto/remove-platform-setting.dto';
import { UpdateFeatureFlagDto } from './dto/update-feature-flag.dto';
import { UpdatePlatformConfigDto } from './dto/update-platform-config.dto';
import { UpsertPlatformSettingDto } from './dto/upsert-platform-setting.dto';
import { PlatformConfigService } from './platform-config.service';

@Controller('system')
export class PlatformConfigController {
  constructor(private readonly platformConfigService: PlatformConfigService) {}

  @Permissions('config:read')
  @Get('config')
  getConfig() {
    return this.platformConfigService.getConfig();
  }

  @Permissions('config:write')
  @Patch('config')
  updateConfig(@Body() dto: UpdatePlatformConfigDto) {
    return this.platformConfigService.updateConfig(dto);
  }

  @Permissions('config:read')
  @Get('features')
  listFeatures() {
    return {
      featureFlags: this.platformConfigService.getFeatureFlags(),
    };
  }

  @Permissions('config:read')
  @Get('config/runtime')
  getRuntimeStatus() {
    return this.platformConfigService.getRuntimeStatus();
  }

  @Permissions('config:read')
  @Get('config/runtime/health')
  checkRuntimeHealth() {
    return this.platformConfigService.probeQueueStorageHealth();
  }

  @Permissions('config:write')
  @Post('features')
  createFeatureFlag(@Body() dto: CreateFeatureFlagDto) {
    return this.platformConfigService.createFeatureFlag(dto.key, dto.enabled);
  }

  @Permissions('config:write')
  @Put('features/:key')
  updateFeatureFlag(
    @Param('key') key: string,
    @Body() dto: UpdateFeatureFlagDto,
  ) {
    return this.platformConfigService.setFeatureFlag(key, dto.enabled);
  }

  @Permissions('config:write')
  @Delete('features/:key')
  deleteFeatureFlag(@Param('key') key: string) {
    return this.platformConfigService.deleteFeatureFlag(key);
  }

  @Permissions('config:read')
  @Get('settings')
  listSettings(
    @Query() query: ListPlatformSettingsDto,
    @Req() request: RequestWithUser,
  ) {
    const scope = query.scope ?? 'effective';

    if (scope === 'effective') {
      return this.platformConfigService.getEffectiveSettings({
        tenantId: query.tenantId ?? request.user?.tenantId ?? request.tenantId,
        userId: query.userId ?? request.user?.userId,
      });
    }

    const scopeType = scope;
    const scopeId =
      query.scopeId ??
      (scopeType === 'host'
        ? 'host'
        : scopeType === 'tenant'
          ? query.tenantId ?? request.user?.tenantId ?? request.tenantId
          : query.userId ?? request.user?.userId);

    if (!scopeId) {
      throw new BadRequestException('scopeId 不能为空');
    }

    return this.platformConfigService.listSettingsByScope(scopeType, scopeId);
  }

  @Permissions('config:write')
  @Put('settings/:key')
  upsertSetting(
    @Param('key') key: string,
    @Body() dto: UpsertPlatformSettingDto,
    @Req() request: RequestWithUser,
  ) {
    return this.platformConfigService.upsertSetting({
      key,
      value: dto.value,
      scopeType: dto.scopeType,
      scopeId: dto.scopeId,
      actor: request.user,
    });
  }

  @Permissions('config:write')
  @Delete('settings/:key')
  deleteSetting(
    @Param('key') key: string,
    @Query() query: RemovePlatformSettingDto,
    @Req() request: RequestWithUser,
  ) {
    return this.platformConfigService.removeSetting({
      key,
      scopeType: query.scopeType,
      scopeId: query.scopeId,
      actor: request.user,
    });
  }
}
