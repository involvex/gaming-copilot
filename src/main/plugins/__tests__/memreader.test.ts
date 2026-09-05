import { type ChildProcess, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemreaderPlugin } from "../memreader";

vi.mock("../logger", () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    errorWithStack: vi.fn(),
  },
}));

vi.mock("node:child_process", () => ({
  spawn: vi.fn(),
}));

vi.mock("node:fs", () => ({
  existsSync: vi.fn(() => true),
}));

vi.mock("node:path", () => ({
  join: vi.fn((...args: string[]) => args.join("/")),
}));

const spawnMock = vi.mocked(spawn);
const existsSyncMock = vi.mocked(existsSync);

describe("MemreaderPlugin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // NB: vitest has no `doNotFake` option — everything (including
    // setTimeout) is faked, matching the suite's actual runtime behavior.
    vi.useFakeTimers();
    existsSyncMock.mockReturnValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function makeMockChild() {
    return {
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: vi.fn((_event: string, _cb: (...args: unknown[]) => void) => {}),
      kill: vi.fn(),
    };
  }

  async function startPlugin(plugin: MemreaderPlugin): Promise<void> {
    const promise = plugin.start();
    vi.advanceTimersByTime(1500);
    await promise;
    await vi.waitFor(() => {
      expect(plugin.isConnected()).toBe(true);
    });
  }

  describe("constructor", () => {
    it("should initialize with config", () => {
      const plugin = new MemreaderPlugin({
        enabled: true,
        port: 31337,
        autoStart: false,
      });

      expect(plugin.isConnected()).toBe(false);
    });

    it("should return default state initially", () => {
      const plugin = new MemreaderPlugin({
        enabled: false,
        port: 31337,
        autoStart: false,
      });

      expect(plugin.getState()).toEqual({
        hp: 0,
        mp: 0,
        level: 0,
        mapName: "",
        className: "",
        pos: { x: 0, y: 0, z: 0 },
        targets: [],
        timestamp: 0,
      });
    });
  });

  describe("start", () => {
    it("should not start if already running", async () => {
      const plugin = new MemreaderPlugin({
        enabled: true,
        port: 31337,
        autoStart: false,
      });

      const mockChild = makeMockChild();
      spawnMock.mockReturnValue(mockChild as unknown as ChildProcess);

      await startPlugin(plugin);
      expect(spawnMock).toHaveBeenCalledTimes(1);

      await plugin.start();
      expect(spawnMock).toHaveBeenCalledTimes(1);
    });

    it("should not start if disabled", async () => {
      const plugin = new MemreaderPlugin({
        enabled: false,
        port: 31337,
        autoStart: false,
      });

      await plugin.start();
      expect(spawnMock).not.toHaveBeenCalled();
    });

    it("should not start if bin not found", async () => {
      existsSyncMock.mockReturnValue(false);

      const plugin = new MemreaderPlugin({
        enabled: true,
        port: 31337,
        autoStart: false,
      });

      await plugin.start();
      expect(spawnMock).not.toHaveBeenCalled();
    });

    it("should spawn bun process with correct args", async () => {
      const plugin = new MemreaderPlugin({
        enabled: true,
        port: 31337,
        autoStart: false,
      });

      const mockChild = makeMockChild();
      spawnMock.mockReturnValue(mockChild as unknown as ChildProcess);

      await startPlugin(plugin);

      expect(spawnMock).toHaveBeenCalledWith(
        "bun",
        ["run", expect.any(String), "serve", "31337"],
        expect.objectContaining({ detached: false }),
      );
    });

    it("should set up stdout/stderr handlers", async () => {
      const plugin = new MemreaderPlugin({
        enabled: true,
        port: 31337,
        autoStart: false,
      });

      const mockChild = makeMockChild();
      spawnMock.mockReturnValue(mockChild as unknown as ChildProcess);

      await startPlugin(plugin);

      expect(mockChild.stdout?.on).toHaveBeenCalledWith("data", expect.any(Function));
      expect(mockChild.stderr?.on).toHaveBeenCalledWith("data", expect.any(Function));
      expect(mockChild.on).toHaveBeenCalledWith("exit", expect.any(Function));
    });

    it("should start polling after server starts", async () => {
      const plugin = new MemreaderPlugin({
        enabled: true,
        port: 31337,
        autoStart: false,
      });

      const mockChild = makeMockChild();
      spawnMock.mockReturnValue(mockChild as unknown as ChildProcess);

      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ hp: 100, mp: 50, level: 5 }),
      } as unknown as Response);

      await startPlugin(plugin);
      vi.advanceTimersByTime(2000);
      await Promise.resolve();
      await Promise.resolve();

      expect(fetchSpy).toHaveBeenCalledWith("http://localhost:31337/api/state");

      fetchSpy.mockRestore();
    });
  });

  describe("stop", () => {
    it("should kill process and reset state", async () => {
      const plugin = new MemreaderPlugin({
        enabled: true,
        port: 31337,
        autoStart: false,
      });

      const mockChild = makeMockChild();
      spawnMock.mockReturnValue(mockChild as unknown as ChildProcess);

      await startPlugin(plugin);
      plugin.stop();

      expect(mockChild.kill).toHaveBeenCalled();
      expect(plugin.isConnected()).toBe(false);
    });

    it("should reset state to defaults", async () => {
      const plugin = new MemreaderPlugin({
        enabled: true,
        port: 31337,
        autoStart: false,
      });

      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            hp: 100,
            mp: 50,
            level: 5,
            mapName: "TestMap",
            className: "Warrior",
          }),
      } as unknown as Response);

      const mockChild = makeMockChild();
      spawnMock.mockReturnValue(mockChild as unknown as ChildProcess);

      await startPlugin(plugin);
      vi.advanceTimersByTime(2000);
      await Promise.resolve();
      await Promise.resolve();

      expect(plugin.getState().hp).toBe(100);
      expect(plugin.getState().mapName).toBe("TestMap");

      plugin.stop();

      const afterStop = plugin.getState();
      expect(afterStop.hp).toBe(0);
      expect(afterStop.mapName).toBe("");

      fetchSpy.mockRestore();
    });

    it("should handle stop when not started", () => {
      const plugin = new MemreaderPlugin({
        enabled: true,
        port: 31337,
        autoStart: false,
      });

      expect(() => plugin.stop()).not.toThrow();
    });
  });

  describe("getState", () => {
    it("should return current state", () => {
      const plugin = new MemreaderPlugin({
        enabled: false,
        port: 31337,
        autoStart: false,
      });

      expect(plugin.getState()).toEqual({
        hp: 0,
        mp: 0,
        level: 0,
        mapName: "",
        className: "",
        pos: { x: 0, y: 0, z: 0 },
        targets: [],
        timestamp: 0,
      });
    });

    it("should update state after fetch", async () => {
      const plugin = new MemreaderPlugin({
        enabled: true,
        port: 31337,
        autoStart: false,
      });

      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            hp: 100,
            mp: 50,
            level: 7,
            mapName: "Aeternum",
            className: "Archer",
            pos: { x: 10.5, y: 20.3, z: 5.0 },
            targets: [{ name: "Goblin", hp: 30, distance: 5 }],
          }),
      } as unknown as Response);

      const mockChild = makeMockChild();
      spawnMock.mockReturnValue(mockChild as unknown as ChildProcess);

      await startPlugin(plugin);
      vi.advanceTimersByTime(2000);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      const state = plugin.getState();
      expect(state.hp).toBe(100);
      expect(state.mp).toBe(50);
      expect(state.level).toBe(7);
      expect(state.mapName).toBe("Aeternum");
      expect(state.className).toBe("Archer");
      expect(state.pos).toEqual({ x: 10.5, y: 20.3, z: 5.0 });
      expect(state.targets).toHaveLength(1);
      expect(state.targets[0]?.name).toBe("Goblin");

      fetchSpy.mockRestore();
    });
  });

  describe("setOnStateChange", () => {
    it("should register callback", () => {
      const plugin = new MemreaderPlugin({
        enabled: false,
        port: 31337,
        autoStart: false,
      });

      const callback = vi.fn();
      plugin.setOnStateChange(callback);

      expect(callback).not.toHaveBeenCalled();
    });

    it("should call callback when state changes", async () => {
      const plugin = new MemreaderPlugin({
        enabled: true,
        port: 31337,
        autoStart: false,
      });

      const callback = vi.fn();
      plugin.setOnStateChange(callback);

      vi.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ hp: 100, mp: 50 }),
      } as unknown as Response);

      const mockChild = makeMockChild();
      spawnMock.mockReturnValue(mockChild as unknown as ChildProcess);

      await startPlugin(plugin);
      vi.advanceTimersByTime(2000);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      expect(callback).toHaveBeenCalled();
      expect(callback).toHaveBeenCalledWith(expect.objectContaining({ hp: 100 }));
    });
  });

  describe("updateConfig", () => {
    it("should start when enabled is set to true and not running", async () => {
      const plugin = new MemreaderPlugin({
        enabled: false,
        port: 31337,
        autoStart: false,
      });

      const mockChild = makeMockChild();
      spawnMock.mockReturnValue(mockChild as unknown as ChildProcess);

      plugin.updateConfig({ enabled: true });

      vi.advanceTimersByTime(1500);
      await Promise.resolve();

      expect(spawnMock).toHaveBeenCalled();
    });

    it("should stop when enabled is set to false and running", async () => {
      const plugin = new MemreaderPlugin({
        enabled: true,
        port: 31337,
        autoStart: false,
      });

      const mockChild = makeMockChild();
      spawnMock.mockReturnValue(mockChild as unknown as ChildProcess);

      await startPlugin(plugin);
      expect(plugin.isConnected()).toBe(true);

      plugin.updateConfig({ enabled: false });
      expect(plugin.isConnected()).toBe(false);
      expect(mockChild.kill).toHaveBeenCalled();
    });

    it("should restart polling when port changes", async () => {
      const plugin = new MemreaderPlugin({
        enabled: true,
        port: 31337,
        autoStart: false,
      });

      const mockChild = makeMockChild();
      spawnMock.mockReturnValue(mockChild as unknown as ChildProcess);

      vi.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ hp: 100 }),
      } as unknown as Response);

      await startPlugin(plugin);

      plugin.updateConfig({ port: 31338 });

      expect(plugin.isConnected()).toBe(true);
    });
  });

  describe("isConnected", () => {
    it("should return false initially", () => {
      const plugin = new MemreaderPlugin({
        enabled: false,
        port: 31337,
        autoStart: false,
      });

      expect(plugin.isConnected()).toBe(false);
    });

    it("should return true when process is set", async () => {
      const plugin = new MemreaderPlugin({
        enabled: true,
        port: 31337,
        autoStart: false,
      });

      const mockChild = makeMockChild();
      spawnMock.mockReturnValue(mockChild as unknown as ChildProcess);

      await startPlugin(plugin);
      expect(plugin.isConnected()).toBe(true);
    });
  });

  describe("parseState", () => {
    it("should handle empty/null/undefined values gracefully", async () => {
      const plugin = new MemreaderPlugin({
        enabled: true,
        port: 31337,
        autoStart: false,
      });

      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            hp: null,
            mp: undefined,
            level: 0,
          }),
      } as unknown as Response);

      const mockChild = makeMockChild();
      spawnMock.mockReturnValue(mockChild as unknown as ChildProcess);

      await startPlugin(plugin);
      vi.advanceTimersByTime(2000);
      await Promise.resolve();
      await Promise.resolve();

      const state = plugin.getState();
      expect(state.hp).toBe(0);
      expect(state.mp).toBe(0);
      expect(state.level).toBe(0);

      fetchSpy.mockRestore();
    });

    it("should handle missing targets array", async () => {
      const plugin = new MemreaderPlugin({
        enabled: true,
        port: 31337,
        autoStart: false,
      });

      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            hp: 100,
            mp: 50,
          }),
      } as unknown as Response);

      const mockChild = makeMockChild();
      spawnMock.mockReturnValue(mockChild as unknown as ChildProcess);

      await startPlugin(plugin);
      vi.advanceTimersByTime(2000);
      await Promise.resolve();
      await Promise.resolve();

      expect(plugin.getState().targets).toEqual([]);

      fetchSpy.mockRestore();
    });

    it("should handle malformed targets", async () => {
      const plugin = new MemreaderPlugin({
        enabled: true,
        port: 31337,
        autoStart: false,
      });

      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            hp: 100,
            targets: [
              { name: "Goblin", hp: 30, distance: 5 },
              { name: "", hp: null, distance: undefined },
            ],
          }),
      } as unknown as Response);

      const mockChild = makeMockChild();
      spawnMock.mockReturnValue(mockChild as unknown as ChildProcess);

      await startPlugin(plugin);
      vi.advanceTimersByTime(2000);
      await Promise.resolve();
      await Promise.resolve();

      const targets = plugin.getState().targets;
      expect(targets).toHaveLength(2);
      expect(targets[0]?.name).toBe("Goblin");
      expect(targets[0]?.hp).toBe(30);
      expect(targets[1]?.name).toBe("");
      expect(targets[1]?.hp).toBe(0);

      fetchSpy.mockRestore();
    });
  });
});
