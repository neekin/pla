import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import { Permissions } from '../common/decorators/permissions.decorator';
import type { RequestWithUser } from '../common/types/request-with-user.type';
import { RunWorkflowDto } from './dto/run-workflow.dto';
import { EventBusService } from './event-bus.service';
import { WorkflowService } from './workflow.service';

@Controller('system/workflows')
export class WorkflowController {
  constructor(
    private readonly workflowService: WorkflowService,
    private readonly eventBus: EventBusService,
  ) {}

  @Permissions('system:read')
  @Get('templates')
  templates() {
    return this.workflowService.listTemplates();
  }

  @Permissions('system:read')
  @Get('runs')
  runs(@Query('limit') limitRaw?: string) {
    const limit = Number(limitRaw ?? 50);
    return this.workflowService.listRuns(limit);
  }

  @Permissions('system:read')
  @Get('events')
  events(@Query('limit') limitRaw?: string) {
    const limit = Number(limitRaw ?? 100);
    return this.eventBus.listRecent(limit);
  }

  @Permissions('task:dispatch')
  @Post('run')
  async run(
    @Body() dto: RunWorkflowDto,
    @Req() request: RequestWithUser,
  ) {
    return this.workflowService.runWorkflow({
      workflowKey: dto.workflowKey,
      payload: dto.payload,
      triggerBy: request.user?.username ?? 'system',
    });
  }
}
