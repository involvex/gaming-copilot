import { contextBridge, ipcRenderer } from "electron";
import type { AppConfig } from "../shared/types";

export interface ElectronAPI {
  // Capture
  captureScreenshot: () => Promise<string | null>;
  capturePreview: () => Promise<string | null>;
  captureRecord: () => Promise<string | null>;
  getScreens: () => Promise<Array<{ index: number; name: string; primary: boolean }>>;
  checkGame: (exeName: string) => Promise<{ running: boolean; pid: number | null }>;
  setGameExe: (exe: string) => Promise<void>;
  setCaptureRegion: (
    region: { x: number; y: number; width: number; height: number } | null,
  ) => Promise<void>;
  setRecordDuration: (duration: number) => Promise<void>;
  exportConfig: () => Promise<AppConfig>;
  importConfig: (config: unknown) => Promise<boolean>;
  pickScreenshotDir: () => Promise<string | null>;
  setSaveScreenshots: (enabled: boolean, dir?: string | null) => Promise<void>;
  saveScreenshot: (dataUrl: string) => Promise<boolean>;

  // AI
  analyze: (
    imageBase64: string,
    userMessage?: string,
  ) => Promise<{ response?: string; error?: string }>;
  analyzeStream: (
    imageBase64: string,
    userMessage: string,
    onChunk: (text: string) => void,
    onDone: (fullText: string) => void,
    onError: (error: string) => void,
  ) => void;
  testProvider: (name: string) => Promise<boolean>;
  fetchModels: (name: string) => Promise<string[]>;
  clearCache: () => Promise<boolean>;
  getProviders: () => Promise<Array<{ name: string; displayName: string; rateLimit: unknown }>>;

  // Overlay
  showOverlay: (text: string) => Promise<void>;
  hideOverlay: () => Promise<void>;
  toggleOverlay: () => Promise<void>;
  setClickThrough: (enable: boolean) => Promise<void>;

  // Chat History
  saveChatHistory: (messages: import("../shared/types").ChatMessage[]) => Promise<boolean>;
  loadChatHistory: () => Promise<import("../shared/types").ChatMessage[]>;
  clearChatHistory: () => Promise<void>;
  exportChatHistory: (format: "markdown" | "json") => Promise<string>;

  // Config
  getConfig: () => Promise<unknown>;
  setProvider: (name: string, config: Record<string, unknown>) => Promise<void>;
  removeEndpoint: (name: string) => Promise<void>;
  setActiveProvider: (name: string) => Promise<void>;
  setOverlayConfig: (config: Record<string, unknown>) => Promise<void>;
  setOverlayCSS: (css: string) => Promise<void>;
  setTTSConfig: (config: Record<string, unknown>) => Promise<void>;
  setPromptsConfig: (config: Record<string, unknown>) => Promise<void>;
  setAutoStart: (enable: boolean) => Promise<void>;
  setHotkey: (hotkey: string) => Promise<boolean>;
  setOverlayHotkey: (hotkey: string) => Promise<boolean>;
  setHotkeyEnabled: (enabled: boolean) => Promise<boolean>;
  setSetting: (key: string, value: unknown) => Promise<void>;
  setTelemetry: (enabled: boolean) => Promise<void>;
  setCaptureMode: (mode: "auto" | "window" | "fullscreen" | "gdi") => Promise<void>;

  // Plugins
  startMemreader: () => Promise<boolean>;
  stopMemreader: () => Promise<boolean>;
  getMemreaderState: () => Promise<unknown>;
  isMemreaderConnected: () => Promise<boolean>;

  // Window
  openSettings: () => Promise<void>;

  // App
  getVersion: () => Promise<string>;
  checkForUpdates: (
    action: "check" | "install",
  ) => Promise<{ status: string; version?: string; message?: string }>;

  // Events
  onCaptureResult: (callback: (dataUrl: string) => void) => void;
  onOverlayData: (callback: (text: string) => void) => void;
  onOverlayCSS: (callback: (css: string) => void) => void;
  onOverlayStreamDone: (callback: (text: string) => void) => void;
  onOverlayProvider: (callback: (info: { displayName: string; model: string }) => void) => void;
  onNavigateSettings: (callback: () => void) => void;
  onUpdateStatus: (callback: (status: string, version?: string, message?: string) => void) => void;
  onConfigUpdated: (callback: () => void) => void;
  removeAllListeners: (channel: string) => void;
}

