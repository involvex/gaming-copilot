// Default configuration values

export const DEFAULT_HOTKEY = "CommandOrControl+Shift+G";

export const DEFAULT_OVERLAY = {
  position: "bottom-right" as const,
  duration: 8000,
  opacity: 0.9,
  fontSize: 14,
  theme: "dark" as const,
  clickThrough: true,
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
