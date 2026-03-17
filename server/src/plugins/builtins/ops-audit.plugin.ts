import { Injectable, Logger } from '@nestjs/common';
import {
  FeatureFlagChangedContext,
  PlatformPlugin,
  TaskCompletedContext,
  TaskDispatchedContext,
} from '../interfaces/platform-plugin.interface';

@Injectable()
export class OpsAuditPlugin implements PlatformPlugin {
  key = 'builtin.ops-audit';
  name = '内置运营审计插件';
  description = '监听任务和配置变更并输出审计日志（MVP）';
  version = '0.1.0';

  private readonly logger = new Logger(OpsAuditPlugin.name);

  onTaskDispatched(context: TaskDispatchedContext) {
    this.logger.log(
      `task dispatched: ${context.taskId} type=${context.taskType} by=${context.createdBy}`,
    );
  }

  onTaskCompleted(context: TaskCompletedContext) {
    this.logger.log(
      `task completed: ${context.taskId} type=${context.taskType} at=${context.completedAt}`,
    );
  }

  onFeatureFlagChanged(context: FeatureFlagChangedContext) {
    this.logger.log(`feature flag changed: ${context.key}=${context.enabled}`);
  }
}
