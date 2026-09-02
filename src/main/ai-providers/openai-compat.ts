import type {
  AIProvider,
  AIResponse,
  OpenAICompatConfig,
  RateLimitInfo,
  StreamChunk,
} from "./types";

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

  async *streamAnalyze(params: {
    imageBase64: string;
    mimeType: "image/png" | "image/jpeg";
    systemPrompt: string;
    userMessage: string;
    context?: string;
  }): AsyncGenerator<StreamChunk> {
    this.resetCountersIfNeeded();

    const url = `${this.config.baseUrl.replace(/\/$/, "")}/chat/completions`;

    this.requestCount.minute++;
    this.requestCount.day++;

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
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`API error ${response.status}: ${errorBody}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("No response body reader available");
    }

    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        while (true) {
          const lineEnd = buffer.indexOf("\n");
          if (lineEnd === -1) break;

          const line = buffer.slice(0, lineEnd).trim();
          buffer = buffer.slice(lineEnd + 1);

          if (!line?.startsWith("data:")) continue;

          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data) as {
              choices?: Array<{ delta?: { content?: string } }>;
            };
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              yield {
                text: content,
                done: false,
                tokens: { input: 0, output: 0 },
              };
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    yield { text: "", done: true };
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
