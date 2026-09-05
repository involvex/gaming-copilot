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
    },
    dialog: {
      showOpenDialog: vi.fn(),
    },
    ipcMain: {
      handle: (_channel: string, handler: (...args: unknown[]) => unknown) => {
        capturedHandlers.set(_channel, handler);
      },
    },
  };
});

describe("ipc/capture handlers", () => {
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

  const createCtx = (
    overrides: {
      saveScreenshots?: boolean;
      screenshotDir?: string | null;
      captureRegion?: unknown;
    } = {},
  ): Record<string, unknown> => {
    const ctx: Record<string, unknown> = {
      appConfig: {
        saveScreenshots: overrides.saveScreenshots ?? true,
        screenshotDir: overrides.screenshotDir ?? "/tmp/screenshots",
        captureRegion: overrides.captureRegion ?? null,
        captureQuality: 85,
        maxImageWidth: 1024,
        monitorIndex: 0,
        gameExe: "",
        ocr: { enabled: false },
      } as Record<string, unknown>,
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        errorWithStack: vi.fn(),
      },
    };
    return ctx;
  };

  it("should return false when screenshot saving is disabled", async () => {
    const { registerCaptureHandlers } = await import("../ipc/capture");
    const ctx = createCtx({
      screenshotDir: "/tmp/screenshots",
      saveScreenshots: false,
    });
    registerCaptureHandlers(ctx as never);

    const handler = capturedHandlers.get("capture:save-screenshot") as (
      _event: unknown,
      dataUrl: string,
    ) => Promise<boolean>;

    const result = await handler(null, "data:image/png;base64,abc123");
    expect(result).toBe(false);
  });

  it("should return false when screenshotDir is unset", async () => {
    const { registerCaptureHandlers } = await import("../ipc/capture");
    const ctx = createCtx({ screenshotDir: null, saveScreenshots: true });
    registerCaptureHandlers(ctx as never);

    const handler = capturedHandlers.get("capture:save-screenshot") as (
      _event: unknown,
      dataUrl: string,
    ) => Promise<boolean>;

    const result = await handler(null, "data:image/png;base64,abc123");
    expect(result).toBe(false);
  });

  it("should validate exe name format for check-game", async () => {
    const { registerCaptureHandlers } = await import("../ipc/capture");
    const ctx = createCtx();
    registerCaptureHandlers(ctx as never);

    const handler = capturedHandlers.get("capture:check-game") as (
      _event: unknown,
      exeName: string,
    ) => Promise<{ running: boolean; pid: number | null }>;

    const result = await handler(null, "invalid exe name");
    expect(result.running).toBe(false);
    expect(result.pid).toBeNull();
  });

  it("should set region when bounds are valid", async () => {
    const { registerCaptureHandlers } = await import("../ipc/capture");
    const ctx = createCtx();
    registerCaptureHandlers(ctx as never);

    const handler = capturedHandlers.get("capture:set-region") as (
      _event: unknown,
      region: { x: number; y: number; width: number; height: number } | null,
    ) => Promise<void>;

    await handler(null, { x: 0, y: 0, width: 100, height: 100 });
    expect(ctx.appConfig.captureRegion).toEqual({
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
  });
});
