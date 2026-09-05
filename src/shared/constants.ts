// Default configuration values

export const DEFAULT_HOTKEY = "CommandOrControl+Shift+G";

export const DEFAULT_OVERLAY = {
  position: "bottom-right" as const,
  duration: 8000,
  opacity: 0.9,
  fontSize: 14,
  theme: "dark" as const,
  clickThrough: true,
  customCSS: "",
};

export const DEFAULT_TTS = {
  enabled: false,
  voice: "",
  rate: 1.0,
  pitch: 1.0,
  volume: 0.8,
};

export const DEFAULT_SYSTEM_PROMPT =
  "You are an expert gaming analyst. Analyze this game screenshot and provide helpful, concise feedback.\n\n" +
  "If an inventory or equipment screen is visible:\n" +
  "- Evaluate gear score, stat distribution, and item quality\n" +
  "- Suggest improvements or optimizations\n" +
  "- Identify missing items or upgrade paths\n\n" +
  "If in-game HUD is visible:\n" +
  "- Extract location/coordinates from the minimap or HUD\n" +
  "- Describe the current situation (combat, exploration, etc.)\n" +
  "- Provide tactical suggestions if in combat\n\n" +
  "If a quest or dialogue is visible:\n" +
  "- Summarize the quest objective\n" +
  "- Suggest the optimal choice if there are options\n\n" +
  "Keep responses under 100 words. Be specific and actionable.\n" +
  "Format: Use bullet points for multiple observations.";

export const GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash",
] as const;

export const OPENAI_COMPAT_PRESETS: Record<string, { baseUrl: string; displayName: string }> = {
  zen: {
    baseUrl: "https://opencode.ai/zen/v1",
    displayName: "OpenCode Zen",
  },
  kilo: {
    baseUrl: "https://api.kilo.ai/api/gateway",
    displayName: "Kilo Gateway",
  },
  ollama: {
    baseUrl: "http://localhost:11434/v1",
    displayName: "Ollama (Local)",
  },
};

export const OVERLAY_POSITIONS = ["bottom-right", "bottom-left", "top-right", "top-left"] as const;

/**
 * Single source of truth for app themes. To add a theme: append its id here,
 * add its colors to {@link THEME_COLORS}, and add a `:root.theme-<id>` block
 * in `globals.css` — schema validation, the theme class list, and the
 * settings selector all derive from this tuple automatically.
 */
export const APP_THEME_VALUES = ["dark", "light", "system", "hacker", "monokai", "gamer"] as const;

export type AppTheme = (typeof APP_THEME_VALUES)[number];

/** Concrete `<html>` classes (excludes `system`, which resolves to dark/light). */
export const THEME_CLASS_NAMES = APP_THEME_VALUES.filter((t) => t !== "system").map(
  (t) => `theme-${t}`,
);

export const APP_THEME_LABELS: Record<AppTheme, string> = {
  dark: "Dark",
  light: "Light",
  system: "System (Auto-detect)",
  hacker: "Hacker (Matrix)",
  monokai: "Monokai",
  gamer: "Gamer (Neon)",
};

export interface ThemeColors {
  bg: string;
  surface: string;
  surfaceHover: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  border: string;
  accent: string;
  accentHover: string;
  cardBg: string;
  cardBorder: string;
  inputBg: string;
  inputBorder: string;
  code: string;
  success: string;
  warning: string;
  error: string;
}

export const THEME_COLORS: Record<Exclude<AppTheme, "system">, ThemeColors> = {
  dark: {
    bg: "#0f172a",
    surface: "#1e293b",
    surfaceHover: "#334155",
    text: "#f8fafc",
    textSecondary: "#cbd5e1",
    textTertiary: "#94a3b8",
    border: "#334155",
    accent: "#3b82f6",
    accentHover: "#2563eb",
    cardBg: "#1e293b",
    cardBorder: "#334155",
    inputBg: "#1e293b",
    inputBorder: "#334155",
    code: "#38bdf8",
    success: "#22c55e",
    warning: "#eab308",
    error: "#ef4444",
  },
  light: {
    bg: "#ffffff",
    surface: "#f8fafc",
    surfaceHover: "#f1f5f9",
    text: "#0f172a",
    textSecondary: "#475569",
    textTertiary: "#94a3b8",
    border: "#e2e8f0",
    accent: "#2563eb",
    accentHover: "#1d4ed8",
    cardBg: "#f8fafc",
    cardBorder: "#e2e8f0",
    inputBg: "#f8fafc",
    inputBorder: "#cbd5e1",
    code: "#0ea5e9",
    success: "#16a34a",
    warning: "#ca8a04",
    error: "#dc2626",
  },
  hacker: {
    bg: "#000000",
    surface: "#000000",
    surfaceHover: "#001100",
    text: "#00ff41",
    textSecondary: "#00cc00",
    textTertiary: "#009900",
    border: "#004400",
    accent: "#00ff41",
    accentHover: "#00cc33",
    cardBg: "#000500",
    cardBorder: "#004400",
    inputBg: "#001100",
    inputBorder: "#003300",
    code: "#00ff41",
    success: "#00ff41",
    warning: "#ffff00",
    error: "#ff0066",
  },
  monokai: {
    bg: "#272822",
    surface: "#2e2f29",
    surfaceHover: "#3a3b36",
    text: "#f8f8f2",
    textSecondary: "#95a5a6",
    textTertiary: "#75715e",
    border: "#3a3b36",
    accent: "#f92672",
    accentHover: "#ff3b99",
    cardBg: "#2e2f29",
    cardBorder: "#3a3b36",
    inputBg: "#3a3b36",
    inputBorder: "#3a3b36",
    code: "#aeff63",
    success: "#8fc63f",
    warning: "#fd971f",
    error: "#f92672",
  },
  gamer: {
    bg: "#060a17",
    surface: "#0b1226",
    surfaceHover: "#141d38",
    text: "#e6f6ff",
    textSecondary: "#8fa3c7",
    textTertiary: "#54648a",
    border: "#1c2a52",
    accent: "#00e5ff",
    accentHover: "#00b8d4",
    cardBg: "#0b1226",
    cardBorder: "#1c2a52",
    inputBg: "#0b1226",
    inputBorder: "#274069",
    code: "#7df9ff",
    success: "#39ff88",
    warning: "#ffb300",
    error: "#ff2d55",
  },
};

export const LIGHT_THEME_OVERRIDE_CLASS = "theme-light";

export interface OverlayCustomTheme {
  backgroundColor: string;
  textColor: string;
  borderRadius: number;
  padding: number;
  borderColor: string;
}

export const OVERLAY_PRESET_THEMES: Record<string, OverlayCustomTheme> = {
  dark: {
    backgroundColor: "#111827",
    textColor: "#ffffff",
    borderRadius: 8,
    padding: 16,
    borderColor: "#374151",
  },
  light: {
    backgroundColor: "#ffffff",
    textColor: "#111827",
    borderRadius: 8,
    padding: 16,
    borderColor: "#d1d5db",
  },
  game: {
    backgroundColor: "#001100",
    textColor: "#00ff41",
    borderRadius: 12,
    padding: 12,
    borderColor: "#00ff41",
  },
  hacker: {
    backgroundColor: "#000000",
    textColor: "#00ff41",
    borderRadius: 8,
    padding: 16,
    borderColor: "#004400",
  },
  monokai: {
    backgroundColor: "#272822",
    textColor: "#f8f8f2",
    borderRadius: 8,
    padding: 16,
    borderColor: "#3a3b36",
  },
};
