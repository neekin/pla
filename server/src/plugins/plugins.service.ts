import { Inject, Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { createPublicKey, verify } from 'crypto';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import { pathToFileURL } from 'url';
import * as vm from 'vm';
import {
  ConfigUpdatedContext,
  FeatureFlagChangedContext,
  PlatformPlugin,
  TaskCompletedContext,
  TaskDispatchedContext,
} from './interfaces/platform-plugin.interface';
import { PLATFORM_PLUGINS } from './plugin.constants';
import {
  isCompatiblePluginApiVersion,
  PLUGIN_API_CURRENT,
} from './compatibility-matrix';

interface ExternalPluginDescriptor {
  plugin: PlatformPlugin;
  fileName: string;
  filePath: string;
  verified: boolean;
  compatible: boolean;
  isolatedBySandbox: boolean;
}

@Injectable()
export class PluginsService implements OnModuleInit {
  private readonly logger = new Logger(PluginsService.name);
  private readonly dynamicPlugins: ExternalPluginDescriptor[] = [];

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
    const builtins = this.plugins.map((plugin) => ({
      key: plugin.key,
      name: plugin.name,
      description: plugin.description ?? '',
      version: plugin.version ?? '0.0.0',
      apiVersion: plugin.apiVersion,
      source: 'builtin',
      verified: true,
      compatible: isCompatiblePluginApiVersion(plugin.apiVersion),
      isolatedBySandbox: false,
    }));

    const externals = this.dynamicPlugins.map((entry) => ({
      key: entry.plugin.key,
      name: entry.plugin.name,
      description: entry.plugin.description ?? '',
      version: entry.plugin.version ?? '0.0.0',
      apiVersion: entry.plugin.apiVersion,
      source: 'external',
      verified: entry.verified,
      compatible: entry.compatible,
      isolatedBySandbox: entry.isolatedBySandbox,
    }));

    return [...builtins, ...externals];
  }

  compatibility() {
    return {
      currentApiVersion: PLUGIN_API_CURRENT,
      plugins: this.list(),
    };
  }

  marketplaceCatalog() {
    const marketplaceFilePath = resolve(process.cwd(), 'plugins', 'marketplace', 'catalog.json');

    if (!existsSync(marketplaceFilePath)) {
      return {
        version: '0.0.0',
        updatedAt: new Date().toISOString(),
        plugins: [],
      };
    }

    try {
      const raw = readFileSync(marketplaceFilePath, 'utf8');
      return JSON.parse(raw) as {
        version: string;
        updatedAt: string;
        plugins: unknown[];
      };
    } catch {
      this.logger.warn('marketplace catalog parse failed');
      return {
        version: '0.0.0',
        updatedAt: new Date().toISOString(),
        plugins: [],
      };
    }
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
    for (const plugin of this.plugins) {
      try {
        void this.runWithTimeout(plugin, callback, hookName);
      } catch {
        this.logger.warn(`plugin hook failed: ${plugin.key}.${String(hookName)}`);
      }
    }

    for (const descriptor of this.dynamicPlugins) {
      if (!descriptor.compatible) {
        continue;
      }

      try {
        void this.runWithTimeout(descriptor.plugin, callback, hookName);
      } catch {
        this.logger.warn(`plugin hook failed: ${descriptor.plugin.key}.${String(hookName)}`);
      }
    }
  }

  private getAllPlugins() {
    return [...this.plugins, ...this.dynamicPlugins.map((item) => item.plugin)];
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
        const imported = await this.loadPluginModule(filePath, fileName);
        const candidate = this.resolvePluginExport(imported);

        if (!candidate) {
          this.logger.warn(`plugin skipped (invalid export): ${fileName}`);
          continue;
        }

        if (!candidate.apiVersion) {
          this.logger.warn(`plugin skipped (apiVersion required): ${fileName}`);
          continue;
        }

        const compatible = isCompatiblePluginApiVersion(candidate.apiVersion);
        if (!compatible) {
          this.logger.warn(
            `plugin skipped (incompatible apiVersion): ${candidate.key}@${candidate.apiVersion}`,
          );
          continue;
        }

        const verified = this.verifyPluginSignature(filePath);

        const isolatedBySandbox = fileName.endsWith('.plugin.js') || fileName.endsWith('.plugin.cjs');

        this.dynamicPlugins.push({
          plugin: candidate,
          fileName,
          filePath,
          compatible,
          verified,
          isolatedBySandbox,
        });

        this.logger.log(`plugin loaded: ${candidate.key} (${fileName})`);
      } catch {
        this.logger.warn(`plugin load failed: ${fileName}`);
      }
    }
  }

  private async loadPluginModule(filePath: string, fileName: string) {
    if (fileName.endsWith('.plugin.js') || fileName.endsWith('.plugin.cjs')) {
      const sourceCode = readFileSync(filePath, 'utf8');
      const sandbox = {
        module: { exports: {} },
        exports: {},
        console,
      };

      vm.createContext(sandbox);
      const script = new vm.Script(sourceCode, {
        filename: fileName,
      });
      script.runInContext(sandbox, {
        timeout: 500,
      });

      return sandbox.module.exports;
    }

    return import(pathToFileURL(filePath).href);
  }

  private verifyPluginSignature(filePath: string) {
    const publicKeyPem = process.env.PLATFORM_PLUGIN_PUBLIC_KEY;

    if (!publicKeyPem) {
      return false;
    }

    const signatureFilePath = `${filePath}.sig`;

    if (!existsSync(signatureFilePath)) {
      this.logger.warn(`plugin signature missing: ${filePath}`);
      return false;
    }

    try {
      const pluginBytes = readFileSync(filePath);
      const signatureBytes = readFileSync(signatureFilePath);
      const publicKey = createPublicKey(publicKeyPem);

      return verify('RSA-SHA256', pluginBytes, publicKey, signatureBytes);
    } catch {
      this.logger.warn(`plugin signature verification failed: ${filePath}`);
      return false;
    }
  }

  private async runWithTimeout(
    plugin: PlatformPlugin,
    callback: (plugin: PlatformPlugin) => void | Promise<void>,
    hookName: keyof PlatformPlugin,
  ) {
    const timeoutMs = Number(process.env.PLUGIN_HOOK_TIMEOUT_MS ?? 3000);

    await Promise.race([
      Promise.resolve(callback(plugin)),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('PLUGIN_HOOK_TIMEOUT')), timeoutMs);
      }),
    ]).catch(() => {
      this.logger.warn(`plugin hook failed: ${plugin.key}.${String(hookName)}`);
    });
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
