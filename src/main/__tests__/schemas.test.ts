import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  booleanSchema,
  captureModeSchema,
  chatFormatSchema,
  chatMessageSchema,
  configImportSchema,
  endpointConfigSchema,
  exeNameSchema,
  gameEntrySchema,
  geminiProviderConfigSchema,
  hotkeySchema,
  overlayConfigSchema,
  promptsConfigSchema,
  providerNameSchema,
  regionBoundsSchema,
  ttsConfigSchema,
  validateIPC,
} from "../schemas";

describe("validateIPC", () => {
  it("should return parsed data for valid input", () => {
    const schema = z.string();
    const result = validateIPC(schema, "hello");
    expect(result).toBe("hello");
  });

  it("should throw for invalid input", () => {
    const schema = z.string();
    expect(() => validateIPC(schema, 123)).toThrow("IPC validation failed");
  });

  it("should throw a descriptive error message", () => {
    const schema = z.string().min(5);
    expect(() => validateIPC(schema, "hi")).toThrow(/IPC validation failed.*Too small/);
  });
});

describe("regionBoundsSchema", () => {
  it("should accept valid region bounds", () => {
    const result = validateIPC(regionBoundsSchema, {
      x: 0,
      y: 0,
      width: 1920,
      height: 1080,
    });
    expect(result).toEqual({ x: 0, y: 0, width: 1920, height: 1080 });
  });

  it("should reject negative coordinates", () => {
    expect(() => validateIPC(regionBoundsSchema, { x: -1, y: 0, width: 100, height: 100 })).toThrow(
      "IPC validation failed",
    );
  });

  it("should reject zero width", () => {
    expect(() => validateIPC(regionBoundsSchema, { x: 0, y: 0, width: 0, height: 100 })).toThrow(
      "IPC validation failed",
    );
  });

  it("should reject non-integer values", () => {
    expect(() =>
      validateIPC(regionBoundsSchema, {
        x: 1.5,
        y: 0,
        width: 100,
        height: 100,
      }),
    ).toThrow("IPC validation failed");
  });
});

describe("providerNameSchema", () => {
  it("should accept non-empty string", () => {
    expect(validateIPC(providerNameSchema, "gemini")).toBe("gemini");
  });

  it("should reject empty string", () => {
    expect(() => validateIPC(providerNameSchema, "")).toThrow("IPC validation failed");
  });

  it("should reject non-string", () => {
    expect(() => validateIPC(providerNameSchema, 123)).toThrow("IPC validation failed");
  });
});

describe("geminiProviderConfigSchema", () => {
  it("should accept valid config", () => {
    const result = validateIPC(geminiProviderConfigSchema, {
      apiKey: "test-key",
      model: "gemini-2.0-flash",
      grounding: true,
    });
    expect(result).toEqual({
      apiKey: "test-key",
      model: "gemini-2.0-flash",
      grounding: true,
    });
  });

  it("should accept empty object (all fields optional)", () => {
    const result = validateIPC(geminiProviderConfigSchema, {});
    expect(result).toEqual({});
  });

  it("should reject empty apiKey (must be non-empty if provided)", () => {
    expect(() => validateIPC(geminiProviderConfigSchema, { apiKey: "", model: "test" })).toThrow(
      "IPC validation failed",
    );
  });
});

describe("endpointConfigSchema", () => {
  it("should accept valid endpoint config", () => {
    const result = validateIPC(endpointConfigSchema, {
      baseUrl: "https://api.example.com",
      apiKey: "key-123",
      model: "gpt-4",
    });
    expect(result).toEqual({
      baseUrl: "https://api.example.com",
      apiKey: "key-123",
      model: "gpt-4",
    });
  });

  it("should reject invalid URL", () => {
    expect(() =>
      validateIPC(endpointConfigSchema, {
        baseUrl: "not-a-url",
        apiKey: "key",
      }),
    ).toThrow("IPC validation failed");
  });
});

