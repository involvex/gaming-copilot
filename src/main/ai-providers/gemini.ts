import { GoogleGenAI } from "@google/genai";
import type { AIProvider, AIResponse, GeminiConfig, RateLimitInfo, StreamChunk } from "./types";

export class GeminiProvider implements AIProvider {
  readonly name = "gemini";
  readonly displayName = "Google Gemini";
  private client: GoogleGenAI;
  private config: GeminiConfig;
  private requestCount = { minute: 0, day: 0 };
  private lastMinuteReset = Date.now();
  private lastDayReset = Date.now();

  constructor(config: GeminiConfig) {
    this.config = config;
    this.client = new GoogleGenAI({ apiKey: config.apiKey });
  }

  isConfigured(): boolean {
    return !!this.config.apiKey;
  }

  getRateLimitInfo(): RateLimitInfo {
    this.resetCountersIfNeeded();
    return {
      rpm: 15,
      rpd: 1000,
      remaining: {
        minute: Math.max(0, 15 - this.requestCount.minute),
        day: Math.max(0, 1000 - this.requestCount.day),
      },
    };
  }

  async analyze(params: {
    imageBase64: string;
    mimeType: "image/png" | "image/jpeg";
    systemPrompt: string;
    userMessage: string;
    context?: string;
  }): Promise<AIResponse> {
    const start = Date.now();
    this.resetCountersIfNeeded();

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

    this.requestCount.minute++;
    this.requestCount.day++;

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
    this.resetCountersIfNeeded();

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

    this.requestCount.minute++;
    this.requestCount.day++;

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

  private resetCountersIfNeeded(): void {
    const now = Date.now();
    if (now - this.lastMinuteReset > 60_000) {
      this.requestCount.minute = 0;
      this.lastMinuteReset = now;
    }
    if (now - this.lastDayReset > 86_400_000) {
      this.requestCount.day = 0;
      this.lastDayReset = now;
    }
  }
}
