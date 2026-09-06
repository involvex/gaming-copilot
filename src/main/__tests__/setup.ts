import { vi } from "vitest";

export interface SharedTestState {
  mockStore: Record<string, unknown>;
  capturedHandlers: Map<string, (...args: unknown[]) => unknown>;
}

export function getSharedState(): SharedTestState {
  const g = globalThis as unknown as {
    __gamingCopilotTestState?: SharedTestState;
  };
  let state = g.__gamingCopilotTestState;
  if (!state) {
    state = { mockStore: {}, capturedHandlers: new Map() };
    g.__gamingCopilotTestState = state;
  }
  return state;
}

// NOTE: the `vi.mock` factories below intentionally inline their
// `globalThis` state access instead of calling `getSharedState()`. Vitest
// hoists `vi.mock` calls above all file-level bindings, so referencing a
// file-level value inside a factory breaks mock setup. `globalThis` and
// `vi` are the only allowed outer references.

vi.mock("electron-store", () => {
  return {
    default: class MockStore {
      path = "/fake/path/config.json";
      store: Record<string, unknown> = {};

      constructor(opts?: { defaults?: Record<string, unknown> }) {
        this.store = opts?.defaults ? { ...opts.defaults } : {};
        const g = globalThis as unknown as {
          __gamingCopilotTestState?: {
            mockStore: Record<string, unknown>;
            capturedHandlers: Map<string, (...args: unknown[]) => unknown>;
          };
        };
        let state = g.__gamingCopilotTestState;
        if (!state) {
          state = { mockStore: {}, capturedHandlers: new Map() };
          g.__gamingCopilotTestState = state;
        }
        state.mockStore.path = this.path;
      }

      get(key: string, defaultValue?: unknown) {
        if (!(key in this.store)) return defaultValue;
        return this.store[key];
      }

      set(key: string, value: unknown) {
        this.store[key] = value;
        const g = globalThis as unknown as {
          __gamingCopilotTestState?: {
            mockStore: Record<string, unknown>;
          };
        };
        if (g.__gamingCopilotTestState) {
          g.__gamingCopilotTestState.mockStore[key] = value;
        }
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

// Superset electron mock: covers app + ipcMain (all IPC tests) plus the
// extras individual suites need (dialog for capture, shell/clipboard/
// nativeImage/screen for screenshots). Extra keys are harmless for suites
// that don't use them.
vi.mock("electron", () => {
  return {
    app: {
      getPath: vi.fn(() => "/fake/path"),
      isPackaged: false,
      setLoginItemSettings: vi.fn(),
    },
    dialog: {
      showOpenDialog: vi.fn(),
    },
    ipcMain: {
      handle: (_channel: string, handler: (...args: unknown[]) => unknown) => {
        const g = globalThis as unknown as {
          __gamingCopilotTestState?: {
            capturedHandlers: Map<string, (...args: unknown[]) => unknown>;
          };
        };
        let state = g.__gamingCopilotTestState;
        if (!state) {
          state = {
            capturedHandlers: new Map(),
          } as {
            capturedHandlers: Map<string, (...args: unknown[]) => unknown>;
          };
          g.__gamingCopilotTestState = state as unknown as {
            capturedHandlers: Map<string, (...args: unknown[]) => unknown>;
          };
        }
        state.capturedHandlers.set(_channel, handler);
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
    globalShortcut: {
      register: vi.fn(() => true),
      unregister: vi.fn(),
      unregisterAll: vi.fn(),
      isRegistered: vi.fn(() => false),
    },
  };
});