describe("overlayConfigSchema", () => {
  it("should accept valid overlay config", () => {
    const result = validateIPC(overlayConfigSchema, {
      position: "bottom-right",
      duration: 5000,
      opacity: 0.8,
      fontSize: 16,
      theme: "dark",
      clickThrough: true,
    });
    expect(result).toEqual({
      position: "bottom-right",
      duration: 5000,
      opacity: 0.8,
      fontSize: 16,
      theme: "dark",
      clickThrough: true,
    });
  });

  it("should reject opacity out of range", () => {
    expect(() => validateIPC(overlayConfigSchema, { opacity: 1.5 })).toThrow(
      "IPC validation failed",
    );
  });

  it("should reject invalid position", () => {
    expect(() => validateIPC(overlayConfigSchema, { position: "center" })).toThrow(
      "IPC validation failed",
    );
  });

  it("should accept hacker overlay theme", () => {
    const result = validateIPC(overlayConfigSchema, {
      theme: "hacker",
    });
    expect(result.theme).toBe("hacker");
  });

  it("should accept monokai overlay theme", () => {
    const result = validateIPC(overlayConfigSchema, {
      theme: "monokai",
    });
    expect(result.theme).toBe("monokai");
  });

  it("should reject invalid overlay theme", () => {
    expect(() => validateIPC(overlayConfigSchema, { theme: "cyberpunk" })).toThrow(
      "IPC validation failed",
    );
  });

  it("should accept customCSS string", () => {
    const result = validateIPC(overlayConfigSchema, {
      customCSS: ".overlay-text { font-weight: bold; }",
    });
    expect(result.customCSS).toBe(".overlay-text { font-weight: bold; }");
  });

  it("should reject non-string customCSS", () => {
    expect(() => validateIPC(overlayConfigSchema, { customCSS: 123 })).toThrow(
      "IPC validation failed",
    );
  });

  it("should accept configImportSchema with arbitrary keys including saveScreenshots", () => {
    const result = validateIPC(configImportSchema, {
      saveScreenshots: true,
      screenshotDir: "C:\\Screenshots",
      captureQuality: 90,
    });
    expect(result.saveScreenshots).toBe(true);
    expect(result.screenshotDir).toBe("C:\\Screenshots");
  });

  it("should reject configImportSchema for non-object input", () => {
    expect(() => validateIPC(configImportSchema, "not an object")).toThrow("IPC validation failed");
    expect(() => validateIPC(configImportSchema, 42)).toThrow("IPC validation failed");
  });
});

describe("ttsConfigSchema", () => {
  it("should accept valid tts config", () => {
    const result = validateIPC(ttsConfigSchema, {
      enabled: true,
      voice: "en-US",
      rate: 1.0,
      pitch: 1.0,
      volume: 0.5,
    });
    expect(result).toEqual({
      enabled: true,
      voice: "en-US",
      rate: 1.0,
      pitch: 1.0,
      volume: 0.5,
    });
  });

  it("should reject rate out of range", () => {
    expect(() => validateIPC(ttsConfigSchema, { rate: 5 })).toThrow("IPC validation failed");
  });

  it("should reject volume above 1", () => {
    expect(() => validateIPC(ttsConfigSchema, { volume: 1.1 })).toThrow("IPC validation failed");
  });
});

describe("promptsConfigSchema", () => {
  it("should accept valid prompts config", () => {
    const result = validateIPC(promptsConfigSchema, {
      system: "You are a gaming assistant",
      gameSpecific: { cs2: "Give tips for CS2" },
    });
    expect(result).toEqual({
      system: "You are a gaming assistant",
      gameSpecific: { cs2: "Give tips for CS2" },
    });
  });

  it("should accept empty object", () => {
    expect(validateIPC(promptsConfigSchema, {})).toEqual({});
  });
});

describe("captureModeSchema", () => {
  it("should accept valid modes", () => {
    expect(validateIPC(captureModeSchema, "auto")).toBe("auto");
    expect(validateIPC(captureModeSchema, "window")).toBe("window");
    expect(validateIPC(captureModeSchema, "fullscreen")).toBe("fullscreen");
    expect(validateIPC(captureModeSchema, "gdi")).toBe("gdi");
  });

  it("should reject invalid mode", () => {
    expect(() => validateIPC(captureModeSchema, "invalid")).toThrow("IPC validation failed");
  });
});

describe("booleanSchema", () => {
  it("should accept true and false", () => {
    expect(validateIPC(booleanSchema, true)).toBe(true);
    expect(validateIPC(booleanSchema, false)).toBe(false);
  });

  it("should reject non-boolean", () => {
    expect(() => validateIPC(booleanSchema, "true")).toThrow("IPC validation failed");
    expect(() => validateIPC(booleanSchema, 1)).toThrow("IPC validation failed");
  });
});

describe("hotkeySchema", () => {
  it("should accept non-empty string", () => {
    expect(validateIPC(hotkeySchema, "Ctrl+Shift+A")).toBe("Ctrl+Shift+A");
  });

  it("should reject empty string", () => {
    expect(() => validateIPC(hotkeySchema, "")).toThrow("IPC validation failed");
  });
});

