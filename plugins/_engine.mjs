/**
 * Plugin layer removed in UI-first fork. Stub keeps scan/doctor imports working.
 */

export function pluginRoots(root) {
  void root;
  return [];
}

export function resolveSuccessorIds(root) {
  void root;
  return new Map();
}

export function discoverPlugins(_roots, _successors) {
  return [];
}

export function pluginStatus() {
  return { enabled: false, missingEnv: [] };
}

/** No-op: returns providers unchanged. */
export async function mergeProviderPlugins(providers) {
  return providers;
}

export const HOOK_KINDS = [];
export const RESERVED_ENV = new Set();

export function validateManifest() {
  return [];
}
