import { app } from "electron";
import type { AppConfig } from "../shared/types";
import { ProviderManager } from "./ai-providers";
import { logger } from "./logger";

export function initProviders(config: AppConfig): ProviderManager {
  const manager = new ProviderManager(config);
  logger.info("Providers", `Initialized with active: ${config.activeProvider}`);
  return manager;
}

export function updateAutoStart(config: AppConfig): void {
  app.setLoginItemSettings({
    openAtLogin: config.autoStart,
    path: app.isPackaged ? process.execPath : undefined,
  });
  logger.info("AutoStart", `Auto-start set to: ${config.autoStart}`);
}
