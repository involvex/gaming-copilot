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
    ipcMain: {
      handle: (_channel: string, handler: (...args: unknown[]) => unknown) => {
        capturedHandlers.set(_channel, handler);
      },
    },
  };
});

describe("ipc/games handlers", () => {
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
    };
    return ctx;
  };

  it("should add a game and return it", async () => {
    const { registerGamesHandlers } = await import("../ipc/games");
    const ctx = createCtx();
    registerGamesHandlers(ctx as never);

    const handler = capturedHandlers.get("games:add") as (
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
    expect(result.name).toBe("Test Game");
    expect(result.exe).toBe("Test.exe");
    expect(ctx.appConfig.games).toHaveLength(1);
  });

  it("should update an existing game", async () => {
    const { registerGamesHandlers } = await import("../ipc/games");
    const ctx = createCtx();
    ctx.appConfig.games = [
      {
        id: "550e8400-e29b-41d4-a716-446655440000",
        name: "Old Name",
        exe: "Old.exe",
        urls: [],
      },
    ];
    registerGamesHandlers(ctx as never);

    const handler = capturedHandlers.get("games:update") as (
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
    expect(result.name).toBe("New Name");
    expect(ctx.appConfig.games).toHaveLength(1);
    expect(ctx.appConfig.games[0].name).toBe("New Name");
  });

  it("should throw when updating a nonexistent game", async () => {
    const { registerGamesHandlers } = await import("../ipc/games");
    const ctx = createCtx();
    registerGamesHandlers(ctx as never);

    const handler = capturedHandlers.get("games:update") as (
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
    const ctx = createCtx();
    ctx.appConfig.games = [
      {
        id: "550e8400-e29b-41d4-a716-446655440000",
        name: "To Remove",
        exe: "Remove.exe",
        urls: [],
      },
    ];
    registerGamesHandlers(ctx as never);

    const handler = capturedHandlers.get("games:remove") as (
      _event: unknown,
      id: string,
    ) => boolean;

    const result = handler(null, "550e8400-e29b-41d4-a716-446655440000");
    expect(result).toBe(true);
    expect(ctx.appConfig.games).toHaveLength(0);
  });

  it("should throw when removing a nonexistent game", async () => {
    const { registerGamesHandlers } = await import("../ipc/games");
    const ctx = createCtx();
    registerGamesHandlers(ctx as never);

    const handler = capturedHandlers.get("games:remove") as (
      _event: unknown,
      id: string,
    ) => boolean;

    expect(() => handler(null, "00000000-0000-0000-0000-000000000000")).toThrow("Game not found");
  });

  it("should list all games", async () => {
    const { registerGamesHandlers } = await import("../ipc/games");
    const ctx = createCtx();
    ctx.appConfig.games = [
      {
        id: "550e8400-e29b-41d4-a716-446655440000",
        name: "Game 1",
        exe: "Game1.exe",
        urls: [],
      },
    ];
    registerGamesHandlers(ctx as never);

    const handler = capturedHandlers.get("games:list") as () => Record<string, unknown>[];

    const result = handler();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Game 1");
  });

  it("should reject invalid game entry schema", async () => {
    const { registerGamesHandlers } = await import("../ipc/games");
    const ctx = createCtx();
    registerGamesHandlers(ctx as never);

    const handler = capturedHandlers.get("games:add") as (
      _event: unknown,
      game: unknown,
    ) => Record<string, unknown>;

    expect(() => handler(null, { name: "No exe" })).toThrow("IPC validation failed");
  });
});
