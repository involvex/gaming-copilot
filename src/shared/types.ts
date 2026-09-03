// Shared types between main and renderer processes

export interface GameState {
  name: string;
  level: number;
  hp: number;
  mp: number;
  fp: number;
  str: number;
  sta: number;
  dex: number;
  int: number;
  x: number;
  y: number;
  z: number;
  timestamp: number;
}

export interface AIResponse {
  text: string;
  provider: string;
  model: string;
  tokens: { input: number; output: number };
  latencyMs: number;
  timestamp: number;
}

export interface AIProviderConfig {
  name: string;
  displayName: string;
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface ScreenshotResult {
  buffer: Buffer;
  width: number;
  height: number;
  timestamp: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  screenshot?: string; // data URL
  timestamp: number;
  provider?: string;
  model?: string;
  isError?: boolean;
}

export interface RegionBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AppConfig {
  // General
  hotkey: string;
  autoStart: boolean;
  minimizeToTray: boolean;
  notifications: boolean;

  // Capture
  gameExe: string;
  captureQuality: number;
  maxImageWidth: number;
  captureRegion?: RegionBounds;
  hotkeyEnabled: boolean;
  monitorIndex: number;

  // Providers
  providers: {
    gemini?: {
      apiKey: string;
      model: string;
      grounding: boolean;
    };
    openaiCompat?: {
      endpoints: Array<{
        name: string;
        baseUrl: string;
        apiKey: string;
        model: string;
      }>;
    };
  };
  activeProvider: string;

  // Overlay
  overlay: {
    position: "bottom-right" | "bottom-left" | "top-right" | "top-left";
    duration: number;
    opacity: number;
    fontSize: number;
    theme: "dark" | "light" | "game";
    clickThrough: boolean;
  };

  // Overlay Custom Theme
  overlayCustomTheme: {
    backgroundColor: string;
    textColor: string;
    borderRadius: number;
    padding: number;
    borderColor: string;
  };

  // TTS
  tts: {
    enabled: boolean;
    voice: string;
    rate: number;
    pitch: number;
    volume: number;
  };

  // Plugins
  plugins: {
    bunMemreader: {
      enabled: boolean;
      port: number;
      autoStart: boolean;
    };
  };

  // OCR
  ocr: {
    enabled: boolean;
    language: string;
  };

  // Prompts
  prompts: {
    system: string;
    gameSpecific: Record<string, string>;
  };
}