describe("exeNameSchema", () => {
  it("should accept exe name", () => {
    expect(validateIPC(exeNameSchema, "game.exe")).toBe("game.exe");
  });

  it("should reject empty string", () => {
    expect(() => validateIPC(exeNameSchema, "")).toThrow("IPC validation failed");
  });
});

describe("chatFormatSchema", () => {
  it("should accept markdown and json", () => {
    expect(validateIPC(chatFormatSchema, "markdown")).toBe("markdown");
    expect(validateIPC(chatFormatSchema, "json")).toBe("json");
  });

  it("should reject invalid format", () => {
    expect(() => validateIPC(chatFormatSchema, "csv")).toThrow("IPC validation failed");
  });
});

describe("chatMessageSchema", () => {
  it("should accept valid chat message", () => {
    const result = validateIPC(chatMessageSchema, {
      id: "msg-1",
      role: "user",
      text: "Hello!",
      timestamp: 1234567890,
    });
    expect(result).toEqual({
      id: "msg-1",
      role: "user",
      text: "Hello!",
      timestamp: 1234567890,
    });
  });

  it("should accept assistant message with provider", () => {
    const result = validateIPC(chatMessageSchema, {
      id: "msg-2",
      role: "assistant",
      text: "Hello!",
      timestamp: 1234567890,
      provider: "gemini",
    });
    expect(result.provider).toBe("gemini");
  });

  it("should reject missing required fields", () => {
    expect(() => validateIPC(chatMessageSchema, { role: "user", text: "hi" })).toThrow(
      "IPC validation failed",
    );
  });

  it("should reject invalid role", () => {
    expect(() =>
      validateIPC(chatMessageSchema, {
        id: "x",
        role: "system",
        text: "hi",
        timestamp: 1,
      }),
    ).toThrow("IPC validation failed");
  });
});

describe("gameEntrySchema", () => {
  it("should accept valid game entry", () => {
    const result = validateIPC(gameEntrySchema, {
      id: "550e8400-e29b-41d4-a716-446655440000",
      name: "Dragon Crusade",
      exe: "Neuz.exe",
      urls: ["https://wiki.crusade.one/progression/"],
    });
    expect(result.name).toBe("Dragon Crusade");
    expect(result.exe).toBe("Neuz.exe");
    expect(result.urls).toEqual(["https://wiki.crusade.one/progression/"]);
  });

  it("should accept empty urls array", () => {
    const result = validateIPC(gameEntrySchema, {
      id: "550e8400-e29b-41d4-a716-446655440000",
      name: "My Game",
      exe: "Game.exe",
      urls: [],
    });
    expect(result.urls).toEqual([]);
  });

  it("should accept multiple urls", () => {
    const result = validateIPC(gameEntrySchema, {
      id: "550e8400-e29b-41d4-a716-446655440000",
      name: "Dragon Crusade",
      exe: "Neuz.exe",
      urls: ["https://www.dragon-crusade.one/New/", "https://wiki.crusade.one/progression/"],
    });
    expect(result.urls).toHaveLength(2);
  });

  it("should reject empty name", () => {
    expect(() =>
      validateIPC(gameEntrySchema, {
        id: "550e8400-e29b-41d4-a716-446655440000",
        name: "",
        exe: "Game.exe",
        urls: [],
      }),
    ).toThrow("IPC validation failed");
  });

  it("should reject empty exe", () => {
    expect(() =>
      validateIPC(gameEntrySchema, {
        id: "550e8400-e29b-41d4-a716-446655440000",
        name: "Game",
        exe: "",
        urls: [],
      }),
    ).toThrow("IPC validation failed");
  });

  it("should reject invalid UUID", () => {
    expect(() =>
      validateIPC(gameEntrySchema, {
        id: "not-a-uuid",
        name: "Game",
        exe: "Game.exe",
        urls: [],
      }),
    ).toThrow("IPC validation failed");
  });

  it("should reject non-URL in urls array", () => {
    expect(() =>
      validateIPC(gameEntrySchema, {
        id: "550e8400-e29b-41d4-a716-446655440000",
        name: "Game",
        exe: "Game.exe",
        urls: ["not-a-url"],
      }),
    ).toThrow("IPC validation failed");
  });

  it("should reject missing required fields", () => {
    expect(() => validateIPC(gameEntrySchema, { name: "Game" })).toThrow("IPC validation failed");
  });
});
