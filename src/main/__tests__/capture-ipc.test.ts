import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCtx, createTestLogger, getCapturedHandlers, resetIpcTestState } from "./helpers";

describe("ipc/capture handlers", () => {
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

  const makeCtx = (
    overrides: {
      saveScreenshots?: boolean;
      screenshotDir?: string | null;
      captureRegion?: unknown;
    } = {},
  ): Record<string, unknown> =>
    createCtx({
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
      logger: createTestLogger(),
    });

  it("should return false when screenshot saving is disabled", async () => {
    const { registerCaptureHandlers } = await import("../ipc/capture");
    const ctx = makeCtx({
      screenshotDir: "/tmp/screenshots",
      saveScreenshots: false,
    });
    registerCaptureHandlers(ctx as never);

    const handler = getCapturedHandlers().get("capture:save-screenshot") as (
      _event: unknown,
      dataUrl: string,
    ) => Promise<boolean>;

    const result = await handler(null, "data:image/png;base64,abc123");
    expect(result).toBe(false);
  });

  it("should return false when screenshotDir is unset", async () => {
    const { registerCaptureHandlers } = await import("../ipc/capture");
    const ctx = makeCtx({ screenshotDir: null, saveScreenshots: true });
    registerCaptureHandlers(ctx as never);

    const handler = getCapturedHandlers().get("capture:save-screenshot") as (
      _event: unknown,
      dataUrl: string,
    ) => Promise<boolean>;

    const result = await handler(null, "data:image/png;base64,abc123");
    expect(result).toBe(false);
  });

  it("should validate exe name format for check-game", async () => {
    const { registerCaptureHandlers } = await import("../ipc/capture");
    const ctx = makeCtx();
    registerCaptureHandlers(ctx as never);

    const handler = getCapturedHandlers().get("capture:check-game") as (
      _event: unknown,
      exeName: string,
    ) => Promise<{ running: boolean; pid: number | null }>;

    const result = await handler(null, "invalid exe name");
    expect(result.running).toBe(false);
    expect(result.pid).toBeNull();
  });

  it("should set region when bounds are valid", async () => {
    const { registerCaptureHandlers } = await import("../ipc/capture");
    const ctx = makeCtx();
    registerCaptureHandlers(ctx as never);

    const handler = getCapturedHandlers().get("capture:set-region") as (
      _event: unknown,
      region: { x: number; y: number; width: number; height: number } | null,
    ) => Promise<void>;

    await handler(null, { x: 0, y: 0, width: 100, height: 100 });
    expect((ctx.appConfig as Record<string, unknown>).captureRegion).toEqual({
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
  });
});
