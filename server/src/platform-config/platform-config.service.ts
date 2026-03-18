import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { dirname, join } from 'path';
import {
  accessSync,
  constants,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'fs';
import {
  PlatformSettingEntity,
  SettingScopeType,
} from '../database/entities/platform-setting.entity';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { NotificationsService } from '../notifications/notifications.service';
import { PluginsService } from '../plugins/plugins.service';
import { UpdatePlatformConfigDto } from './dto/update-platform-config.dto';

export interface PlatformConfigState {
  updatedAt: string;
  featureFlags: Record<string, boolean>;
  taskQueue: {
    persistenceEnabled: boolean;
    runnerEnabled: boolean;
  };
}

export interface PlatformConfigRuntimeStatus {
  dataDirectory: string;
  configFilePath: string;
  taskQueueFilePath: string;
  taskQueueFileExists: boolean;
  taskQueueFileSizeBytes: number;
  taskQueueFileUpdatedAt: string | null;
}

export interface QueueStorageHealth {
  ok: boolean;
  checkedAt: string;
  taskQueueFilePath: string;
  taskQueueFileExists: boolean;
  dataDirectoryWritable: boolean;
  taskQueueFileReadable: boolean;
  taskQueueFileWritable: boolean;
  taskQueueJsonValid: boolean | null;
  detail: string;
}

@Injectable()
export class PlatformConfigService {
  private readonly dataDirectory: string;
  private readonly configFilePath: string;
  private config: PlatformConfigState;

  constructor(
    @InjectRepository(PlatformSettingEntity)
    private readonly settingRepository: Repository<PlatformSettingEntity>,
    private readonly configService: ConfigService,
    private readonly notificationsService: NotificationsService,
    private readonly pluginsService: PluginsService,
  ) {
    this.dataDirectory =
      this.configService.get<string>('PLATFORM_DATA_DIR') ??
      join(process.cwd(), 'server', 'data');

    this.configFilePath =
      this.configService.get<string>('PLATFORM_CONFIG_FILE') ??
      join(this.dataDirectory, 'platform-config.json');

    this.config = this.loadOrCreate();
  }

  getConfig() {
    return this.config;
  }

  getFeatureFlags() {
    return this.config.featureFlags;
  }

  getDataDirectory() {
    return this.dataDirectory;
  }

  getTaskQueueFilePath() {
    return (
      this.configService.get<string>('TASK_QUEUE_FILE') ??
      join(this.dataDirectory, 'tasks.queue.json')
    );
  }

  getRuntimeStatus(): PlatformConfigRuntimeStatus {
    const taskQueueFilePath = this.getTaskQueueFilePath();
    const taskQueueFileExists = existsSync(taskQueueFilePath);

    if (!taskQueueFileExists) {
      return {
        dataDirectory: this.dataDirectory,
        configFilePath: this.configFilePath,
        taskQueueFilePath,
        taskQueueFileExists: false,
        taskQueueFileSizeBytes: 0,
        taskQueueFileUpdatedAt: null,
      };
    }

    const stats = statSync(taskQueueFilePath);

    return {
      dataDirectory: this.dataDirectory,
      configFilePath: this.configFilePath,
      taskQueueFilePath,
      taskQueueFileExists: true,
      taskQueueFileSizeBytes: stats.size,
      taskQueueFileUpdatedAt: stats.mtime.toISOString(),
    };
  }

  probeQueueStorageHealth(): QueueStorageHealth {
    const checkedAt = new Date().toISOString();
    const taskQueueFilePath = this.getTaskQueueFilePath();
    const taskQueueFileExists = existsSync(taskQueueFilePath);

    let dataDirectoryWritable = false;
    let taskQueueFileReadable = false;
    let taskQueueFileWritable = false;
    let taskQueueJsonValid: boolean | null = null;

    try {
      accessSync(this.dataDirectory, constants.W_OK);
      dataDirectoryWritable = true;
    } catch {
      dataDirectoryWritable = false;
    }

    if (taskQueueFileExists) {
      try {
        accessSync(taskQueueFilePath, constants.R_OK);
        taskQueueFileReadable = true;
      } catch {
        taskQueueFileReadable = false;
      }

      try {
        accessSync(taskQueueFilePath, constants.W_OK);
        taskQueueFileWritable = true;
      } catch {
        taskQueueFileWritable = false;
      }

      if (taskQueueFileReadable) {
        try {
          const raw = readFileSync(taskQueueFilePath, 'utf-8');
          JSON.parse(raw);
          taskQueueJsonValid = true;
        } catch {
          taskQueueJsonValid = false;
        }
      }
    } else {
      taskQueueFileWritable = dataDirectoryWritable;
    }

    const ok =
      dataDirectoryWritable &&
      taskQueueFileWritable &&
      (taskQueueFileExists ? taskQueueFileReadable : true) &&
      taskQueueJsonValid !== false;

    const detail = !dataDirectoryWritable
      ? '数据目录不可写'
      : !taskQueueFileWritable
        ? '任务队列文件不可写'
        : taskQueueFileExists && !taskQueueFileReadable
          ? '任务队列文件不可读'
          : taskQueueJsonValid === false
            ? '任务队列文件 JSON 格式损坏'
            : '队列存储健康';

    return {
      ok,
      checkedAt,
      taskQueueFilePath,
      taskQueueFileExists,
      dataDirectoryWritable,
      taskQueueFileReadable,
      taskQueueFileWritable,
      taskQueueJsonValid,
      detail,
    };
  }

  isFeatureEnabled(flagKey: string, fallback = true) {
    const configured = this.config.featureFlags[flagKey];
    return typeof configured === 'boolean' ? configured : fallback;
  }

  isTaskQueuePersistenceEnabled() {
    return this.config.taskQueue.persistenceEnabled;
  }

  isTaskQueueRunnerEnabled() {
    return this.config.taskQueue.runnerEnabled;
  }

  setFeatureFlag(flagKey: string, enabled: boolean) {
    const normalizedKey = flagKey.trim();

    if (!normalizedKey) {
      throw new BadRequestException('功能开关键不能为空');
    }

    this.config.featureFlags[normalizedKey] = enabled;
    this.touchAndPersist();
    this.pluginsService.emitFeatureFlagChanged({ key: normalizedKey, enabled });
    this.notificationsService.publish({
      type: 'feature.updated',
      title: '功能开关更新',
      message: `${normalizedKey} 已切换为 ${enabled ? '开启' : '关闭'}`,
      level: 'info',
      meta: { key: normalizedKey, enabled },
    });

    return {
      key: normalizedKey,
      enabled,
    };
  }

  createFeatureFlag(flagKey: string, enabled: boolean) {
    const normalizedKey = flagKey.trim();

    if (!normalizedKey) {
      throw new BadRequestException('功能开关键不能为空');
    }

    if (Object.prototype.hasOwnProperty.call(this.config.featureFlags, normalizedKey)) {
      throw new BadRequestException(`功能开关 ${normalizedKey} 已存在`);
    }

    this.config.featureFlags[normalizedKey] = enabled;
    this.touchAndPersist();
    this.pluginsService.emitFeatureFlagChanged({ key: normalizedKey, enabled });
    this.notificationsService.publish({
      type: 'feature.created',
      title: '功能开关新增',
      message: `${normalizedKey} 已创建，默认 ${enabled ? '开启' : '关闭'}`,
      level: 'success',
      meta: { key: normalizedKey, enabled },
    });

    return {
      key: normalizedKey,
      enabled,
    };
  }

  deleteFeatureFlag(flagKey: string) {
    const normalizedKey = flagKey.trim();

    if (!Object.prototype.hasOwnProperty.call(this.config.featureFlags, normalizedKey)) {
      throw new BadRequestException(`功能开关 ${normalizedKey} 不存在`);
    }

    delete this.config.featureFlags[normalizedKey];
    this.touchAndPersist();
    this.pluginsService.emitFeatureFlagChanged({ key: normalizedKey, enabled: false });
    this.notificationsService.publish({
      type: 'feature.deleted',
      title: '功能开关删除',
      message: `${normalizedKey} 已删除`,
      level: 'warning',
      meta: { key: normalizedKey },
    });

    return { key: normalizedKey, deleted: true };
  }

  updateConfig(dto: UpdatePlatformConfigDto) {
    if (dto.featureFlags) {
      for (const [key, value] of Object.entries(dto.featureFlags)) {
        if (typeof value !== 'boolean') {
          throw new BadRequestException(`功能开关 ${key} 必须是 boolean`);
        }

        this.config.featureFlags[key] = value;
        this.pluginsService.emitFeatureFlagChanged({ key, enabled: value });
      }
    }

    if (typeof dto.taskQueuePersistenceEnabled === 'boolean') {
      this.config.taskQueue.persistenceEnabled = dto.taskQueuePersistenceEnabled;
    }

    if (typeof dto.taskQueueRunnerEnabled === 'boolean') {
      this.config.taskQueue.runnerEnabled = dto.taskQueueRunnerEnabled;
    }

    this.touchAndPersist();
    this.pluginsService.emitConfigUpdated({ updatedAt: this.config.updatedAt });
    this.notificationsService.publish({
      type: 'config.updated',
      title: '平台配置已更新',
      message: '配置中心参数变更已生效',
      level: 'info',
    });
    return this.config;
  }

  async getEffectiveSettings(input: {
    tenantId?: string;
    userId?: string;
  }) {
    const hostScopeId = 'host';
    const tenantScopeId = input.tenantId?.trim();
    const userScopeId = input.userId?.trim();

    const [hostRows, tenantRows, userRows] = await Promise.all([
      this.settingRepository.find({
        where: { scopeType: 'host', scopeId: hostScopeId },
      }),
      tenantScopeId
        ? this.settingRepository.find({
            where: { scopeType: 'tenant', scopeId: tenantScopeId },
          })
        : Promise.resolve([]),
      userScopeId
        ? this.settingRepository.find({
            where: { scopeType: 'user', scopeId: userScopeId },
          })
        : Promise.resolve([]),
    ]);

    const settingMap = new Map<
      string,
      { value: unknown; source: SettingScopeType; scopeId: string }
    >();

    for (const row of hostRows) {
      settingMap.set(row.key, {
        value: row.value,
        source: 'host',
        scopeId: row.scopeId,
      });
    }

    for (const row of tenantRows) {
      settingMap.set(row.key, {
        value: row.value,
        source: 'tenant',
        scopeId: row.scopeId,
      });
    }

    for (const row of userRows) {
      settingMap.set(row.key, {
        value: row.value,
        source: 'user',
        scopeId: row.scopeId,
      });
    }

    const settings = Array.from(settingMap.entries())
      .sort(([l], [r]) => l.localeCompare(r))
      .map(([key, value]) => ({
        key,
        value: value.value,
        source: value.source,
        sourceScopeId: value.scopeId,
      }));

    return {
      scope: {
        tenantId: tenantScopeId ?? null,
        userId: userScopeId ?? null,
      },
      settings,
      resolutionOrder: ['user', 'tenant', 'host', 'default'],
    };
  }

  async listSettingsByScope(scopeType: SettingScopeType, scopeId: string) {
    const rows = await this.settingRepository.find({
      where: {
        scopeType,
        scopeId,
      },
      order: {
        key: 'ASC',
      },
    });

    return rows.map((row) => ({
      id: row.id,
      scopeType: row.scopeType,
      scopeId: row.scopeId,
      key: row.key,
      value: row.value,
      updatedBy: row.updatedBy,
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  async upsertSetting(input: {
    key: string;
    value: unknown;
    scopeType: SettingScopeType;
    scopeId?: string;
    actor?: AuthUser;
  }) {
    const normalizedKey = input.key.trim();

    if (!normalizedKey) {
      throw new BadRequestException('设置 key 不能为空');
    }

    const normalizedScope = this.normalizeScope({
      scopeType: input.scopeType,
      scopeId: input.scopeId,
      actor: input.actor,
    });

    const existing = await this.settingRepository.findOne({
      where: {
        scopeType: normalizedScope.scopeType,
        scopeId: normalizedScope.scopeId,
        key: normalizedKey,
      },
    });

    const entity = existing ??
      this.settingRepository.create({
        scopeType: normalizedScope.scopeType,
        scopeId: normalizedScope.scopeId,
        key: normalizedKey,
        value: input.value,
        updatedBy: input.actor?.username ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

    entity.value = input.value;
    entity.updatedAt = new Date();
    entity.updatedBy = input.actor?.username ?? null;

    await this.settingRepository.save(entity);

    return {
      id: entity.id,
      scopeType: entity.scopeType,
      scopeId: entity.scopeId,
      key: entity.key,
      value: entity.value,
      updatedBy: entity.updatedBy,
      updatedAt: entity.updatedAt.toISOString(),
      __entityAudit: {
        entityId: entity.id,
        action: existing ? 'update' : 'create',
        changes: {
          value: {
            before: existing?.value ?? null,
            after: entity.value,
          },
        },
        tenantId: input.actor?.tenantId ?? 'host',
        actor: input.actor,
      },
    };
  }

  async removeSetting(input: {
    key: string;
    scopeType: SettingScopeType;
    scopeId?: string;
    actor?: AuthUser;
  }) {
    const normalizedKey = input.key.trim();

    if (!normalizedKey) {
      throw new BadRequestException('设置 key 不能为空');
    }

    const normalizedScope = this.normalizeScope({
      scopeType: input.scopeType,
      scopeId: input.scopeId,
      actor: input.actor,
    });

    const existing = await this.settingRepository.findOne({
      where: {
        scopeType: normalizedScope.scopeType,
        scopeId: normalizedScope.scopeId,
        key: normalizedKey,
      },
    });

    if (!existing) {
      return {
        key: normalizedKey,
        scopeType: normalizedScope.scopeType,
        scopeId: normalizedScope.scopeId,
        deleted: false,
      };
    }

    await this.settingRepository.remove(existing);

    return {
      key: normalizedKey,
      scopeType: normalizedScope.scopeType,
      scopeId: normalizedScope.scopeId,
      deleted: true,
      __entityAudit: {
        entityId: existing.id,
        action: 'delete',
        changes: {
          value: {
            before: existing.value,
            after: null,
          },
        },
        tenantId: input.actor?.tenantId ?? 'host',
        actor: input.actor,
      },
    };
  }

  private normalizeScope(input: {
    scopeType: SettingScopeType;
    scopeId?: string;
    actor?: AuthUser;
  }) {
    if (input.scopeType === 'host') {
      return {
        scopeType: 'host' as const,
        scopeId: 'host',
      };
    }

    if (input.scopeType === 'tenant') {
      const tenantScopeId = input.scopeId?.trim() || input.actor?.tenantId;

      if (!tenantScopeId) {
        throw new BadRequestException('tenant scope 需要 scopeId');
      }

      return {
        scopeType: 'tenant' as const,
        scopeId: tenantScopeId,
      };
    }

    const userScopeId = input.scopeId?.trim() || input.actor?.userId;

    if (!userScopeId) {
      throw new BadRequestException('user scope 需要 scopeId');
    }

    return {
      scopeType: 'user' as const,
      scopeId: userScopeId,
    };
  }

  private loadOrCreate(): PlatformConfigState {
    if (!existsSync(this.configFilePath)) {
      const defaults = this.defaultConfig();
      this.persist(defaults);
      return defaults;
    }

    try {
      const raw = readFileSync(this.configFilePath, 'utf-8');
      const parsed = JSON.parse(raw) as unknown;
      return this.normalize(parsed);
    } catch {
      const defaults = this.defaultConfig();
      this.persist(defaults);
      return defaults;
    }
  }

  private normalize(input: unknown): PlatformConfigState {
    const defaults = this.defaultConfig();

    if (!this.isRecord(input)) {
      return defaults;
    }

    const featureFlags = this.isRecord(input.featureFlags)
      ? Object.entries(input.featureFlags).reduce<Record<string, boolean>>(
          (result, [key, value]) => {
            if (typeof value === 'boolean') {
              result[key] = value;
            }
            return result;
          },
          {},
        )
      : defaults.featureFlags;

    const taskQueueRaw = this.isRecord(input.taskQueue)
      ? input.taskQueue
      : {};

    const normalized: PlatformConfigState = {
      updatedAt:
        typeof input.updatedAt === 'string'
          ? input.updatedAt
          : defaults.updatedAt,
      featureFlags,
      taskQueue: {
        persistenceEnabled:
          typeof taskQueueRaw.persistenceEnabled === 'boolean'
            ? taskQueueRaw.persistenceEnabled
            : defaults.taskQueue.persistenceEnabled,
        runnerEnabled:
          typeof taskQueueRaw.runnerEnabled === 'boolean'
            ? taskQueueRaw.runnerEnabled
            : defaults.taskQueue.runnerEnabled,
      },
    };

    this.persist(normalized);
    return normalized;
  }

  private defaultConfig(): PlatformConfigState {
    return {
      updatedAt: new Date().toISOString(),
      featureFlags: {
        'tasks.dispatch.enabled': true,
        'tasks.runner.enabled': true,
      },
      taskQueue: {
        persistenceEnabled: true,
        runnerEnabled: true,
      },
    };
  }

  private touchAndPersist() {
    this.config.updatedAt = new Date().toISOString();
    this.persist(this.config);
  }

  private persist(payload: PlatformConfigState) {
    mkdirSync(dirname(this.configFilePath), { recursive: true });
    writeFileSync(this.configFilePath, JSON.stringify(payload, null, 2), 'utf-8');
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
