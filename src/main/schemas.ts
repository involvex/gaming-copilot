import { z } from "zod";
import { APP_THEME_VALUES } from "../shared/constants";
import type { ChatMessage, RegionBounds } from "../shared/types";

export const regionBoundsSchema = z.object({
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
}) satisfies z.ZodType<RegionBounds>;

export const geminiProviderConfigSchema = z.object({
  model: z.string().optional(),
  grounding: z.boolean().optional(),
  apiKey: z.string().min(1).optional(),
});

export const endpointConfigSchema = z.object({
  name: z.string().optional(),
  baseUrl: z.string().url().optional(),
  apiKey: z.string().min(1).optional(),
  model: z.string().optional(),
});

export const providerNameSchema = z.string().min(1);

export const fallbackProviderSchema = providerNameSchema.optional().nullable();

export const overlayPositionSchema = z.enum([
  "bottom-right",
  "bottom-left",
  "top-right",
  "top-left",
]);

export const overlayThemeSchema = z.enum(["dark", "light", "game", "hacker", "monokai"]);

export const overlayConfigSchema = z.object({
  position: overlayPositionSchema.optional(),
  duration: z.number().positive().optional(),
  opacity: z.number().min(0).max(1).optional(),
  fontSize: z.number().positive().optional(),
  theme: overlayThemeSchema.optional(),
  clickThrough: z.boolean().optional(),
  customCSS: z.string().optional(),
  showScreenshot: z.boolean().optional(),
  persistent: z.boolean().optional(),
});

export const ttsConfigSchema = z.object({
  enabled: z.boolean().optional(),
  voice: z.string().optional(),
  rate: z.number().min(-2).max(2).optional(),
  pitch: z.number().min(0).max(2).optional(),
  volume: z.number().min(0).max(1).optional(),
});

export const promptsConfigSchema = z.object({
  system: z.string().optional(),
  gameSpecific: z.record(z.string(), z.string()).optional(),
});

export const gameEntrySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  exe: z.string().min(1),
  urls: z.array(z.string().url()),
});

export const gamesArraySchema = z.array(gameEntrySchema);

export const captureModeSchema = z.enum(["auto", "window", "fullscreen", "gdi"]);

export const captureQualitySchema = z.number().int().min(1).max(100);

export const maxImageWidthSchema = z.number().int().positive();

export const monitorIndexSchema = z.number().int().nonnegative();

export const hotkeySchema = z.string().min(1);

export const exeNameSchema = z.string().min(1);

export const booleanSchema = z.boolean();

export const themeSchema = z.enum(APP_THEME_VALUES);

export const chatFormatSchema = z.enum(["markdown", "json"]);

export const ocrConfigSchema = z.object({
  enabled: z.boolean().optional(),
  language: z.string().min(1).max(32).optional(),
});

export const overlayCustomThemeSchema = z.object({
  backgroundColor: z.string().max(64).optional(),
  textColor: z.string().max(64).optional(),
  borderColor: z.string().max(64).optional(),
  borderRadius: z.number().nonnegative().optional(),
  padding: z.number().nonnegative().optional(),
});

export const recordDurationSchema = z.number().int().min(1).max(3600);

export const pluginsConfigSchema = z.object({
  bunMemreader: z
    .object({
      enabled: z.boolean().optional(),
      port: z.number().int().positive().max(65535).optional(),
      autoStart: z.boolean().optional(),
    })
    .optional(),
});

/**
 * Setting keys writable via `config:set-generic`, each with its value
 * schema. Keys outside this map are rejected — add new UI settings here.
 * `config:import` reuses the same map so exported files round-trip.
 */
export const genericSettingSchemas: Record<string, z.ZodType<unknown>> = {
  theme: themeSchema,
  notifications: booleanSchema,
  autoStart: booleanSchema,
  minimizeToTray: booleanSchema,
  useKeychain: booleanSchema,
  hotkeyEnabled: booleanSchema,
  saveScreenshots: booleanSchema,
  gameExe: z.string().max(260),
  hotkey: hotkeySchema,
  overlayHotkey: hotkeySchema,
  activeProvider: providerNameSchema,
  fallbackProvider: fallbackProviderSchema,
  captureMode: captureModeSchema,
  captureQuality: captureQualitySchema,
  maxImageWidth: maxImageWidthSchema,
  monitorIndex: monitorIndexSchema,
  recordDuration: recordDurationSchema,
  screenshotDir: z.string().max(2048).nullable(),
  captureRegion: regionBoundsSchema,
  ocr: ocrConfigSchema,
  overlayCustomTheme: overlayCustomThemeSchema,
  plugins: pluginsConfigSchema,
};

export const chatMessageSchema = z.object({
  id: z.string(),
  role: z.enum(["assistant", "user"]),
  text: z.string(),
  screenshot: z.string().optional(),
  timestamp: z.number(),
  provider: z.string().optional(),
  model: z.string().optional(),
  isError: z.boolean().optional(),
}) satisfies z.ZodType<ChatMessage>;

export function validateIPC<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new Error(
      `IPC validation failed: ${result.error.issues.map((i) => i.message).join(", ")}`,
    );
  }
  return result.data;
}

export type RegionBoundsInput = z.infer<typeof regionBoundsSchema>;
export type GeminiProviderConfigInput = z.infer<typeof geminiProviderConfigSchema>;
export type EndpointConfigInput = z.infer<typeof endpointConfigSchema>;
export type OverlayConfigInput = z.infer<typeof overlayConfigSchema>;
export type TtsConfigInput = z.infer<typeof ttsConfigSchema>;
export type PromptsConfigInput = z.infer<typeof promptsConfigSchema>;
export type ChatMessageInput = z.infer<typeof chatMessageSchema>;
export type FallbackProviderInput = z.infer<typeof fallbackProviderSchema>;
export type GameEntryInput = z.infer<typeof gameEntrySchema>;
export type GamesArrayInput = z.infer<typeof gamesArraySchema>;

export const configImportSchema = z.record(z.string(), z.unknown());