const electronAPI: ElectronAPI = {
  // Capture
  captureScreenshot: () => ipcRenderer.invoke("capture:screenshot"),
  capturePreview: () => ipcRenderer.invoke("capture:preview"),
  captureRecord: () => ipcRenderer.invoke("capture:record"),
  getScreens: () => ipcRenderer.invoke("capture:get-screens"),
  checkGame: (exeName: string) => ipcRenderer.invoke("capture:check-game", exeName),
  setGameExe: (exe: string) => ipcRenderer.invoke("config:set-game-exe", exe),
  setCaptureRegion: (region) => ipcRenderer.invoke("capture:set-region", region),
  setRecordDuration: (duration: number) =>
    ipcRenderer.invoke("config:set-generic", "recordDuration", duration),
  exportConfig: () => ipcRenderer.invoke("config:export"),
  importConfig: (config: unknown) => ipcRenderer.invoke("config:import", config),
  pickScreenshotDir: () => ipcRenderer.invoke("capture:pick-directory"),
  setSaveScreenshots: async (enabled: boolean, dir?: string | null) => {
    await ipcRenderer.invoke("config:set-generic", "saveScreenshots", enabled);
    await ipcRenderer.invoke("config:set-generic", "screenshotDir", dir ?? null);
  },
  saveScreenshot: (dataUrl: string) => ipcRenderer.invoke("capture:save-screenshot", dataUrl),

  // AI
  analyze: (imageBase64: string, userMessage?: string) =>
    ipcRenderer.invoke("ai:analyze", imageBase64, userMessage),
  analyzeStream: (
    imageBase64: string,
    userMessage: string,
    onChunk: (text: string) => void,
    onDone: (fullText: string) => void,
    onError: (error: string) => void,
  ) => {
    ipcRenderer.send("ai:analyze-stream", imageBase64, userMessage);
    ipcRenderer.on("ai:stream-chunk", (_event, text: string) => onChunk(text));
    ipcRenderer.on("ai:stream-done", (_event, fullText: string) => onDone(fullText));
    ipcRenderer.on("ai:stream-error", (_event, error: string) => onError(error));
  },
  testProvider: (name: string) => ipcRenderer.invoke("ai:test-provider", name),
  fetchModels: (name: string) => ipcRenderer.invoke("ai:fetch-models", name),
  getProviders: () => ipcRenderer.invoke("ai:get-providers"),
  clearCache: () => ipcRenderer.invoke("ai:clear-cache"),

  // Overlay
  showOverlay: (text: string) => ipcRenderer.invoke("overlay:show", text),
  hideOverlay: () => ipcRenderer.invoke("overlay:hide"),
  toggleOverlay: () => ipcRenderer.invoke("overlay:toggle"),
  setClickThrough: (enable: boolean) => ipcRenderer.invoke("overlay:set-click-through", enable),

  // Chat History
  saveChatHistory: (messages) => ipcRenderer.invoke("chat:save", messages),
  loadChatHistory: () => ipcRenderer.invoke("chat:load"),
  clearChatHistory: () => ipcRenderer.invoke("chat:clear"),
  exportChatHistory: (format: "markdown" | "json") => ipcRenderer.invoke("chat:export", format),

  // Config
  getConfig: () => ipcRenderer.invoke("config:get"),
  setProvider: (name: string, config: Record<string, unknown>) =>
    ipcRenderer.invoke("config:set-provider", name, config),
  removeEndpoint: (name: string) => ipcRenderer.invoke("config:remove-endpoint", name),
  setActiveProvider: (name: string) => ipcRenderer.invoke("config:set-active-provider", name),
  setOverlayConfig: (config: Record<string, unknown>) =>
    ipcRenderer.invoke("config:set-overlay", config),
  setOverlayCSS: (css: string) => ipcRenderer.invoke("overlay:set-css", css),
  setTTSConfig: (config: Record<string, unknown>) => ipcRenderer.invoke("config:set-tts", config),
  setPromptsConfig: (config: Record<string, unknown>) =>
    ipcRenderer.invoke("config:set-prompts", config),
  setAutoStart: (enable: boolean) => ipcRenderer.invoke("config:set-auto-start", enable),
  setHotkey: (hotkey: string) => ipcRenderer.invoke("config:set-hotkey", hotkey),
  setOverlayHotkey: (hotkey: string) => ipcRenderer.invoke("config:set-overlay-hotkey", hotkey),
  setHotkeyEnabled: (enabled: boolean) => ipcRenderer.invoke("config:set-hotkey-enabled", enabled),
  setSetting: (key: string, value: unknown) => ipcRenderer.invoke("config:set-generic", key, value),
  setTelemetry: (enabled: boolean) => ipcRenderer.invoke("config:set-telemetry", enabled),
  setCaptureMode: (mode: "auto" | "window" | "fullscreen" | "gdi") =>
    ipcRenderer.invoke("config:set-capture-mode", mode),

  // Plugins
  startMemreader: () => ipcRenderer.invoke("plugin:memreader:start"),
  stopMemreader: () => ipcRenderer.invoke("plugin:memreader:stop"),
  getMemreaderState: () => ipcRenderer.invoke("plugin:memreader:state"),
  isMemreaderConnected: () => ipcRenderer.invoke("plugin:memreader:connected"),

  // Window
  openSettings: () => ipcRenderer.invoke("window:open-settings"),

  // App
  getVersion: () => ipcRenderer.invoke("app:get-version"),
  checkForUpdates: (action: "check" | "install") => ipcRenderer.invoke("app:update", action),

  // Events
  onCaptureResult: (callback: (dataUrl: string) => void) => {
    ipcRenderer.on("capture:result", (_event, dataUrl) => callback(dataUrl));
  },
  onOverlayData: (callback: (text: string) => void) => {
    ipcRenderer.on("overlay:data", (_event, text) => callback(text));
  },
  onOverlayCSS: (callback: (css: string) => void) => {
    ipcRenderer.on("overlay:set-css", (_event, css) => callback(css));
  },
  onOverlayStreamDone: (callback: (text: string) => void) => {
    ipcRenderer.on("overlay:stream-done", (_event, text) => callback(text));
  },
  onOverlayProvider: (callback: (info: { displayName: string; model: string }) => void) => {
    ipcRenderer.on("overlay:provider", (_event, info) => callback(info));
  },
  onNavigateSettings: (callback: () => void) => {
    ipcRenderer.on("navigate:settings", () => callback());
  },
  onUpdateStatus: (callback: (status: string, version?: string, message?: string) => void) => {
    ipcRenderer.on(
      "app:update-status",
      (_event, status: string, version?: string, message?: string) =>
        callback(status, version, message),
    );
  },
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  },
  onConfigUpdated: (callback: () => void) => {
    ipcRenderer.on("config:updated", () => callback());
  },
};

contextBridge.exposeInMainWorld("electronAPI", electronAPI);
