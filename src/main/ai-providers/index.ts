import { createHash } from "node:crypto";

import type { AppConfig } from "../../shared/types";
import { logger } from "../logger";
import { GeminiProvider } from "./gemini";
import { OpenAICompatProvider } from "./openai-compat";
import type { AIProvider, AIResponse, StreamChunk } from "./types";

const CACHE_TTL_MS = 60_000;

interface CacheEntry {
  response: AIResponse;
  expiresAt: number;
}

export class ProviderManager {
  private providers: AIProvider[] = [];
  private activeProviderName: string;
  private cache: Map<string, CacheEntry> = new Map();

  constructor(config: AppConfig) {
    this.activeProviderName = config.activeProvider;

    // Initialize Gemini
    if (config.providers.gemini?.apiKey) {
      this.providers.push(
        new GeminiProvider({
          apiKey: config.providers.gemini.apiKey,
          model: config.providers.gemini.model || "gemini-2.5-flash",
          grounding: config.providers.gemini.grounding ?? true,
        }),
      );
    }

    // Initialize OpenAI-compatible endpoints
    if (config.providers.openaiCompat?.endpoints) {
      for (const endpoint of config.providers.openaiCompat.endpoints) {
        this.providers.push(
          new OpenAICompatProvider({
            name: endpoint.name,
            baseUrl: endpoint.baseUrl,
            apiKey: endpoint.apiKey,
            model: endpoint.model,
          }),
        );
      }
    }
  }

  getAvailableProviders(): AIProvider[] {
    return this.providers.filter((p) => p.isConfigured());
  }

  getProvider(name: string): AIProvider | undefined {
    return this.providers.find((p) => p.name === name);
  }

  setActiveProvider(name: string): void {
    this.activeProviderName = name;
  }

  private getCacheKey(imageBase64: string, systemPrompt: string, userMessage: string): string {
    return createHash("sha1")
      .update(imageBase64 + systemPrompt + userMessage)
      .digest("hex");
  }

  private getCachedResponse(cacheKey: string): AIResponse | undefined {
    const entry = this.cache.get(cacheKey);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(cacheKey);
      return undefined;
    }
    return entry.response;
  }

  private setCachedResponse(cacheKey: string, response: AIResponse): void {
    this.cache.set(cacheKey, {
      response,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
  }

  clearCache(): void {
    this.cache.clear();
  }

  async analyze(
    imageBase64: string,
    mimeType: "image/png" | "image/jpeg",
    systemPrompt: string,
    userMessage: string,
    context?: string,
  ): Promise<AIResponse> {
    const cacheKey = this.getCacheKey(imageBase64, systemPrompt, userMessage);
    const cached = this.getCachedResponse(cacheKey);
    if (cached) {
      return { ...cached, timestamp: Date.now() };
    }

    const available = this.getAvailableProviders();
    if (available.length === 0) {
      throw new Error("No AI providers configured. Add an API key in Settings.");
    }

    // Try active provider first, then fallback chain
    const active = available.find((p) => p.name === this.activeProviderName);
    const ordered = active
      ? [active, ...available.filter((p) => p.name !== this.activeProviderName)]
      : available;

    for (const provider of ordered) {
      const rateLimit = provider.getRateLimitInfo();
      if (rateLimit.remaining.minute <= 0) continue;

      try {
        const response = await provider.analyze({
          imageBase64,
          mimeType,
          systemPrompt,
          userMessage,
          context,
        });
        this.setCachedResponse(cacheKey, response);
        return response;
      } catch (error) {
        logger.error(
          "ProviderManager",
          `Provider ${provider.name} failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    throw new Error("All AI providers failed. Check your API keys and try again.");
  }

  async testProvider(name: string): Promise<boolean> {
    const provider = this.getProvider(name);
    if (!provider?.isConfigured()) return false;

    try {
      // Send a minimal test request
      await provider.analyze({
        imageBase64:
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        mimeType: "image/png",
        systemPrompt: "Reply with 'OK' only.",
        userMessage: "Test",
      });
      return true;
    } catch {
      return false;
    }
  }

  async *streamAnalyze(
    imageBase64: string,
    mimeType: "image/png" | "image/jpeg",
    systemPrompt: string,
    userMessage: string,
    context?: string,
  ): AsyncGenerator<StreamChunk> {
    const cacheKey = this.getCacheKey(imageBase64, systemPrompt, userMessage);
    const cached = this.getCachedResponse(cacheKey);
    if (cached) {
      yield { text: cached.text, done: false };
      yield { text: "", done: true };
      return;
    }

    const available = this.getAvailableProviders();
    if (available.length === 0) {
      throw new Error("No AI providers configured. Add an API key in Settings.");
    }

    const active = available.find((p) => p.name === this.activeProviderName);
    const ordered = active
      ? [active, ...available.filter((p) => p.name !== this.activeProviderName)]
      : available;

    let lastError: unknown;
    for (const provider of ordered) {
      const rateLimit = provider.getRateLimitInfo();
      if (rateLimit.remaining.minute <= 0) continue;

      try {
        let fullText = "";
        for await (const chunk of provider.streamAnalyze({
          imageBase64,
          mimeType,
          systemPrompt,
          userMessage,
          context,
        })) {
          if (!chunk.done) {
            fullText += chunk.text;
            yield chunk;
          }
        }
        if (fullText) {
          this.setCachedResponse(cacheKey, {
            text: fullText,
            provider: provider.name,
            model: provider.name,
            tokens: { input: 0, output: 0 },
            latencyMs: 0,
            timestamp: Date.now(),
          });
        }
        yield { text: "", done: true };
        return;
      } catch (error) {
        lastError = error;
        logger.error(
          "ProviderManager",
          `Provider ${provider.name} failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    throw lastError ?? new Error("All AI providers failed. Check your API keys and try again.");
  }
}
