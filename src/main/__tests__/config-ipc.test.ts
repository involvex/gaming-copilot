import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCtx, createTestLogger, getCapturedHandlers, resetIpcTestState } from "./helpers";

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
    resetIpcTestState();
    const { initConfig } = await import("../config");
    initConfig();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const makeCtx = (): Record<string, unknown> =>
    createCtx({
      appConfig: {
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
      } as Record<string, unknown>,
      logger: createTestLogger(),
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
    });

  it("should reject unknown active provider", async () => {
    const { registerConfigHandlers } = await import("../ipc/config");
    const ctx = makeCtx();
    registerConfigHandlers(ctx as never);

    const handler = getCapturedHandlers().get("config:set-active-provider") as (
      _event: unknown,
      name: string,
    ) => void;

    expect(() => handler(null, "nonexistent-provider")).toThrow("Unknown provider");
  });

  it("should reject unknown fallback provider", async () => {
    const { registerConfigHandlers } = await import("../ipc/config");
    const ctx = makeCtx();
    registerConfigHandlers(ctx as never);

    const handler = getCapturedHandlers().get("config:set-fallback-provider") as (
      _event: unknown,
      name: string,
    ) => void;

    expect(() => handler(null, "nonexistent-provider")).toThrow("Unknown provider");
  });

  it("should accept null fallback provider", async () => {
    const { registerConfigHandlers } = await import("../ipc/config");
    const ctx = makeCtx();
    registerConfigHandlers(ctx as never);

    const handler = getCapturedHandlers().get("config:set-fallback-provider") as (
      _event: unknown,
      name: string | null,
    ) => void;

    handler(null, null);
    expect((ctx.appConfig as Record<string, unknown>).fallbackProvider).toBeNull();
  });

  it("should redact API keys on export", async () => {
    const { registerConfigHandlers } = await import("../ipc/config");
    const ctx = makeCtx();
    (
      ((ctx.appConfig as Record<string, unknown>).providers as Record<string, unknown>)
        .gemini as Record<string, unknown>
    ).apiKey = "secret-key";
    registerConfigHandlers(ctx as never);

    const handler = getCapturedHandlers().get("config:export") as () => Record<string, unknown>;

    const result = handler();
    const providers = result.providers as Record<string, unknown>;
    expect((providers.gemini as Record<string, unknown>)?.apiKey).toBe("[REDACTED]");
  });
});
