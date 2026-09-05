import type { BrowserWindow } from "electron";
import type { autoUpdater } from "electron-updater";
import type { AppConfig } from "../../shared/types";
import type { ProviderManager } from "../ai-providers";
import type { MemreaderPlugin } from "../plugins";

export interface IpcContext {
  appConfig: AppConfig;
  mainWindow: BrowserWindow | null;
  overlayWindow: BrowserWindow | null;
  providerManager: ProviderManager | null;
  setProviderManager: (manager: ProviderManager | null) => void;
  memreaderPlugin: MemreaderPlugin | null;
  autoUpdater: typeof autoUpdater;
  emitConfigUpdated: () => void;
  setConfigValue: <K extends keyof AppConfig>(key: K, value: AppConfig[K]) => void;
  toggleOverlay: () => void;
  repositionOverlay: () => void;
  registerHotkey: () => void;
  unregisterHotkey: () => void;
  registerOverlayHotkey: () => void;
  setHotkey: (hotkey: string) => void;
  logger: {
    info: (component: string, message: string) => void;
    warn: (component: string, message: string) => void;
    error: (component: string, message: string) => void;
    errorWithStack: (component: string, message: string, error: unknown) => void;
  };
}
