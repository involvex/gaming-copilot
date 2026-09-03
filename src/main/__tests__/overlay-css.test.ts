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

vi.mock("electron", () => ({
  app: {
    getPath: vi.fn(() => "/fake/path"),
  },
}));

vi.mock("../../../shared/constants", () => ({
  DEFAULT_SYSTEM_PROMPT: "You are a helpful AI assistant.",
}));

describe("config module — overlay customCSS", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    const keys = Object.keys(mockStore);
    for (const key of keys) {
      delete mockStore[key];
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should include customCSS in default config", async () => {
    const { initConfig } = await import("../config");

    const config = initConfig();

    expect(config.overlay.customCSS).toBeDefined();
    expect(config.overlay.customCSS).toBe("");
  });

  it("should persist customCSS via setConfigValue", async () => {
    const { initConfig, setConfigValue, getConfig } = await import("../config");

    initConfig();
    setConfigValue("overlay", {
      ...getConfig().overlay,
      customCSS: ".overlay-text { font-weight: bold; }",
    });

    expect((getConfig().overlay as Record<string, unknown>).customCSS).toBe(
      ".overlay-text { font-weight: bold; }",
    );
  });

  it("should round-trip customCSS through setPartialConfig", async () => {
    const { initConfig, setPartialConfig, getConfig } = await import("../config");

    initConfig();
    const newCSS = ".overlay-container { border: 2px solid red; }";
    setPartialConfig({
      overlay: { ...getConfig().overlay, customCSS: newCSS },
    });

    expect((getConfig().overlay as Record<string, unknown>).customCSS).toBe(newCSS);
  });
});
