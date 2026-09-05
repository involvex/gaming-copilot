import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCtx, createTestLogger, getCapturedHandlers, resetIpcTestState } from "./helpers";

describe("ipc/games handlers", () => {
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
        games: [],
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
    });

  it("should add a game and return it", async () => {
    const { registerGamesHandlers } = await import("../ipc/games");
    const ctx = makeCtx();
    registerGamesHandlers(ctx as never);

    const handler = getCapturedHandlers().get("games:add") as (
      _event: unknown,
      game: unknown,
    ) => Record<string, unknown>;

    const game = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      name: "Test Game",
      exe: "Test.exe",
      urls: ["https://example.com"],
    };

    const result = handler(null, game);
    expect(result).toEqual(game);
    expect(ctx.emitConfigUpdated).toHaveBeenCalledTimes(1);
  });

  it("should update an existing game", async () => {
    const { registerGamesHandlers } = await import("../ipc/games");
    const ctx = makeCtx();
    (ctx.appConfig as Record<string, unknown>).games = [
      {
        id: "550e8400-e29b-41d4-a716-446655440000",
        name: "Old Name",
        exe: "Old.exe",
        urls: [],
      },
    ];
    registerGamesHandlers(ctx as never);

    const handler = getCapturedHandlers().get("games:update") as (
      _event: unknown,
      game: unknown,
    ) => Record<string, unknown>;

    const updated = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      name: "New Name",
      exe: "New.exe",
      urls: ["https://example.com"],
    };

    const result = handler(null, updated);
    expect(result).toEqual(updated);
    expect(ctx.emitConfigUpdated).toHaveBeenCalledTimes(1);
  });

  it("should throw when updating a nonexistent game", async () => {
    const { registerGamesHandlers } = await import("../ipc/games");
    const ctx = makeCtx();
    registerGamesHandlers(ctx as never);

    const handler = getCapturedHandlers().get("games:update") as (
      _event: unknown,
      game: unknown,
    ) => Record<string, unknown>;

    expect(() =>
      handler(null, {
        id: "00000000-0000-0000-0000-000000000000",
        name: "Ghost",
        exe: "ghost.exe",
        urls: [],
      }),
    ).toThrow("Game not found");
  });

  it("should remove a game by id", async () => {
    const { registerGamesHandlers } = await import("../ipc/games");
    const ctx = makeCtx();
    (ctx.appConfig as Record<string, unknown>).games = [
      {
        id: "550e8400-e29b-41d4-a716-446655440000",
        name: "To Remove",
        exe: "Remove.exe",
        urls: [],
      },
    ];
    registerGamesHandlers(ctx as never);

    const handler = getCapturedHandlers().get("games:remove") as (
      _event: unknown,
      id: string,
    ) => boolean;

    const result = handler(null, "550e8400-e29b-41d4-a716-446655440000");
    expect(result).toBe(true);
    expect((ctx.appConfig as Record<string, unknown>).games as unknown[]).toHaveLength(0);
    expect(ctx.emitConfigUpdated).toHaveBeenCalledTimes(1);
  });

  it("should throw when removing a nonexistent game", async () => {
    const { registerGamesHandlers } = await import("../ipc/games");
    const ctx = makeCtx();
    registerGamesHandlers(ctx as never);

    const handler = getCapturedHandlers().get("games:remove") as (
      _event: unknown,
      id: string,
    ) => boolean;

    expect(() => handler(null, "00000000-0000-0000-0000-000000000000")).toThrow("Game not found");
  });

  it("should list all games", async () => {
    const { registerGamesHandlers } = await import("../ipc/games");
    const ctx = makeCtx();
    (ctx.appConfig as Record<string, unknown>).games = [
      {
        id: "550e8400-e29b-41d4-a716-446655440000",
        name: "Game 1",
        exe: "Game1.exe",
        urls: [],
      },
    ];
    registerGamesHandlers(ctx as never);

    const handler = getCapturedHandlers().get("games:list") as () => Record<string, unknown>[];

    const result = handler();
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("Game 1");
  });

  it("should reject invalid game entry schema", async () => {
    const { registerGamesHandlers } = await import("../ipc/games");
    const ctx = makeCtx();
    registerGamesHandlers(ctx as never);

    const handler = getCapturedHandlers().get("games:add") as (
      _event: unknown,
      game: unknown,
    ) => Record<string, unknown>;

    expect(() => handler(null, { name: "No exe" })).toThrow("IPC validation failed");
  });
});
