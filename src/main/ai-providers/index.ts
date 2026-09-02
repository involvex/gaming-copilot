import type { AppConfig } from "../shared/types";
import { GeminiProvider } from "./gemini";
import { OpenAICompatProvider } from "./openai-compat";
import type { AIProvider, AIResponse } from "./types";

export class ProviderManager {
  private providers: AIProvider[] = [];
  private activeProviderName: string;

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

  async analyze(
    imageBase64: string,
    mimeType: "image/png" | "image/jpeg",
    systemPrompt: string,
    userMessage: string,
    context?: string,
  ): Promise<AIResponse> {
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
        return await provider.analyze({
          imageBase64,
          mimeType,
          systemPrompt,
          userMessage,
          context,
        });
      } catch (error) {
        console.error(`Provider ${provider.name} failed:`, error);
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
}
