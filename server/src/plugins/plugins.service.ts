import { Inject, Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { existsSync, readdirSync } from 'fs';
import { join, resolve } from 'path';
import { pathToFileURL } from 'url';
import {
  ConfigUpdatedContext,
  FeatureFlagChangedContext,
  PlatformPlugin,
  TaskCompletedContext,
  TaskDispatchedContext,
} from './interfaces/platform-plugin.interface';
import { PLATFORM_PLUGINS } from './plugin.constants';

@Injectable()
export class PluginsService implements OnModuleInit {
  private readonly logger = new Logger(PluginsService.name);
  private readonly dynamicPlugins: PlatformPlugin[] = [];

  constructor(
    @Optional()
    @Inject(PLATFORM_PLUGINS)
    private readonly plugins: PlatformPlugin[] = [],
  ) {}

  async onModuleInit() {
    await this.loadExternalPlugins();
    this.emitSystemBoot();
  }

  list() {
    return this.getAllPlugins().map((plugin) => ({
      key: plugin.key,
      name: plugin.name,
      description: plugin.description ?? '',
      version: plugin.version ?? '0.0.0',
      source: this.plugins.includes(plugin) ? 'builtin' : 'external',
    }));
  }

  emitTaskDispatched(context: TaskDispatchedContext) {
    this.invoke('onTaskDispatched', (plugin) => plugin.onTaskDispatched?.(context));
  }

  emitTaskCompleted(context: TaskCompletedContext) {
    this.invoke('onTaskCompleted', (plugin) => plugin.onTaskCompleted?.(context));
  }

  emitFeatureFlagChanged(context: FeatureFlagChangedContext) {
    this.invoke('onFeatureFlagChanged', (plugin) => plugin.onFeatureFlagChanged?.(context));
  }

  emitConfigUpdated(context: ConfigUpdatedContext) {
    this.invoke('onConfigUpdated', (plugin) => plugin.onConfigUpdated?.(context));
  }

  private emitSystemBoot() {
    this.invoke('onSystemBoot', (plugin) =>
      plugin.onSystemBoot?.({ timestamp: new Date().toISOString() }),
    );
  }

  private invoke(
    hookName: keyof PlatformPlugin,
    callback: (plugin: PlatformPlugin) => void | Promise<void>,
  ) {
    for (const plugin of this.getAllPlugins()) {
      try {
        const result = callback(plugin);

        if (result instanceof Promise) {
          result.catch(() => {
            this.logger.warn(`plugin hook failed: ${plugin.key}.${String(hookName)}`);
          });
        }
      } catch {
        this.logger.warn(`plugin hook failed: ${plugin.key}.${String(hookName)}`);
      }
    }
  }

  private getAllPlugins() {
    return [...this.plugins, ...this.dynamicPlugins];
  }

  private async loadExternalPlugins() {
    const pluginDirectory = this.resolvePluginDirectory();

    if (!existsSync(pluginDirectory)) {
      return;
    }

    const pluginFiles = readdirSync(pluginDirectory).filter((fileName) =>
      fileName.endsWith('.plugin.js') || fileName.endsWith('.plugin.mjs') || fileName.endsWith('.plugin.cjs'),
    );

    for (const fileName of pluginFiles) {
      const filePath = join(pluginDirectory, fileName);

      try {
        const imported = await import(pathToFileURL(filePath).href);
        const candidate = this.resolvePluginExport(imported);

        if (!candidate) {
          this.logger.warn(`plugin skipped (invalid export): ${fileName}`);
          continue;
        }

        this.dynamicPlugins.push(candidate);
        this.logger.log(`plugin loaded: ${candidate.key} (${fileName})`);
      } catch {
        this.logger.warn(`plugin load failed: ${fileName}`);
      }
    }
  }

  private resolvePluginDirectory() {
    const configured = process.env.PLATFORM_PLUGIN_DIR;

    if (configured && configured.trim()) {
      return resolve(configured);
    }

    const packageLocal = resolve(process.cwd(), 'plugins');

    if (existsSync(packageLocal)) {
      return packageLocal;
    }

    return resolve(process.cwd(), 'server', 'plugins');
  }

  private resolvePluginExport(
    imported: Record<string, unknown>,
  ): PlatformPlugin | null {
    const candidates = [
      imported.default,
      imported.plugin,
      imported,
    ];

    for (const candidate of candidates) {
      if (!candidate || typeof candidate !== 'object') {
        continue;
      }

      const plugin = candidate as Partial<PlatformPlugin>;

      if (typeof plugin.key === 'string' && typeof plugin.name === 'string') {
        return plugin as PlatformPlugin;
      }
    }

    return null;
  }
}
