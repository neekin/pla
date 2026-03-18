import { Body, Controller, Get, Header, Put, Query, Req } from '@nestjs/common';
import { AbacPolicyService } from '../common/authorization/abac-policy.service';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { RequestWithUser } from '../common/types/request-with-user.type';
import { AuditLogService } from './audit-log.service';
import { ListEntityAuditsDto } from './dto/list-entity-audits.dto';
import { UpdateAbacPoliciesDto } from './dto/update-abac-policies.dto';
import { EntityAuditService } from './entity-audit.service';
import { MetricsService } from './metrics.service';
import { TasksService } from '../tasks/tasks.service';

@Controller('system')
export class SystemController {
  constructor(
    private readonly auditLogService: AuditLogService,
    private readonly entityAuditService: EntityAuditService,
    private readonly metricsService: MetricsService,
    private readonly tasksService: TasksService,
    private readonly abacPolicyService: AbacPolicyService,
  ) {}

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

  @Permissions('audit:read')
  @Get('entity-audits')
  entityAudits(@Query() query: ListEntityAuditsDto) {
    return this.entityAuditService.list(query);
  }

  @Permissions('config:read')
  @Get('abac/policies')
  abacPolicies() {
    return this.abacPolicyService.listPolicies();
  }

  @Permissions('config:write')
  @Put('abac/policies')
  updateAbacPolicies(
    @Body() dto: UpdateAbacPoliciesDto,
    @Req() request: RequestWithUser,
  ) {
    return this.abacPolicyService.updatePolicies({
      rules: dto.rules,
      actor: request.user?.username ?? request.user?.userId ?? 'system',
    });
  }

  /** Prometheus metrics — protected with system:read so not publicly scraped */
  @Permissions('system:read')
  @Get('metrics')
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async metrics() {
    // Update task queue gauges with live data before scraping
    const stats = await this.tasksService.stats();
    for (const [status, count] of Object.entries(stats)) {
      if (status !== 'total') {
        this.metricsService.setTaskQueueLength(status, count as number);
      }
    }
    return this.metricsService.getMetrics();
  }
}
