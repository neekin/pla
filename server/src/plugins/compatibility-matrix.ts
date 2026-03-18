export const PLUGIN_API_CURRENT = '1.0';

export const PLUGIN_COMPATIBILITY_MATRIX: Record<string, string[]> = {
  '1.0': ['1.0'],
};

export function isCompatiblePluginApiVersion(version: string) {
  const compatible = PLUGIN_COMPATIBILITY_MATRIX[PLUGIN_API_CURRENT] ?? [];
  return compatible.includes(version);
}
