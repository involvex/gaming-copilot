import { describe, expect, it } from "vitest";
import type { AppConfig } from "../../shared/types";
import { exportConfigWithoutSecrets, isValidHotkeyFormat, redactProviders } from "../config-utils";

describe("isValidHotkeyFormat (pure, no Electron mock)", () => {
  it("should accept single modifiers and combos", () => {
    expect(isValidHotkeyFormat("CommandOrControl+Shift+G")).toBe(true);
    expect(isValidHotkeyFormat("CommandOrControl+Shift+X")).toBe(true);
    expect(isValidHotkeyFormat("F12")).toBe(true);
  });

  it("should reject accelerators with spaces", () => {
    expect(isValidHotkeyFormat("INVALID HOTKEY WITH SPACES")).toBe(false);
  });

  it("should reject empty strings", () => {
    expect(isValidHotkeyFormat("")).toBe(false);
  });
});

describe("redactProviders (pure, no Electron mock)", () => {
  it("should redact the gemini apiKey but keep other fields", () => {
    const result = redactProviders({
      gemini: {
        apiKey: "secret-key",
        model: "gemini-2.5-flash",
        grounding: true,
      },
    });

    expect(result.gemini?.apiKey).toBe("[REDACTED]");
    expect(result.gemini?.model).toBe("gemini-2.5-flash");
    expect(result.gemini?.grounding).toBe(true);
    expect(result.openaiCompat).toBeUndefined();
  });

  it("should redact every endpoint apiKey but keep names and models", () => {
    const result = redactProviders({
      openaiCompat: {
        endpoints: [
          {
            name: "Zen",
            baseUrl: "https://zen.example",
            apiKey: "a",
            model: "m1",
          },
          {
            name: "Kilo",
            baseUrl: "https://kilo.example",
            apiKey: "b",
            model: "m2",
          },
        ],
      },
    });

    expect(result.openaiCompat?.endpoints[0]?.apiKey).toBe("[REDACTED]");
    expect(result.openaiCompat?.endpoints[1]?.apiKey).toBe("[REDACTED]");
    expect(result.openaiCompat?.endpoints[0]?.name).toBe("Zen");
    expect(result.openaiCompat?.endpoints[1]?.model).toBe("m2");
    expect(result.gemini).toBeUndefined();
  });

  it("should handle empty provider maps", () => {
    const result = redactProviders({});

    expect(result.gemini).toBeUndefined();
    expect(result.openaiCompat).toBeUndefined();
  });
});

describe("exportConfigWithoutSecrets (pure, no Electron mock)", () => {
  it("should deep-copy the config with redacted keys", () => {
    const config = {
      hotkey: "ctrl+g",
      providers: {
        gemini: { apiKey: "super-secret", model: "m", grounding: false },
      },
    } as unknown as AppConfig;

    const exported = exportConfigWithoutSecrets(config);

    expect(exported.providers.gemini?.apiKey).toBe("[REDACTED]");
    expect(exported.hotkey).toBe("ctrl+g");
    expect(config.providers.gemini?.apiKey).toBe("super-secret");
  });
});
