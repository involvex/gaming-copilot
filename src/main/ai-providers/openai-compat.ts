import type { AIProvider, AIResponse, OpenAICompatConfig, RateLimitInfo } from "./types";

export class OpenAICompatProvider implements AIProvider {
  readonly name: string;
  readonly displayName: string;
  private config: OpenAICompatConfig;
  private requestCount = { minute: 0, day: 0 };
  private lastMinuteReset = Date.now();
  private lastDayReset = Date.now();

  constructor(config: OpenAICompatConfig) {
    this.name = config.name;
    this.displayName = config.name;
    this.config = config;
  }

  isConfigured(): boolean {
    return !!this.config.apiKey && !!this.config.baseUrl;
  }

  getRateLimitInfo(): RateLimitInfo {
    this.resetCountersIfNeeded();
    return {
      rpm: 60,
      rpd: 10000,
      remaining: {
        minute: Math.max(0, 60 - this.requestCount.minute),
        day: Math.max(0, 10000 - this.requestCount.day),
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

    const url = `${this.config.baseUrl.replace(/\/$/, "")}/chat/completions`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          { role: "system", content: params.systemPrompt },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:${params.mimeType};base64,${params.imageBase64}`,
                },
              },
              {
                type: "text",
                text: params.context
                  ? `${params.context}\n\n${params.userMessage}`
                  : params.userMessage,
              },
            ],
          },
        ],
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`API error ${response.status}: ${errorBody}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
      model?: string;
    };

    this.requestCount.minute++;
    this.requestCount.day++;

    const text = data.choices?.[0]?.message?.content ?? "No response generated";
    const model = data.model ?? this.config.model;

    return {
      text,
      provider: this.name,
      model,
      tokens: {
        input: data.usage?.prompt_tokens ?? 0,
        output: data.usage?.completion_tokens ?? 0,
      },
      latencyMs: Date.now() - start,
      timestamp: Date.now(),
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
