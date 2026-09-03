import { contextBridge, ipcRenderer } from "electron";

export interface ElectronAPI {
  // Capture
  captureScreenshot: () => Promise<string | null>;
  checkGame: (exeName: string) => Promise<{ running: boolean; pid: number | null }>;
  setGameExe: (exe: string) => Promise<void>;
  setCaptureRegion: (
    region: { x: number; y: number; width: number; height: number } | null,
  ) => Promise<void>;

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
  clearCache: () => Promise<boolean>;
  getProviders: () => Promise<Array<{ name: string; displayName: string; rateLimit: unknown }>>;

  // Overlay
  showOverlay: (text: string) => Promise<void>;
  hideOverlay: () => Promise<void>;
  setClickThrough: (enable: boolean) => Promise<void>;

  // Config
  getConfig: () => Promise<unknown>;
  setProvider: (name: string, config: Record<string, unknown>) => Promise<void>;
  setOverlayConfig: (config: Record<string, unknown>) => Promise<void>;
  setTTSConfig: (config: Record<string, unknown>) => Promise<void>;
  setPromptsConfig: (config: Record<string, unknown>) => Promise<void>;
  setAutoStart: (enable: boolean) => Promise<void>;
  setHotkey: (hotkey: string) => Promise<boolean>;

  // Plugins
  startMemreader: () => Promise<boolean>;
  stopMemreader: () => Promise<boolean>;
  getMemreaderState: () => Promise<unknown>;
  isMemreaderConnected: () => Promise<boolean>;

  // Window
  openSettings: () => Promise<void>;

  // Events
  onCaptureResult: (callback: (dataUrl: string) => void) => void;
  onOverlayData: (callback: (text: string) => void) => void;
  onOverlayStreamDone: (callback: (text: string) => void) => void;
  onNavigateSettings: (callback: () => void) => void;
  removeAllListeners: (channel: string) => void;
}

const electronAPI: ElectronAPI = {
  // Capture
  captureScreenshot: () => ipcRenderer.invoke("capture:screenshot"),
  checkGame: (exeName: string) => ipcRenderer.invoke("capture:check-game", exeName),
  setGameExe: (exe: string) => ipcRenderer.invoke("config:set-game-exe", exe),
  setCaptureRegion: (region) => ipcRenderer.invoke("capture:set-region", region),

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
  getProviders: () => ipcRenderer.invoke("ai:get-providers"),
  clearCache: () => ipcRenderer.invoke("ai:clear-cache"),

  // Overlay
  showOverlay: (text: string) => ipcRenderer.invoke("overlay:show", text),
  hideOverlay: () => ipcRenderer.invoke("overlay:hide"),
  setClickThrough: (enable: boolean) => ipcRenderer.invoke("overlay:set-click-through", enable),

  // Config
  getConfig: () => ipcRenderer.invoke("config:get"),
  setProvider: (name: string, config: Record<string, unknown>) =>
    ipcRenderer.invoke("config:set-provider", name, config),
  setOverlayConfig: (config: Record<string, unknown>) =>
    ipcRenderer.invoke("config:set-overlay", config),
  setTTSConfig: (config: Record<string, unknown>) => ipcRenderer.invoke("config:set-tts", config),
  setPromptsConfig: (config: Record<string, unknown>) =>
    ipcRenderer.invoke("config:set-prompts", config),
  setAutoStart: (enable: boolean) => ipcRenderer.invoke("config:set-auto-start", enable),
  setHotkey: (hotkey: string) => ipcRenderer.invoke("config:set-hotkey", hotkey),

  // Plugins
  startMemreader: () => ipcRenderer.invoke("plugin:memreader:start"),
  stopMemreader: () => ipcRenderer.invoke("plugin:memreader:stop"),
  getMemreaderState: () => ipcRenderer.invoke("plugin:memreader:state"),
  isMemreaderConnected: () => ipcRenderer.invoke("plugin:memreader:connected"),

  // Window
  openSettings: () => ipcRenderer.invoke("window:open-settings"),

  // Events
  onCaptureResult: (callback: (dataUrl: string) => void) => {
    ipcRenderer.on("capture:result", (_event, dataUrl) => callback(dataUrl));
  },
  onOverlayData: (callback: (text: string) => void) => {
    ipcRenderer.on("overlay:data", (_event, text) => callback(text));
  },
  onOverlayStreamDone: (callback: (text: string) => void) => {
    ipcRenderer.on("overlay:stream-done", (_event, text) => callback(text));
  },
  onNavigateSettings: (callback: () => void) => {
    ipcRenderer.on("navigate:settings", () => callback());
  },
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  },
};

contextBridge.exposeInMainWorld("electronAPI", electronAPI);
