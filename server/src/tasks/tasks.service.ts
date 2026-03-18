import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LessThanOrEqual, Repository } from 'typeorm';
import { AuthUser } from '../auth/interfaces/auth-user.interface';
import { BillingService } from '../billing/billing.service';
import { TaskEntity } from '../database/entities/task.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { PlatformConfigService } from '../platform-config/platform-config.service';
import { PluginsService } from '../plugins/plugins.service';
import { DispatchTaskDto } from './dto/dispatch-task.dto';

type TaskStatus = 'queued' | 'running' | 'done';

export interface PlatformTask {
  id: string;
  taskType: string;
  payload: Record<string, unknown>;
  runAt: string;
  status: TaskStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(TaskEntity)
    private readonly taskRepository: Repository<TaskEntity>,
    private readonly billingService: BillingService,
    private readonly platformConfigService: PlatformConfigService,
    private readonly notificationsService: NotificationsService,
    private readonly pluginsService: PluginsService,
  ) {}

  async list() {
    const rows = await this.taskRepository.find({
      order: { createdAt: 'DESC' },
    });

    return rows.map((row) => this.toPlatformTask(row));
  }

  async stats() {
    const [queued, running, done, total] = await Promise.all([
      this.taskRepository.count({ where: { status: 'queued' } }),
      this.taskRepository.count({ where: { status: 'running' } }),
      this.taskRepository.count({ where: { status: 'done' } }),
      this.taskRepository.count(),
    ]);

    return { queued, running, done, total };
  }

  async dispatch(
    dto: DispatchTaskDto,
    actor: AuthUser,
    quotaContext?: {
      capabilityPoint: string;
      strategy: 'degrade';
      reason: string;
    },
  ) {
    if (!this.platformConfigService.isFeatureEnabled('tasks.dispatch.enabled', true)) {
      throw new ForbiddenException('任务派发功能已关闭');
    }

    const quotaUsage = await this.billingService.consumeQuota({
      tenantId: actor.tenantId,
      capabilityPoint: 'task.dispatch',
      amount: 1,
      actor: actor.username,
    });

    const isDegraded = quotaUsage.degraded || quotaContext?.strategy === 'degrade';
    const quotaReason = quotaContext?.reason ?? quotaUsage.reason;
    const now = new Date();
    const runAt = dto.runAt
      ? new Date(dto.runAt)
      : isDegraded
        ? new Date(now.getTime() + 10 * 60 * 1000)
        : now;
    const taskId = `task_${now.getTime()}_${Math.random().toString(16).slice(2, 8)}`;
    const payload = {
      ...(dto.payload ?? {}),
      ...(isDegraded
        ? {
            quotaDegraded: true,
            quotaReason: quotaReason ?? 'QUOTA_LIMIT_EXCEEDED',
          }
        : {}),
    };

    const task: PlatformTask = {
      id: taskId,
      taskType: dto.taskType,
      payload,
      runAt: runAt.toISOString(),
      status: 'queued',
      createdBy: actor.username,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    await this.taskRepository.save({
      id: task.id,
      tenantId: actor.tenantId,
      taskType: task.taskType,
      payload: task.payload,
      runAt: new Date(task.runAt),
      status: task.status,
      createdBy: task.createdBy,
      createdAt: new Date(task.createdAt),
      updatedAt: new Date(task.updatedAt),
    });

    this.pluginsService.emitTaskDispatched({
      taskId: task.id,
      taskType: task.taskType,
      createdBy: task.createdBy,
      runAt: task.runAt,
    });
    this.notificationsService.publish({
      type: 'task.dispatched',
      title: '任务入队',
      message: `${task.taskType} 已进入执行队列`,
      level: 'info',
      meta: {
        taskId: task.id,
      },
    });

    return {
      message: isDegraded ? '任务已入队（超限降级）' : '任务已入队',
      task,
      quota: {
        capabilityPoint: 'task.dispatch',
        degraded: isDegraded,
        reason: isDegraded ? (quotaReason ?? 'QUOTA_LIMIT_EXCEEDED') : null,
        limit: quotaUsage.limit,
        used: quotaUsage.used,
        usageRate: quotaUsage.usageRate,
      },
    };
  }

  async runNow(id: string) {
    if (!this.platformConfigService.isTaskQueueRunnerEnabled()) {
      throw new ForbiddenException('任务执行功能已关闭');
    }

    const task = await this.taskRepository.findOne({ where: { id } });

    if (!task) {
      throw new NotFoundException('任务不存在');
    }

    task.status = 'running';
    task.updatedAt = new Date();

    task.status = 'done';
    task.updatedAt = new Date();

    await this.taskRepository.save(task);

    this.pluginsService.emitTaskCompleted({
      taskId: task.id,
      taskType: task.taskType,
      status: 'done',
      completedAt: task.updatedAt.toISOString(),
    });
    this.notificationsService.publish({
      type: 'task.completed',
      title: '任务已完成',
      message: `${task.taskType} 已执行完成`,
      level: 'success',
      meta: {
        taskId: task.id,
      },
    });

    return {
      message: '任务已执行',
      task: this.toPlatformTask(task),
    };
  }

  @Cron(CronExpression.EVERY_30_SECONDS)
  async runDueTasks() {
    if (!this.platformConfigService.isTaskQueueRunnerEnabled()) {
      return;
    }

    const dueTasks = await this.taskRepository.find({
      where: {
        status: 'queued',
        runAt: LessThanOrEqual(new Date()),
      },
      order: {
        runAt: 'ASC',
      },
      take: 100,
    });

    for (const task of dueTasks) {
      task.status = 'running';
      task.updatedAt = new Date();

      task.status = 'done';
      task.updatedAt = new Date();

      await this.taskRepository.save(task);

      this.pluginsService.emitTaskCompleted({
        taskId: task.id,
        taskType: task.taskType,
        status: 'done',
        completedAt: task.updatedAt.toISOString(),
      });
      this.notificationsService.publish({
        type: 'task.completed',
        title: '任务自动完成',
        message: `${task.taskType} 已按计划执行`,
        level: 'success',
        meta: {
          taskId: task.id,
        },
      });
    }
  }

  private toPlatformTask(task: TaskEntity): PlatformTask {
    return {
      id: task.id,
      taskType: task.taskType,
      payload: task.payload,
      runAt: task.runAt.toISOString(),
      status: task.status,
      createdBy: task.createdBy,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    };
  }
}
