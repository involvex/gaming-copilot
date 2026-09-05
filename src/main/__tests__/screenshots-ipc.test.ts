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
    shell: {
      openPath: vi.fn(() => Promise.resolve("")),
    },
    clipboard: {
      writeText: vi.fn(),
    },
    nativeImage: {
      createFromPath: vi.fn(() => ({
        getSize: () => ({ width: 1920, height: 1080 }),
      })),
    },
    screen: {
      getAllDisplays: vi.fn(() => []),
    },
  };
});

describe("ipc/screenshots handlers", () => {
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
    overrides: { screenshotDir?: string | null; saveScreenshots?: boolean } = {},
  ): Record<string, unknown> => {
    const ctx: Record<string, unknown> = {
      appConfig: {
        screenshotDir: overrides.screenshotDir ?? null,
        saveScreenshots: overrides.saveScreenshots ?? true,
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

  it("should reject traversal paths on delete", async () => {
    const { registerScreenshotHandlers } = await import("../ipc/screenshots");
    const ctx = createCtx({
      screenshotDir: "/tmp/screenshots",
      saveScreenshots: true,
    });
    registerScreenshotHandlers(ctx as never);

    const handler = capturedHandlers.get("screenshots:delete") as (
      _event: unknown,
      filepath: string,
    ) => Promise<boolean>;

    const result = await handler(null, "../../../etc/passwd");
    expect(result).toBe(false);
  });

  it("should return false when screenshot saving is disabled for delete", async () => {
    const { registerScreenshotHandlers } = await import("../ipc/screenshots");
    const ctx = createCtx({
      screenshotDir: "/tmp/screenshots",
      saveScreenshots: false,
    });
    registerScreenshotHandlers(ctx as never);

    const handler = capturedHandlers.get("screenshots:delete") as (
      _event: unknown,
      filepath: string,
    ) => Promise<boolean>;

    const result = await handler(null, "shot.png");
    expect(result).toBe(false);
  });

  it("should reject traversal paths on open", async () => {
    const { registerScreenshotHandlers } = await import("../ipc/screenshots");
    const ctx = createCtx({
      screenshotDir: "/tmp/screenshots",
      saveScreenshots: true,
    });
    registerScreenshotHandlers(ctx as never);

    const handler = capturedHandlers.get("screenshots:open") as (
      _event: unknown,
      filepath: string,
    ) => Promise<boolean>;

    const result = await handler(null, "../../../etc/passwd");
    expect(result).toBe(false);
  });

  it("should return empty list when no screenshot dir is set", async () => {
    const { registerScreenshotHandlers } = await import("../ipc/screenshots");
    const ctx = createCtx({ screenshotDir: null, saveScreenshots: false });
    registerScreenshotHandlers(ctx as never);

    const handler = capturedHandlers.get("screenshots:list") as (
      _event: unknown,
      input: { dir?: string },
    ) => Promise<unknown[]>;

    const result = await handler(null, {});
    expect(result).toEqual([]);
  });

  it("should return error when bulk rename is disabled", async () => {
    const { registerScreenshotHandlers } = await import("../ipc/screenshots");
    const ctx = createCtx({ screenshotDir: null, saveScreenshots: false });
    registerScreenshotHandlers(ctx as never);

    const handler = capturedHandlers.get("screenshots:bulk-rename") as (
      _event: unknown,
      input: unknown,
    ) => Promise<{ success: boolean; error?: string }>;

    const result = await handler(null, {
      filenames: ["a.png"],
      mode: "prefix",
      value: "new-",
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe("Screenshot saving is not enabled");
  });

  it("should return false for toggle-favorite when screenshotDir is unset", async () => {
    const { registerScreenshotHandlers } = await import("../ipc/screenshots");
    const ctx = createCtx({ screenshotDir: null, saveScreenshots: false });
    registerScreenshotHandlers(ctx as never);

    const handler = capturedHandlers.get("screenshots:toggle-favorite") as (
      _event: unknown,
      filename: string,
    ) => Promise<boolean>;

    const result = await handler(null, "shot.png");
    expect(result).toBe(false);
  });

  it("should return error when screenshot saving is disabled for export", async () => {
    const { registerScreenshotHandlers } = await import("../ipc/screenshots");
    const ctx = createCtx({ screenshotDir: null, saveScreenshots: false });
    registerScreenshotHandlers(ctx as never);

    const handler = capturedHandlers.get("screenshots:export-zip") as (
      _event: unknown,
      input: unknown,
    ) => Promise<{ success: boolean; error?: string }>;

    const result = await handler(null, {
      filenames: ["a.png"],
      zipName: "export.zip",
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe("Screenshot saving is not enabled");
  });
});
