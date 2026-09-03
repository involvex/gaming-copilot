import { describe, expect, it } from "vitest";
import type { AppConfig } from "../../shared/types";

function redactProviders(config: AppConfig["providers"]): AppConfig["providers"] {
  const safe = { gemini: undefined, openaiCompat: undefined };
  if (config.gemini) {
    safe.gemini = { ...config.gemini, apiKey: "[REDACTED]" };
  }
  if (config.openaiCompat?.endpoints) {
    safe.openaiCompat = {
      endpoints: config.openaiCompat.endpoints.map((ep) => ({
        ...ep,
        apiKey: "[REDACTED]",
      })),
    };
  }
  return safe;
}

function exportConfig(config: AppConfig): AppConfig {
  const safeCopy = JSON.parse(JSON.stringify(config)) as AppConfig;
  safeCopy.providers = redactProviders(config.providers);
  return safeCopy;
}

describe("config export — API key redaction", () => {
  it("should redact gemini apiKey in exported config", () => {
    const config: AppConfig = {
      hotkey: "ctrl+g",
      saveScreenshots: false,
      screenshotDir: null,
      providers: {
        gemini: {
          apiKey: "super-secret-key",
          model: "gemini-2.5-flash",
          grounding: true,
        },
      },
      overlay: {
        position: "bottom-right",
        duration: 8000,
        opacity: 0.9,
        fontSize: 14,
        theme: "dark",
        clickThrough: true,
        customCSS: "",
      },
      overlayCustomTheme: {
        backgroundColor: "#111827",
        textColor: "#ffffff",
        borderRadius: 8,
        padding: 16,
        borderColor: "#374151",
      },
    } as unknown as AppConfig;

    const exported = exportConfig(config);

    expect(exported.providers.gemini?.apiKey).toBe("[REDACTED]");
    expect(exported.providers.gemini?.model).toBe("gemini-2.5-flash");
    expect(exported.providers.gemini?.grounding).toBe(true);
  });

  it("should redact openaiCompat endpoint apiKey in exported config", () => {
    const config: AppConfig = {
      hotkey: "ctrl+g",
      saveScreenshots: false,
      screenshotDir: null,
      providers: {
        openaiCompat: {
          endpoints: [
            {
              name: "Zen",
              baseUrl: "https://api.zen.com",
              apiKey: "secret-zen-key",
              model: "gpt-4",
            },
            {
              name: "Kilo",
              baseUrl: "https://api.kilo.com",
              apiKey: "secret-kilo-key",
              model: "deepseek-coder",
            },
          ],
        },
      },
      overlay: {
        position: "bottom-right",
        duration: 8000,
        opacity: 0.9,
        fontSize: 14,
        theme: "dark",
        clickThrough: true,
        customCSS: "",
      },
      overlayCustomTheme: {
        backgroundColor: "#111827",
        textColor: "#ffffff",
        borderRadius: 8,
        padding: 16,
        borderColor: "#374151",
      },
    } as unknown as AppConfig;

    const exported = exportConfig(config);

    expect(exported.providers.openaiCompat?.endpoints[0]?.apiKey).toBe("[REDACTED]");
    expect(exported.providers.openaiCompat?.endpoints[1]?.apiKey).toBe("[REDACTED]");
    expect(exported.providers.openaiCompat?.endpoints[0]?.name).toBe("Zen");
    expect(exported.providers.openaiCompat?.endpoints[1]?.model).toBe("deepseek-coder");
  });

  it("should preserve non-sensitive fields in exported config", () => {
    const config: AppConfig = {
      hotkey: "ctrl+shift+g",
      hotkeyEnabled: true,
      captureQuality: 95,
      maxImageWidth: 512,
      monitorIndex: 1,
      captureMode: "auto",
      saveScreenshots: true,
      screenshotDir: "C:\\Screenshots",
      gameExe: "Neuz.exe",
      activeProvider: "gemini",
      theme: "dark",
      minimizeToTray: true,
      notifications: false,
      ocr: { enabled: true, language: "eng+osd" },
      recordDuration: 15,
      telemetry: { enabled: true },
      providers: {},
      overlay: {
        position: "top-right",
        duration: 10000,
        opacity: 0.8,
        fontSize: 16,
        theme: "light",
        clickThrough: false,
        customCSS: ".overlay-text { font-weight: bold; }",
      },
      overlayCustomTheme: {
        backgroundColor: "#ffffff",
        textColor: "#000000",
        borderRadius: 12,
        padding: 20,
        borderColor: "#cccccc",
      },
      tts: {
        enabled: true,
        voice: "en-US",
        rate: 1.2,
        pitch: 0.9,
        volume: 0.5,
      },
      prompts: { system: "Be helpful.", gameSpecific: {} },
    } as unknown as AppConfig;

    const exported = exportConfig(config);

    expect(exported.hotkey).toBe("ctrl+shift+g");
    expect(exported.captureQuality).toBe(95);
    expect(exported.saveScreenshots).toBe(true);
    expect(exported.screenshotDir).toBe("C:\\Screenshots");
    expect(exported.ocr).toEqual({ enabled: true, language: "eng+osd" });
    expect(exported.overlay.customCSS).toBe(".overlay-text { font-weight: bold; }");
    expect(exported.overlay.theme).toBe("light");
  });

  it("should handle config with no providers gracefully", () => {
    const config: AppConfig = {
      hotkey: "ctrl+g",
      saveScreenshots: false,
      screenshotDir: null,
      providers: {},
      overlay: {
        position: "bottom-right",
        duration: 8000,
        opacity: 0.9,
        fontSize: 14,
        theme: "dark",
        clickThrough: true,
        customCSS: "",
      },
      overlayCustomTheme: {
        backgroundColor: "#111827",
        textColor: "#ffffff",
        borderRadius: 8,
        padding: 16,
        borderColor: "#374151",
      },
    } as unknown as AppConfig;

    const exported = exportConfig(config);

    expect(exported.providers.gemini).toBeUndefined();
    expect(exported.providers.openaiCompat).toBeUndefined();
  });
});
