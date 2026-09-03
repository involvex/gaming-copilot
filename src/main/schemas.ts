import { z } from "zod";
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

export const overlayPositionSchema = z.enum([
  "bottom-right",
  "bottom-left",
  "top-right",
  "top-left",
]);

export const overlayThemeSchema = z.enum(["dark", "light", "game"]);

export const overlayConfigSchema = z.object({
  position: overlayPositionSchema.optional(),
  duration: z.number().positive().optional(),
  opacity: z.number().min(0).max(1).optional(),
  fontSize: z.number().positive().optional(),
  theme: overlayThemeSchema.optional(),
  clickThrough: z.boolean().optional(),
  customCSS: z.string().optional(),
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

export const captureModeSchema = z.enum(["auto", "window", "fullscreen", "gdi"]);

export const captureQualitySchema = z.number().int().min(1).max(100);

export const maxImageWidthSchema = z.number().int().positive();

export const monitorIndexSchema = z.number().int().nonnegative();

export const hotkeySchema = z.string().min(1);

export const exeNameSchema = z.string().min(1);

export const booleanSchema = z.boolean();

export const themeSchema = z.enum(["dark", "light", "system"]);

export const chatFormatSchema = z.enum(["markdown", "json"]);

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

export const configImportSchema = z.record(z.string(), z.unknown());
