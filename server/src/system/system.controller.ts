import { Controller, Get, Req } from '@nestjs/common';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { RequestWithUser } from '../common/types/request-with-user.type';
import { AuditLogService } from './audit-log.service';

@Controller('system')
export class SystemController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Public()
  @Get('health')
  health() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'gigpayday-server',
      mode: 'starter-platform',
    };
  }

  @Permissions('system:read')
  @Get('me/permissions')
  myPermissions(@Req() request: RequestWithUser) {
    return {
      userId: request.user!.userId,
      username: request.user!.username,
      tenantId: request.user!.tenantId,
      roles: request.user!.roles,
      permissions: request.user!.permissions,
    };
  }

  @Permissions('audit:read')
  @Get('audits')
  audits() {
    return this.auditLogService.list();
  }
}
