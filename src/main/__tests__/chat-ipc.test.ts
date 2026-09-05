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

describe("ipc/chat handlers", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    capturedHandlers.clear();
    const keys = Object.keys(mockStore);
    for (const key of keys) {
      delete mockStore[key];
    }
    const { initConfig, initChatStore } = await import("../config");
    initConfig();
    initChatStore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should save chat messages", async () => {
    const { registerChatHandlers } = await import("../ipc/chat");
    const ctx = {
      logger: {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        errorWithStack: vi.fn(),
      },
    };
    registerChatHandlers(ctx as never);

    const handler = capturedHandlers.get("chat:save") as (
      _event: unknown,
      messages: unknown,
    ) => boolean;

    const messages = [
      { id: "1", role: "user", text: "Hello", timestamp: 12345 },
      { id: "2", role: "assistant", text: "Hi", timestamp: 12346 },
    ];

    const result = handler(null, messages);
    expect(result).toBe(true);
  });

  it("should load chat messages", async () => {
    const { registerChatHandlers } = await import("../ipc/chat");
    const ctx = {
      logger: {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        errorWithStack: vi.fn(),
      },
    };
    registerChatHandlers(ctx as never);

    const handler = capturedHandlers.get("chat:load") as () => unknown[];

    const result = handler();
    expect(Array.isArray(result)).toBe(true);
  });

  it("should clear chat messages", async () => {
    const { registerChatHandlers } = await import("../ipc/chat");
    const ctx = {
      logger: {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        errorWithStack: vi.fn(),
      },
    };
    registerChatHandlers(ctx as never);

    const handler = capturedHandlers.get("chat:clear") as () => boolean;

    const result = handler();
    expect(result).toBe(true);
  });

  it("should export chat as markdown", async () => {
    const { registerChatHandlers } = await import("../ipc/chat");
    const { saveChatHistory } = await import("../config");
    const ctx = {
      logger: {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        errorWithStack: vi.fn(),
      },
    };
    registerChatHandlers(ctx as never);

    saveChatHistory([
      { id: "1", role: "user", text: "Hello", timestamp: 12345 },
      {
        id: "2",
        role: "assistant",
        text: "Hi",
        timestamp: 12346,
        provider: "gemini",
      },
    ]);

    const handler = capturedHandlers.get("chat:export") as (
      _event: unknown,
      format: string,
    ) => string;

    const result = handler(null, "markdown");
    expect(result).toContain("# Gaming Copilot Chat History");
    expect(result).toContain("## User");
    expect(result).toContain("## Assistant");
  });

  it("should export chat as json", async () => {
    const { registerChatHandlers } = await import("../ipc/chat");
    const ctx = {
      logger: {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        errorWithStack: vi.fn(),
      },
    };
    registerChatHandlers(ctx as never);

    const handler = capturedHandlers.get("chat:export") as (
      _event: unknown,
      format: string,
    ) => string;

    const result = handler(null, "json");
    expect(() => JSON.parse(result)).not.toThrow();
  });

  it("should reject invalid chat format", async () => {
    const { registerChatHandlers } = await import("../ipc/chat");
    const ctx = {
      logger: {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        errorWithStack: vi.fn(),
      },
    };
    registerChatHandlers(ctx as never);

    const handler = capturedHandlers.get("chat:export") as (
      _event: unknown,
      format: string,
    ) => string;

    expect(() => handler(null, "csv")).toThrow("IPC validation failed");
  });
});
