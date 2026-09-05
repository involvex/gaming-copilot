import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCtx, createTestLogger, getCapturedHandlers, resetIpcTestState } from "./helpers";

describe("ipc/screenshots handlers", () => {
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
    overrides: { screenshotDir?: string | null; saveScreenshots?: boolean } = {},
  ): Record<string, unknown> =>
    createCtx({
      appConfig: {
        screenshotDir: overrides.screenshotDir ?? null,
        saveScreenshots: overrides.saveScreenshots ?? true,
      } as Record<string, unknown>,
      logger: createTestLogger(),
    });

  it("should return false when screenshot saving is disabled for delete", async () => {
    const { registerScreenshotHandlers } = await import("../ipc/screenshots");
    const ctx = makeCtx({
      screenshotDir: "/tmp/screenshots",
      saveScreenshots: false,
    });
    registerScreenshotHandlers(ctx as never);

    const handler = getCapturedHandlers().get("screenshots:delete") as (
      _event: unknown,
      filepath: string,
    ) => Promise<boolean>;

    const result = await handler(null, "shot.png");
    expect(result).toBe(false);
  });

  it("should return empty list when no screenshot dir is set", async () => {
    const { registerScreenshotHandlers } = await import("../ipc/screenshots");
    const ctx = makeCtx({ screenshotDir: null, saveScreenshots: false });
    registerScreenshotHandlers(ctx as never);

    const handler = getCapturedHandlers().get("screenshots:list") as (
      _event: unknown,
      input: { dir?: string },
    ) => Promise<unknown[]>;

    const result = await handler(null, {});
    expect(result).toEqual([]);
  });

  it("should return error when bulk rename is disabled", async () => {
    const { registerScreenshotHandlers } = await import("../ipc/screenshots");
    const ctx = makeCtx({ screenshotDir: null, saveScreenshots: false });
    registerScreenshotHandlers(ctx as never);

    const handler = getCapturedHandlers().get("screenshots:bulk-rename") as (
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
    const ctx = makeCtx({ screenshotDir: null, saveScreenshots: false });
    registerScreenshotHandlers(ctx as never);

    const handler = getCapturedHandlers().get("screenshots:toggle-favorite") as (
      _event: unknown,
      filename: string,
    ) => Promise<boolean>;

    const result = await handler(null, "shot.png");
    expect(result).toBe(false);
  });

  it("should return error when screenshot saving is disabled for export", async () => {
    const { registerScreenshotHandlers } = await import("../ipc/screenshots");
    const ctx = makeCtx({ screenshotDir: null, saveScreenshots: false });
    registerScreenshotHandlers(ctx as never);

    const handler = getCapturedHandlers().get("screenshots:export-zip") as (
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
