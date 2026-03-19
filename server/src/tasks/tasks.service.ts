import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { In, LessThanOrEqual, Repository } from 'typeorm';
import { AuthUser } from '../auth/interfaces/auth-user.interface';
import { BillingService } from '../billing/billing.service';
import { TaskEntity } from '../database/entities/task.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { EventBusService } from '../orchestration/event-bus.service';
import { PlatformConfigService } from '../platform-config/platform-config.service';
import { PluginsService } from '../plugins/plugins.service';
import { MetricsService } from '../system/metrics.service';
import { OpsAlertService } from '../system/ops-alert.service';
import { DispatchTaskDto } from './dto/dispatch-task.dto';

type TaskStatus = 'queued' | 'running' | 'done' | 'failed' | 'retrying';

export interface PlatformTask {
  id: string;
  taskType: string;
  payload: Record<string, unknown>;
  runAt: string;
  status: TaskStatus;
  retryCount: number;
  maxRetry: number;
  retryStrategy: 'fixed' | 'exponential';
  retryBaseDelayMs: number;
  lastError: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskHistoryItem {
  id: string;
  type: string;
  source: string;
  createdAt: string;
  payload: Record<string, unknown>;
}

const DEFAULT_RETRY_DELAY_MS = 30_000;
const MAX_RETRY_DELAY_MS = 30 * 60 * 1000;

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(TaskEntity)
    private readonly taskRepository: Repository<TaskEntity>,
    private readonly billingService: BillingService,
    private readonly platformConfigService: PlatformConfigService,
    private readonly notificationsService: NotificationsService,
    private readonly pluginsService: PluginsService,
    private readonly eventBus: EventBusService,
    private readonly metricsService: MetricsService,
    private readonly opsAlertService: OpsAlertService,
  ) {}

  async list() {
    const rows = await this.taskRepository.find({
      order: { createdAt: 'DESC' },
    });

    return rows.map((row) => this.toPlatformTask(row));
  }

  async stats() {
    const [queued, running, done, failed, retrying, total] = await Promise.all([
      this.taskRepository.count({ where: { status: 'queued' } }),
      this.taskRepository.count({ where: { status: 'running' } }),
      this.taskRepository.count({ where: { status: 'done' } }),
      this.taskRepository.count({ where: { status: 'failed' } }),
      this.taskRepository.count({ where: { status: 'retrying' } }),
      this.taskRepository.count(),
    ]);

    return { queued, running, done, failed, retrying, total };
  }

  async listFailed() {
    const rows = await this.taskRepository.find({
      where: {
        status: 'failed',
      },
      order: {
        updatedAt: 'DESC',
      },
      take: 100,
    });

    return rows.map((row) => this.toPlatformTask(row));
  }

  async history(taskId: string): Promise<TaskHistoryItem[]> {
    const task = await this.taskRepository.findOne({ where: { id: taskId } });

    if (!task) {
      throw new NotFoundException('任务不存在');
    }

    const events = this.eventBus
      .listRecent(500)
      .filter((event) => {
        const payloadTaskId = (event.payload as Record<string, unknown> | undefined)?.taskId;
        return payloadTaskId === taskId;
      })
      .map((event) => ({
        id: event.id,
        type: event.type,
        source: event.source,
        createdAt: event.createdAt,
        payload: event.payload,
      }));

    return events;
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
      retryCount: 0,
      maxRetry: dto.maxRetry ?? 3,
      retryStrategy: dto.retryStrategy ?? 'fixed',
      retryBaseDelayMs: dto.retryBaseDelayMs ?? DEFAULT_RETRY_DELAY_MS,
      lastError: null,
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
      retryCount: task.retryCount,
      maxRetry: task.maxRetry,
      retryStrategy: task.retryStrategy,
      retryBaseDelayMs: task.retryBaseDelayMs,
      lastError: task.lastError,
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
    await this.eventBus.publish({
      type: 'task.dispatched',
      source: 'tasks-service',
      payload: {
        taskId: task.id,
        taskType: task.taskType,
        tenantId: actor.tenantId,
        createdBy: actor.username,
      },
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

    await this.executeTask(task, {
      source: 'manual-run',
      forceRun: true,
    });

    return {
      message: '任务已执行',
      task: this.toPlatformTask(
        await this.taskRepository.findOneOrFail({ where: { id: task.id } }),
      ),
    };
  }

  async retry(id: string) {
    const task = await this.taskRepository.findOne({ where: { id } });

    if (!task) {
      throw new NotFoundException('任务不存在');
    }

    if (task.status !== 'failed') {
      throw new BadRequestException('仅失败任务可重试');
    }

    task.status = 'queued';
    task.lastError = null;
    task.runAt = new Date();
    task.updatedAt = new Date();

    await this.taskRepository.save(task);

    await this.eventBus.publish({
      type: 'task.retry.scheduled',
      source: 'tasks-service',
      payload: {
        taskId: task.id,
        taskType: task.taskType,
      },
    });

    this.notificationsService.publish({
      type: 'task.retry.scheduled',
      title: '任务已重试',
      message: `${task.taskType} 已加入重试队列`,
      level: 'info',
      meta: {
        taskId: task.id,
      },
    });

    return {
      message: '失败任务已加入重试队列',
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
        status: In(['queued', 'retrying']),
        runAt: LessThanOrEqual(new Date()),
      },
      order: {
        runAt: 'ASC',
      },
      take: 100,
    });

    for (const task of dueTasks) {
      await this.executeTask(task, { source: 'schedule-run' });
    }
  }

  private async executeTask(
    task: TaskEntity,
    options: { source: 'manual-run' | 'schedule-run'; forceRun?: boolean },
  ) {
    if (!options.forceRun && task.status === 'failed') {
      return;
    }

    task.status = 'running';
    task.updatedAt = new Date();
    await this.taskRepository.save(task);

    try {
      const shouldFail = Boolean((task.payload as Record<string, unknown>)?.forceFail);

      if (shouldFail) {
        throw new Error('TASK_FORCE_FAIL');
      }

      task.status = 'done';
      task.lastError = null;
      task.updatedAt = new Date();

      await this.taskRepository.save(task);
      this.metricsService.recordTaskExecution(true);

      this.pluginsService.emitTaskCompleted({
        taskId: task.id,
        taskType: task.taskType,
        status: 'done',
        completedAt: task.updatedAt.toISOString(),
      });
      await this.eventBus.publish({
        type: 'task.completed',
        source: 'tasks-service',
        payload: {
          taskId: task.id,
          taskType: task.taskType,
          status: 'done',
        },
      });
      this.notificationsService.publish({
        type: 'task.completed',
        title: options.source === 'manual-run' ? '任务已完成' : '任务自动完成',
        message: `${task.taskType} 已执行完成`,
        level: 'success',
        meta: {
          taskId: task.id,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'TASK_EXECUTION_FAILED';
      this.metricsService.recordTaskExecution(false);
      task.retryCount += 1;
      task.lastError = message;
      task.updatedAt = new Date();

      if (task.retryCount < task.maxRetry) {
        task.status = 'retrying';
        task.runAt = new Date(Date.now() + this.computeRetryDelayMs(task));
        await this.taskRepository.save(task);

        await this.eventBus.publish({
          type: 'task.retrying',
          source: 'tasks-service',
          payload: {
            taskId: task.id,
            taskType: task.taskType,
            retryCount: task.retryCount,
          },
        });

        this.notificationsService.publish({
          type: 'task.retrying',
          title: '任务重试中',
          message: `${task.taskType} 执行失败，准备第 ${task.retryCount} 次重试`,
          level: 'warning',
          meta: {
            taskId: task.id,
            lastError: task.lastError,
          },
        });
        return;
      }

      task.status = 'failed';
      await this.taskRepository.save(task);
      this.metricsService.incTaskFailure();

      this.opsAlertService.raiseAlert({
        alertName: 'GigpaydayTaskFailuresGrowing',
        severity: 'warning',
        source: 'tasks-service',
        summary: '任务失败并达到最大重试次数',
        description: `任务 ${task.id}（${task.taskType}）执行失败，已达到最大重试次数 ${task.maxRetry}。`,
        runbookId: 'task-failure-growth',
        context: {
          taskId: task.id,
          taskType: task.taskType,
          retryCount: task.retryCount,
          maxRetry: task.maxRetry,
          lastError: task.lastError,
        },
      });

      await this.eventBus.publish({
        type: 'task.failed',
        source: 'tasks-service',
        payload: {
          taskId: task.id,
          taskType: task.taskType,
          retryCount: task.retryCount,
          lastError: task.lastError,
        },
      });

      this.notificationsService.publish({
        type: 'task.failed',
        title: '任务失败',
        message: `${task.taskType} 已失败并达到最大重试次数`,
        level: 'error',
        meta: {
          taskId: task.id,
          lastError: task.lastError,
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
      retryCount: task.retryCount,
      maxRetry: task.maxRetry,
      retryStrategy: task.retryStrategy,
      retryBaseDelayMs: task.retryBaseDelayMs,
      lastError: task.lastError,
      createdBy: task.createdBy,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    };
  }

  private computeRetryDelayMs(task: TaskEntity) {
    const base = Math.max(1000, task.retryBaseDelayMs || DEFAULT_RETRY_DELAY_MS);

    if (task.retryStrategy === 'exponential') {
      const delay = base * Math.pow(2, Math.max(0, task.retryCount - 1));
      return Math.min(MAX_RETRY_DELAY_MS, delay);
    }

    return Math.min(MAX_RETRY_DELAY_MS, base);
  }
}
