export interface TaskDispatchedContext {
  taskId: string;
  taskType: string;
  createdBy: string;
  runAt: string;
}

export interface TaskCompletedContext {
  taskId: string;
  taskType: string;
  status: 'done';
  completedAt: string;
}

export interface FeatureFlagChangedContext {
  key: string;
  enabled: boolean;
}

export interface ConfigUpdatedContext {
  updatedAt: string;
}

export interface PlatformPlugin {
  key: string;
  name: string;
  description?: string;
  version?: string;
  onSystemBoot?(context: { timestamp: string }): void | Promise<void>;
  onTaskDispatched?(context: TaskDispatchedContext): void | Promise<void>;
  onTaskCompleted?(context: TaskCompletedContext): void | Promise<void>;
  onFeatureFlagChanged?(context: FeatureFlagChangedContext): void | Promise<void>;
  onConfigUpdated?(context: ConfigUpdatedContext): void | Promise<void>;
}
