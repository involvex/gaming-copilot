import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppConfig } from "../../../shared/types";
import { ProviderManager } from "../index";
import type {
  AIProvider,
  AIResponse,
  OpenAICompatConfig,
  RateLimitInfo,
  StreamChunk,
} from "../types";

const DEFAULT_RATE_LIMIT: RateLimitInfo = {
  rpm: 60,
  rpd: 10000,
  remaining: { minute: 60, day: 10000 },
};

class MockProvider implements AIProvider {
  readonly name: string;
  readonly displayName = "Mock";
  private _failAnalyze = false;
  private _failStream = false;
  private _rateLimit: RateLimitInfo = DEFAULT_RATE_LIMIT;

  constructor(name: string) {
    this.name = name;
  }

  setFailAnalyze(fail: boolean) {
    this._failAnalyze = fail;
  }

  setFailStream(fail: boolean) {
    this._failStream = fail;
  }

  setRateLimit(rl: RateLimitInfo) {
    this._rateLimit = rl;
  }

  isConfigured(): boolean {
    return true;
  }

  getRateLimitInfo(): RateLimitInfo {
    this.resetCountersIfNeeded();
    return this._rateLimit;
  }

  getModel(): string {
    return `${this.name}-model`;
  }

  private requestCount = { minute: 0, day: 0 };
  private lastMinuteReset = Date.now();
  private lastDayReset = Date.now();

  private resetCountersIfNeeded(): void {
    const now = Date.now();
    if (now - this.lastMinuteReset > 60_000) {
      this.requestCount.minute = 0;
      this.lastMinuteReset = now;
    }
    if (now - this.lastDayReset > 86_400_000) {
      this.requestCount.day = 0;
      this.lastDayReset = now;
    }
  }

  async analyze(): Promise<AIResponse> {
    if (this._failAnalyze) {
      throw new Error(`${this.name} analyze failed`);
    }
    this.resetCountersIfNeeded();
    this.requestCount.minute++;
    this.requestCount.day++;
    return {
      text: `analyze response from ${this.name}`,
      provider: this.name,
      model: "test-model",
      tokens: { input: 10, output: 20 },
      latencyMs: 100,
      timestamp: Date.now(),
    };
  }

  async *streamAnalyze(): AsyncGenerator<StreamChunk> {
    if (this._failStream) {
      throw new Error(`${this.name} stream failed`);
    }
    yield { text: `stream chunk from ${this.name}`, done: false };
    yield { text: "", done: true };
  }
}

vi.mock("../gemini", () => {
  return {
    GeminiProvider: vi.fn().mockImplementation(() => new MockProvider("gemini")),
  };
});

vi.mock("../openai-compat", () => {
  return {
    OpenAICompatProvider: vi
      .fn()
      .mockImplementation((config: OpenAICompatConfig) => new MockProvider(config.name)),
  };
});

function makeConfig(providerNames: string[]): AppConfig {
  return {
    hotkey: "CommandOrControl+Shift+G",
    autoStart: false,
    minimizeToTray: true,
    notifications: true,
    theme: "dark",
    gameExe: "",
    captureQuality: 85,
    maxImageWidth: 1024,
    hotkeyEnabled: true,
    monitorIndex: 0,
    captureMode: "auto",
    providers: {
      gemini: {
        apiKey: "test-key",
        model: "gemini-2.5-flash",
        grounding: true,
      },
      openaiCompat: {
        endpoints: providerNames.map((name) => ({
          name,
          baseUrl: "http://localhost:8080",
          apiKey: "key",
          model: "gpt-4",
        })),
      },
    },
    activeProvider: providerNames[0] ?? "gemini",
    useKeychain: true,
    overlay: {
      position: "bottom-right",
      duration: 8000,
      opacity: 0.9,
      fontSize: 14,
      theme: "dark",
      clickThrough: true,
    },
    overlayCustomTheme: {
      backgroundColor: "#111827",
      textColor: "#ffffff",
      borderRadius: 8,
      padding: 16,
      borderColor: "#374151",
    },
    tts: { enabled: false, voice: "", rate: 1.0, pitch: 1.0, volume: 0.8 },
    plugins: {
      bunMemreader: { enabled: false, port: 31337, autoStart: false },
    },
    ocr: { enabled: true, language: "eng" },
    recordDuration: 10,
    telemetry: { enabled: false },
    prompts: { system: "test", gameSpecific: {} },
  };
}

