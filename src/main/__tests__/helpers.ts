import { vi } from "vitest";
import { getSharedState } from "./setup";

export function getMockStore(): Record<string, unknown> {
  return getSharedState().mockStore;
}

export function getCapturedHandlers(): Map<string, (...args: unknown[]) => unknown> {
  return getSharedState().capturedHandlers;
}

export function resetIpcTestState(): void {
  const state = getSharedState();
  state.capturedHandlers.clear();
  for (const key of Object.keys(state.mockStore)) {
    delete state.mockStore[key];
  }
}

export function createTestLogger(): {
  info: ReturnType<typeof vi.fn>;
  warn: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
  errorWithStack: ReturnType<typeof vi.fn>;
} {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    errorWithStack: vi.fn(),
  };
}

export function createCtx(
  base: Record<string, unknown>,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return { ...base, ...overrides };
}
