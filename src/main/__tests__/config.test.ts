import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatMessage } from "../../shared/types";
import { resetIpcTestState } from "./helpers";

describe("config module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    resetIpcTestState();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("initConfig", () => {
    it("should initialize config and return store data", async () => {
      const { initConfig } = await import("../config");

      const config = initConfig();

      expect(config).toBeDefined();
      expect(config.hotkey).toBe("CommandOrControl+Shift+G");
      expect(config.captureQuality).toBe(85);
      expect(config.overlay.position).toBe("bottom-right");
    });
  });

  describe("getConfig", () => {
    it("should return config after init", async () => {
      const { initConfig, getConfig } = await import("../config");

      initConfig();
      const config = getConfig();

      expect(config).toBeDefined();
      expect(config.maxImageWidth).toBe(1024);
      expect(config.captureMode).toBe("auto");
      expect(config.activeProvider).toBe("gemini");
    });

    it("should return default config if not initialized", async () => {
      const { getConfig } = await import("../config");

      const config = getConfig();
      expect(config).toBeDefined();
      expect(config.captureQuality).toBe(85);
    });
  });

  describe("setConfigValue", () => {
    it("should set config value", async () => {
      const { initConfig, setConfigValue, getConfig } = await import("../config");

      initConfig();
      setConfigValue("captureQuality", 50);

      expect(getConfig().captureQuality).toBe(50);
    });

    it("should set gameExe value", async () => {
      const { initConfig, setConfigValue, getConfig } = await import("../config");

      initConfig();
      setConfigValue("gameExe", "Neuz.exe");

      expect(getConfig().gameExe).toBe("Neuz.exe");
    });

    it("should set captureMode value", async () => {
      const { initConfig, setConfigValue, getConfig } = await import("../config");

      initConfig();
      setConfigValue("captureMode", "fullscreen");

      expect(getConfig().captureMode).toBe("fullscreen");
    });

    it("should set activeProvider value", async () => {
      const { initConfig, setConfigValue, getConfig } = await import("../config");

      initConfig();
      setConfigValue("activeProvider", "custom-endpoint");

      expect(getConfig().activeProvider).toBe("custom-endpoint");
    });
  });

  describe("setPartialConfig", () => {
    it("should set multiple config values", async () => {
      const { initConfig, setPartialConfig, getConfig } = await import("../config");

      initConfig();
      setPartialConfig({ captureQuality: 60, maxImageWidth: 512 });

      expect(getConfig().captureQuality).toBe(60);
      expect(getConfig().maxImageWidth).toBe(512);
    });
  });

  describe("getConfigPath", () => {
    it("should return store path", async () => {
      const { initConfig, getConfigPath } = await import("../config");

      initConfig();
      const path = getConfigPath();

      expect(path).toBe("/fake/path/config.json");
    });

    it("should return empty string if not initialized", async () => {
      const { getConfigPath } = await import("../config");

      const path = getConfigPath();
      expect(path).toBe("");
    });
  });

  describe("chat store", () => {
    it("should initialize chat store", async () => {
      const { initConfig, initChatStore, getChatHistory } = await import("../config");

      initConfig();
      initChatStore();

      expect(getChatHistory()).toEqual([]);
    });

    it("should save and retrieve chat history", async () => {
      const { initConfig, initChatStore, saveChatHistory, getChatHistory } = await import(
        "../config"
      );

      initConfig();
      initChatStore();

      const messages: ChatMessage[] = [
        { id: "1", role: "user", text: "Hello", timestamp: 12345 },
        { id: "2", role: "assistant", text: "Hi there", timestamp: 12346 },
      ];

      saveChatHistory(messages);
      const history = getChatHistory();
      expect(history).toHaveLength(2);
      expect(history[0]?.text).toBe("Hello");
    });

    it("should clear chat history", async () => {
      const { initConfig, initChatStore, saveChatHistory, getChatHistory, clearChatHistory } =
        await import("../config");

      initConfig();
      initChatStore();

      const clearMessage: ChatMessage = {
        id: "1",
        role: "user",
        text: "Hello",
        timestamp: 12345,
      };
      saveChatHistory([clearMessage]);
      expect(getChatHistory()).toHaveLength(1);

      clearChatHistory();
      expect(getChatHistory()).toEqual([]);
    });
  });
});
