import type { AppConfig } from "../shared/types";

/**
 * Pure config helpers. No Electron imports and no I/O, so they can be
 * unit-tested without the Electron mock (same precedent as
 * `screenshot-paths.ts`). The IPC handlers in `ipc/config.ts` validate
 * input at the boundary and delegate here.
 */

/**
 * Check an accelerator string such as `CommandOrControl+Shift+G`.
 * Mirrors the renderer-side hotkey contract: word characters joined by
 * `+`/`-` segments.
 */
export function isValidHotkeyFormat(hotkey: string): boolean {
  return /^\w+([+-].+)*$/.test(hotkey);
}

/** Return a copy of the provider map with every API key redacted. */
export function redactProviders(providers: AppConfig["providers"]): AppConfig["providers"] {
  const safe: AppConfig["providers"] = {
    gemini: undefined,
    openaiCompat: undefined,
  };
  if (providers.gemini) {
    safe.gemini = { ...providers.gemini, apiKey: "[REDACTED]" };
  }
  if (providers.openaiCompat?.endpoints) {
    safe.openaiCompat = {
      endpoints: providers.openaiCompat.endpoints.map((ep) => ({
        ...ep,
        apiKey: "[REDACTED]",
      })),
    };
  }
  return safe;
}

/** Deep-copy the config with all provider API keys redacted for export. */
export function exportConfigWithoutSecrets(config: AppConfig): AppConfig {
  const safeCopy = JSON.parse(JSON.stringify(config)) as AppConfig;
  safeCopy.providers = redactProviders(config.providers);
  return safeCopy;
}