describe("ProviderManager", () => {
  let manager: ProviderManager;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("constructor and provider registration", () => {
    it("should initialize providers from config", () => {
      const config = makeConfig(["openai1", "openai2"]);
      manager = new ProviderManager(config);

      const available = manager.getAvailableProviders();
      expect(available).toHaveLength(3);
      expect(available.map((p) => p.name)).toContain("gemini");
      expect(available.map((p) => p.name)).toContain("openai1");
      expect(available.map((p) => p.name)).toContain("openai2");
    });

    it("should not register gemini when apiKey is empty", () => {
      const config = makeConfig([]);
      config.providers.gemini!.apiKey = "";
      manager = new ProviderManager(config);

      const available = manager.getAvailableProviders();
      expect(available).toHaveLength(0);
    });

    it("should select active provider first in analyze", async () => {
      const config = makeConfig(["openai1", "openai2"]);
      config.activeProvider = "openai2";
      manager = new ProviderManager(config);

      const openaiProvider1 = manager.getProvider("openai1") as unknown as MockProvider;
      const openaiProvider2 = manager.getProvider("openai2") as unknown as MockProvider;

      expect(openaiProvider1).toBeDefined();
      expect(openaiProvider2).toBeDefined();
      expect(openaiProvider1?.name).toBe("openai1");
      expect(openaiProvider2?.name).toBe("openai2");

      const result = await manager.analyze("base64-data", "image/png", "system", "message");
      expect(result.provider).toBeDefined();
    });
  });

  describe("getProvider", () => {
    it("should return provider by name", () => {
      const config = makeConfig(["openai1"]);
      manager = new ProviderManager(config);

      const provider = manager.getProvider("gemini");
      expect(provider).toBeDefined();
      expect(provider?.name).toBe("gemini");
    });

    it("should return undefined for unknown provider", () => {
      const config = makeConfig([]);
      manager = new ProviderManager(config);

      expect(manager.getProvider("nonexistent")).toBeUndefined();
    });
  });

  describe("setActiveProvider", () => {
    it("should change active provider", () => {
      const config = makeConfig(["openai1"]);
      manager = new ProviderManager(config);

      manager.setActiveProvider("openai1");
      expect(manager.getProvider("openai1")).toBeDefined();
    });
  });

  describe("analyze", () => {
    it("should throw if no providers are configured", async () => {
      const config = makeConfig([]);
      config.providers.gemini!.apiKey = "";
      manager = new ProviderManager(config);

      await expect(manager.analyze("img", "image/png", "sys", "msg")).rejects.toThrow(
        "No AI providers configured",
      );
    });

    it("should skip rate-limited providers", async () => {
      const config = makeConfig(["openai1"]);
      manager = new ProviderManager(config);

      const geminiProvider = manager.getProvider("gemini") as unknown as MockProvider;

      if (geminiProvider) {
        geminiProvider.setRateLimit({
          rpm: 60,
          rpd: 10000,
          remaining: { minute: 0, day: 0 },
        });
      }

      const result = await manager.analyze("img", "image/png", "sys", "msg");
      expect(result.provider).toBe("openai1");
    });

    it("should throw if all providers fail", async () => {
      const config = makeConfig([]);
      manager = new ProviderManager(config);

      const geminiProvider = manager.getProvider("gemini") as unknown as MockProvider;
      if (geminiProvider) {
        geminiProvider.setFailAnalyze(true);
      }

      await expect(manager.analyze("img", "image/png", "sys", "msg")).rejects.toThrow(
        "All AI providers failed",
      );
    });
  });

  describe("caching", () => {
    it("should return cached response on second call", async () => {
      const config = makeConfig([]);
      manager = new ProviderManager(config);

      const geminiProvider = manager.getProvider("gemini") as unknown as MockProvider;
      const analyzeSpy = vi.spyOn(geminiProvider, "analyze");

      await manager.analyze("img", "image/png", "sys", "msg");
      await manager.analyze("img", "image/png", "sys", "msg");

      expect(analyzeSpy).toHaveBeenCalledTimes(1);
    });

    it("should expire cache after TTL", async () => {
      const config = makeConfig([]);
      manager = new ProviderManager(config);

      const geminiProvider = manager.getProvider("gemini") as unknown as MockProvider;
      const analyzeSpy = vi.spyOn(geminiProvider, "analyze");

      await manager.analyze("img", "image/png", "sys", "msg");
      expect(analyzeSpy).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(59_000);
      await manager.analyze("img", "image/png", "sys", "msg");
      expect(analyzeSpy).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(2_000);
      await manager.analyze("img", "image/png", "sys", "msg");
      expect(analyzeSpy).toHaveBeenCalledTimes(2);
    });

    it("should not cache different system prompts", async () => {
      const config = makeConfig([]);
      manager = new ProviderManager(config);

      const geminiProvider = manager.getProvider("gemini") as unknown as MockProvider;
      const analyzeSpy = vi.spyOn(geminiProvider, "analyze");

      await manager.analyze("img", "image/png", "sys1", "msg");
      await manager.analyze("img", "image/png", "sys2", "msg");

      expect(analyzeSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe("clearCache", () => {
    it("should clear the cache", async () => {
      const config = makeConfig([]);
      manager = new ProviderManager(config);

      const geminiProvider = manager.getProvider("gemini") as unknown as MockProvider;
      const analyzeSpy = vi.spyOn(geminiProvider, "analyze");

      await manager.analyze("img", "image/png", "sys", "msg");
      manager.clearCache();
      await manager.analyze("img", "image/png", "sys", "msg");

      expect(analyzeSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe("testProvider", () => {
    it("should return true for a working provider", async () => {
      const config = makeConfig([]);
      manager = new ProviderManager(config);

      const result = await manager.testProvider("gemini");
      expect(result).toBe(true);
    });

    it("should return false for a failing provider", async () => {
      const config = makeConfig([]);
      manager = new ProviderManager(config);

      const geminiProvider = manager.getProvider("gemini") as unknown as MockProvider;
      if (geminiProvider) {
        geminiProvider.setFailAnalyze(true);
      }

      const result = await manager.testProvider("gemini");
      expect(result).toBe(false);
    });

    it("should return false for unknown provider", async () => {
      const config = makeConfig([]);
      manager = new ProviderManager(config);

      const result = await manager.testProvider("nonexistent");
      expect(result).toBe(false);
    });
  });

  describe("getActiveProviderInfo", () => {
    it("should return display name and model for active provider", () => {
      const config = makeConfig(["openai1"]);
      manager = new ProviderManager(config);

      const info = manager.getActiveProviderInfo();
      expect(info).toEqual({ displayName: "Mock", model: "openai1-model" });
    });

    it("should return undefined when provider is not configured", () => {
      const config = makeConfig([]);
      config.providers.gemini!.apiKey = "";
      manager = new ProviderManager(config);

      expect(manager.getActiveProviderInfo()).toBeUndefined();
    });
  });

  describe("getActiveProviderName", () => {
    it("should return the name of the active provider", () => {
      const config = makeConfig(["openai1"]);
      manager = new ProviderManager(config);

      expect(manager.getActiveProviderName()).toBe("openai1");
    });
  });

  describe("streamAnalyze", () => {
    it("should yield cached response on cache hit", async () => {
      const config = makeConfig([]);
      manager = new ProviderManager(config);

      const geminiProvider = manager.getProvider("gemini") as unknown as MockProvider;
      const streamSpy = vi.spyOn(geminiProvider, "streamAnalyze");

      await manager.analyze("img", "image/png", "sys", "msg");
      streamSpy.mockClear();

      const generator = manager.streamAnalyze("img", "image/png", "sys", "msg");
      const chunks: StreamChunk[] = [];
      for await (const chunk of generator) {
        chunks.push(chunk);
      }

      expect(chunks).toContainEqual({ text: expect.any(String), done: false });
      expect(chunks).toContainEqual({ text: "", done: true });
      expect(streamSpy).not.toHaveBeenCalled();
    });
  });
});
