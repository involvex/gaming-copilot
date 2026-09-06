import { GoogleGenAI } from "@google/genai";
import { RateLimiter } from "./rate-limiter";
import type { AIProvider, AIResponse, GeminiConfig, RateLimitInfo, StreamChunk } from "./types";

const RATE_LIMITER = new RateLimiter(15, 1000);

export class GeminiProvider implements AIProvider {
  readonly name = "gemini";
  readonly displayName = "Google Gemini";
  private client: GoogleGenAI;
  private config: GeminiConfig;

  constructor(config: GeminiConfig) {
    this.config = config;
    this.client = new GoogleGenAI({ apiKey: config.apiKey });
  }

  isConfigured(): boolean {
    return !!this.config.apiKey;
  }

  getModel(): string {
    return this.config.model;
  }

  getRateLimitInfo(): RateLimitInfo {
    return RATE_LIMITER.getInfo();
  }

  async fetchModels(): Promise<string[]> {
    try {
      const response = await this.client.models.list();
      const models = (response as { models?: Array<{ name?: string }> }).models ?? [];
      return models
        .map((m) => m.name)
        .filter((name): name is string => typeof name === "string" && name.length > 0)
        .sort();
    } catch {
      return [];
    }
  }

  async analyze(params: {
    imageBase64: string;
    mimeType: "image/png" | "image/jpeg";
    systemPrompt: string;
    userMessage: string;
    context?: string;
  }): Promise<AIResponse> {
    const start = Date.now();
    RATE_LIMITER.getInfo();

    const contents = [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType: params.mimeType,
              data: params.imageBase64,
            },
          },
          {
            text: params.context
              ? `${params.context}\n\n${params.userMessage}`
              : params.userMessage,
          },
        ],
      },
    ];

    const config: Record<string, unknown> = {
      systemInstruction: params.systemPrompt,
    };

    if (this.config.grounding) {
      config.tools = [{ googleSearch: {} }];
    }

    const response = await this.client.models.generateContent({
      model: this.config.model,
      contents,
      config,
    });

    RATE_LIMITER.increment();

    const text = response.text ?? "No response generated";
    const usage = response.usageMetadata;

    return {
      text,
      provider: this.name,
      model: this.config.model,
      tokens: {
        input: usage?.promptTokenCount ?? 0,
        output: usage?.candidatesTokenCount ?? 0,
      },
      latencyMs: Date.now() - start,
      timestamp: Date.now(),
    };
  }

  async *streamAnalyze(params: {
    imageBase64: string;
    mimeType: "image/png" | "image/jpeg";
    systemPrompt: string;
    userMessage: string;
    context?: string;
  }): AsyncGenerator<StreamChunk> {
    RATE_LIMITER.getInfo();

    const contents = [
      {
        role: "user" as const,
        parts: [
          {
            inlineData: {
              mimeType: params.mimeType,
              data: params.imageBase64,
            },
          },
          {
            text: params.context
              ? `${params.context}\n\n${params.userMessage}`
              : params.userMessage,
          },
        ],
      },
    ];

    const config: Record<string, unknown> = {
      systemInstruction: params.systemPrompt,
    };

    if (this.config.grounding) {
      config.tools = [{ googleSearch: {} }];
    }

    RATE_LIMITER.increment();

    const response = await this.client.models.generateContentStream({
      model: this.config.model,
      contents,
      config,
    });

    for await (const chunk of response) {
      const text = chunk.text ?? "";
      if (text) {
        yield { text, done: false };
      }
    }

    yield {
      text: "",
      done: true,
      tokens: {
        input: 0,
        output: 0,
      },
    };
  }
}
