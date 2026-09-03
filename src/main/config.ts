import Store from "electron-store";
import { DEFAULT_SYSTEM_PROMPT } from "../shared/constants";
import type { AppConfig, ChatMessage } from "../shared/types";
import { logger } from "./logger";

const schema = {
  type: "object",
  properties: {
    hotkey: { type: "string", default: "CommandOrControl+Shift+G" },
    autoStart: { type: "boolean", default: false },
    minimizeToTray: { type: "boolean", default: true },
    notifications: { type: "boolean", default: true },
    gameExe: { type: "string", default: "" },
    captureQuality: { type: "number", default: 85 },
    maxImageWidth: { type: "number", default: 1024 },
    hotkeyEnabled: { type: "boolean", default: true },
    monitorIndex: { type: "number", default: 0 },
    activeProvider: { type: "string", default: "gemini" },
    providers: {
      type: "object",
      properties: {
        gemini: {
          type: "object",
          properties: {
            apiKey: { type: "string", default: "" },
            model: { type: "string", default: "gemini-2.5-flash" },
            grounding: { type: "boolean", default: true },
          },
          default: {},
        },
        openaiCompat: {
          type: "object",
          properties: {
            endpoints: { type: "array", default: [] },
          },
          default: { endpoints: [] },
        },
      },
      default: {},
    },
    overlay: {
      type: "object",
      properties: {
        position: { type: "string", default: "bottom-right" },
        duration: { type: "number", default: 8000 },
        opacity: { type: "number", default: 0.9 },
        fontSize: { type: "number", default: 14 },
        theme: { type: "string", default: "dark" },
        clickThrough: { type: "boolean", default: true },
      },
      default: {},
    },
    overlayCustomTheme: {
      type: "object",
      properties: {
        backgroundColor: { type: "string", default: "#111827" },
        textColor: { type: "string", default: "#ffffff" },
        borderRadius: { type: "number", default: 8 },
        padding: { type: "number", default: 16 },
        borderColor: { type: "string", default: "#374151" },
      },
      default: {},
    },
    tts: {
      type: "object",
      properties: {
        enabled: { type: "boolean", default: false },
        voice: { type: "string", default: "" },
        rate: { type: "number", default: 1.0 },
        pitch: { type: "number", default: 1.0 },
        volume: { type: "number", default: 0.8 },
      },
      default: {},
    },
    plugins: {
      type: "object",
      properties: {
        bunMemreader: {
          type: "object",
          properties: {
            enabled: { type: "boolean", default: false },
            port: { type: "number", default: 31337 },
            autoStart: { type: "boolean", default: false },
          },
          default: {},
        },
      },
      default: {},
    },
    prompts: {
      type: "object",
      properties: {
        system: { type: "string", default: DEFAULT_SYSTEM_PROMPT },
        gameSpecific: { type: "object", default: {} },
      },
      default: {},
    },
    ocr: {
      type: "object",
      properties: {
        enabled: { type: "boolean", default: true },
        language: { type: "string", default: "eng" },
      },
      default: {},
    },
    recordDuration: { type: "number", default: 10 },
    telemetry: {
      type: "object",
      properties: {
        enabled: { type: "boolean", default: false },
      },
      default: {},
    },
  },
  default: {},
} as const;

let store: Store<AppConfig>;

export function initConfig(): AppConfig {
  store = new Store<AppConfig>({
    name: "config",
    schema: schema as never,
    defaults: getDefaultConfig(),
  });

  const config = store.store;
  logger.info("Config", `Loaded config from ${store.path}`);
  return config;
}

export function getConfig(): AppConfig {
  return store?.store ?? getDefaultConfig();
}

export function setConfigValue<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void {
  store.set(key, value);
  logger.debug("Config", `Set ${key} = ${JSON.stringify(value).slice(0, 100)}`);
}

export function setPartialConfig(partial: Partial<AppConfig>): void {
  for (const [key, value] of Object.entries(partial)) {
    store.set(key as keyof AppConfig, value as never);
  }
  logger.debug("Config", `Updated ${Object.keys(partial).join(", ")}`);
}

export function getConfigPath(): string {
  return store?.path ?? "";
}

let chatStore: Store<{ messages: ChatMessage[] }>;
let chatMessages: ChatMessage[] = [];

export function initChatStore(): void {
  chatStore = new Store<{ messages: ChatMessage[] }>({
    name: "chat-history",
    defaults: { messages: [] },
  });
  chatMessages = chatStore.get("messages", []);
  logger.info("Config", `Loaded chat history: ${chatMessages.length} messages`);
}

export function getChatHistory(): ChatMessage[] {
  return chatMessages;
}

export function saveChatHistory(messages: ChatMessage[]): void {
  chatMessages = messages;
  chatStore.set("messages", messages);
  logger.debug("Config", `Saved chat history: ${messages.length} messages`);
}

export function clearChatHistory(): void {
  chatMessages = [];
  chatStore.set("messages", []);
  logger.info("Config", "Chat history cleared");
}

function getDefaultConfig(): AppConfig {
  return {
    hotkey: "CommandOrControl+Shift+G",
    autoStart: false,
    minimizeToTray: true,
    notifications: true,
    gameExe: "",
    captureQuality: 85,
    maxImageWidth: 1024,
    hotkeyEnabled: true,
    monitorIndex: 0,
    providers: {},
    activeProvider: "gemini",
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
    tts: {
      enabled: false,
      voice: "",
      rate: 1.0,
      pitch: 1.0,
      volume: 0.8,
    },
    plugins: {
      bunMemreader: {
        enabled: false,
        port: 31337,
        autoStart: false,
      },
    },
    prompts: {
      system: DEFAULT_SYSTEM_PROMPT,
      gameSpecific: {},
    },
    ocr: {
      enabled: true,
      language: "eng",
    },
    recordDuration: 10,
    telemetry: {
      enabled: false,
    },
  };
}
