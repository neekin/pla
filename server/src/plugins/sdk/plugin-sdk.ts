import type { PlatformPlugin } from '../interfaces/platform-plugin.interface';

export function definePlugin<T extends PlatformPlugin>(plugin: T): T {
  if (!plugin.apiVersion) {
    throw new Error('Plugin apiVersion is required');
  }

  if (!plugin.key || !plugin.name) {
    throw new Error('Plugin key and name are required');
  }

  return plugin;
}

export function createPluginManifest(input: {
  key: string;
  version: string;
  apiVersion: string;
  checksum: string;
}) {
  return {
    key: input.key,
    version: input.version,
    apiVersion: input.apiVersion,
    checksum: input.checksum,
    generatedAt: new Date().toISOString(),
  };
}
