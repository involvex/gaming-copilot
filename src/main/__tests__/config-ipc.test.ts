import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockStore: Record<string, unknown> = {};

vi.mock("electron-store", () => {
  return {
    default: class MockStore {
      path = "/fake/path/config.json";
      store: Record<string, unknown> = {};

      constructor(opts?: { defaults?: Record<string, unknown> }) {
        this.store = opts?.defaults ? { ...opts.defaults } : {};
        mockStore.path = this.path;
      }

      get(key: string, defaultValue?: unknown) {
        if (!(key in this.store)) return defaultValue;
        return this.store[key];
      }

      set(key: string, value: unknown) {
        this.store[key] = value;
        mockStore[key] = value;
      }
    },
  };
});

vi.mock("../logger", () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    errorWithStack: vi.fn(),
  },
}));

vi.mock("../../shared/constants", () => ({
  DEFAULT_SYSTEM_PROMPT: "You are a helpful AI assistant.",
  APP_THEME_VALUES: ["dark", "light", "system"] as const,
  APP_THEME_LABELS: { dark: "Dark", light: "Light", system: "System" } as const,
  THEME_CLASS_NAMES: ["theme-dark", "theme-light"] as const,
}));

const capturedHandlers: Map<string, (...args: unknown[]) => unknown> = new Map();

vi.mock("electron", () => {
  return {
    app: {
      getPath: vi.fn(() => "/fake/path"),
      isPackaged: false,
      setLoginItemSettings: vi.fn(),
    },
    ipcMain: {
      handle: (_channel: string, handler: (...args: unknown[]) => unknown) => {
        capturedHandlers.set(_channel, handler);
      },
    },
  };
});

vi.mock("../config", async () => {
  const actual = await vi.importActual<typeof import("../config")>("../config");
  return {
    ...actual,
    setConfigValue: vi.fn((_key: string, _value: unknown) => {}),
  };
});

vi.mock("../app-helpers", () => ({
  initProviders: vi.fn(() => ({
    setActiveProvider: vi.fn(),
    setFallbackProvider: vi.fn(),
    getAvailableProviders: vi.fn(() => []),
    getActiveProviderInfo: vi.fn(),
    clearCache: vi.fn(),
    fetchModelsForProvider: vi.fn(() => []),
    streamAnalyze: async function* () {
      yield { done: true, text: "" };
    },
    analyze: vi.fn(() => ({ response: "" })),
    testProvider: vi.fn(() => true),
  })),
  updateAutoStart: vi.fn(),
}));

vi.mock("../secure-storage", () => ({
  storeKey: vi.fn(),
  retrieveKey: vi.fn(),
  deleteKey: vi.fn(),
  getAccount: vi.fn(() => "test-account"),
}));

describe("ipc/config handlers", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    capturedHandlers.clear();
    const keys = Object.keys(mockStore);
    for (const key of keys) {
      delete mockStore[key];
    }
    const { initConfig } = await import("../config");
    initConfig();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const createCtx = (): Record<string, unknown> => {
    const appConfig: Record<string, unknown> = {
      providers: {
        gemini: { apiKey: "", model: "", grounding: false },
      },
      activeProvider: "gemini",
      fallbackProvider: null,
      overlay: {
        position: "bottom-right" as const,
        duration: 8000,
        opacity: 0.9,
        fontSize: 14,
        theme: "dark" as const,
        clickThrough: true,
        customCSS: "",
      },
      autoStart: false,
      captureMode: "auto",
      hotkeyEnabled: true,
      hotkey: "CommandOrControl+Shift+G",
      overlayHotkey: "CommandOrControl+Shift+O",
      telemetry: { enabled: false },
    };
    const ctx: Record<string, unknown> = {
      appConfig,
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        errorWithStack: vi.fn(),
      },
      emitConfigUpdated: vi.fn(),
      setConfigValue: vi.fn((_key: string, _value: unknown) => {}),
      setProviderManager: vi.fn(),
      providerManager: {
        setActiveProvider: vi.fn(),
        setFallbackProvider: vi.fn(),
      } as unknown as Record<string, unknown>,
      toggleOverlay: vi.fn(),
      repositionOverlay: vi.fn(),
      registerHotkey: vi.fn(),
      unregisterHotkey: vi.fn(),
      registerOverlayHotkey: vi.fn(),
      setHotkey: vi.fn(),
      mainWindow: null,
      overlayWindow: null,
      memreaderPlugin: null,
      autoUpdater: { on: vi.fn() },
    };
    return ctx;
  };

  it("should reject unknown active provider", async () => {
    const { registerConfigHandlers } = await import("../ipc/config");
    const ctx = createCtx();
    registerConfigHandlers(ctx as never);

    const handler = capturedHandlers.get("config:set-active-provider") as (
      _event: unknown,
      name: string,
    ) => void;

    expect(() => handler(null, "nonexistent-provider")).toThrow("Unknown provider");
  });

  it("should reject unknown fallback provider", async () => {
    const { registerConfigHandlers } = await import("../ipc/config");
    const ctx = createCtx();
    registerConfigHandlers(ctx as never);

    const handler = capturedHandlers.get("config:set-fallback-provider") as (
      _event: unknown,
      name: string,
    ) => void;

    expect(() => handler(null, "nonexistent-provider")).toThrow("Unknown provider");
  });

  it("should accept null fallback provider", async () => {
    const { registerConfigHandlers } = await import("../ipc/config");
    const ctx = createCtx();
    registerConfigHandlers(ctx as never);

    const handler = capturedHandlers.get("config:set-fallback-provider") as (
      _event: unknown,
      name: string | null,
    ) => void;

    handler(null, null);
    expect(ctx.appConfig.fallbackProvider).toBeNull();
  });

  it("should redact API keys on export", async () => {
    const { registerConfigHandlers } = await import("../ipc/config");
    const ctx = createCtx();
    (ctx.appConfig.providers.gemini as Record<string, unknown>).apiKey = "secret-key";
    registerConfigHandlers(ctx as never);

    const handler = capturedHandlers.get("config:export") as () => Record<string, unknown>;

    const result = handler();
    const providers = result.providers as Record<string, unknown>;
    expect(providers.gemini?.apiKey).toBe("[REDACTED]");
  });

  it("should reject invalid hotkey format", async () => {
    const { registerConfigHandlers } = await import("../ipc/config");
    const ctx = createCtx();
    registerConfigHandlers(ctx as never);

    const handler = capturedHandlers.get("config:set-hotkey") as (
      _event: unknown,
      hotkey: string,
    ) => Promise<boolean>;

    const result = await handler(null, "INVALID HOTKEY WITH SPACES");
    expect(result).toBe(false);
  });

  it("should accept valid hotkey format", async () => {
    const { registerConfigHandlers } = await import("../ipc/config");
    const ctx = createCtx();
    registerConfigHandlers(ctx as never);

    const handler = capturedHandlers.get("config:set-hotkey") as (
      _event: unknown,
      hotkey: string,
    ) => Promise<boolean>;

    const result = await handler(null, "CommandOrControl+Shift+X");
    expect(result).toBe(true);
  });
});
