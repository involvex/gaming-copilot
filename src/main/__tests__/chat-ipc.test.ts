import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCtx, createTestLogger, getCapturedHandlers, resetIpcTestState } from "./helpers";

describe("ipc/chat handlers", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    resetIpcTestState();
    const { initConfig, initChatStore } = await import("../config");
    initConfig();
    initChatStore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const makeCtx = (): Record<string, unknown> =>
    createCtx({
      logger: { ...createTestLogger(), debug: vi.fn() },
    });

  it("should save chat messages", async () => {
    const { registerChatHandlers } = await import("../ipc/chat");
    const ctx = makeCtx();
    registerChatHandlers(ctx as never);

    const handler = getCapturedHandlers().get("chat:save") as (
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
    const ctx = makeCtx();
    registerChatHandlers(ctx as never);

    const handler = getCapturedHandlers().get("chat:load") as () => unknown[];

    const result = handler();
    expect(Array.isArray(result)).toBe(true);
  });

  it("should clear chat messages", async () => {
    const { registerChatHandlers } = await import("../ipc/chat");
    const ctx = makeCtx();
    registerChatHandlers(ctx as never);

    const handler = getCapturedHandlers().get("chat:clear") as () => boolean;

    const result = handler();
    expect(result).toBe(true);
  });

  it("should export chat as markdown", async () => {
    const { registerChatHandlers } = await import("../ipc/chat");
    const { saveChatHistory } = await import("../config");
    const ctx = makeCtx();
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

    const handler = getCapturedHandlers().get("chat:export") as (
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
    const ctx = makeCtx();
    registerChatHandlers(ctx as never);

    const handler = getCapturedHandlers().get("chat:export") as (
      _event: unknown,
      format: string,
    ) => string;

    const result = handler(null, "json");
    expect(() => JSON.parse(result)).not.toThrow();
  });

  it("should reject invalid chat format", async () => {
    const { registerChatHandlers } = await import("../ipc/chat");
    const ctx = makeCtx();
    registerChatHandlers(ctx as never);

    const handler = getCapturedHandlers().get("chat:export") as (
      _event: unknown,
      format: string,
    ) => string;

    expect(() => handler(null, "csv")).toThrow("IPC validation failed");
  });
});
