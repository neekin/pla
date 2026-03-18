import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { Permissions } from '../common/decorators/permissions.decorator';
import type { RequestWithUser } from '../common/types/request-with-user.type';
import { DispatchTaskDto } from './dto/dispatch-task.dto';
import { TasksService } from './tasks.service';

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Permissions('task:read')
  @Get()
  list() {
    return this.tasksService.list();
  }

  @Permissions('task:read')
  @Get('stats')
  stats() {
    return this.tasksService.stats();
  }

  @Permissions('task:read')
  @Get('failed')
  failed() {
    return this.tasksService.listFailed();
  }

  @Permissions('task:read')
  @Get(':id/history')
  history(@Param('id') id: string) {
    return this.tasksService.history(id);
  }

  @Permissions('task:dispatch')
  @Post('dispatch')
  dispatch(@Body() dto: DispatchTaskDto, @Req() request: RequestWithUser) {
    return this.tasksService.dispatch(dto, request.user!, request.quotaContext);
  }

  @Permissions('task:dispatch')
  @Post(':id/run')
  runNow(@Param('id') id: string) {
    return this.tasksService.runNow(id);
  }

  @Permissions('task:dispatch')
  @Post(':id/retry')
  retry(@Param('id') id: string) {
    return this.tasksService.retry(id);
  }
}
