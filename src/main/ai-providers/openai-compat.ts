import { RateLimiter } from "./rate-limiter";
import type {
  AIProvider,
  AIResponse,
  OpenAICompatConfig,
  RateLimitInfo,
  StreamChunk,
} from "./types";

const RATE_LIMITER = new RateLimiter(60, 10000);

export class OpenAICompatProvider implements AIProvider {
  readonly name: string;
  readonly displayName: string;
  private config: OpenAICompatConfig;

  constructor(config: OpenAICompatConfig) {
    this.name = config.name;
    this.displayName = config.name;
    this.config = config;
  }

  isConfigured(): boolean {
    return !!this.config.apiKey && !!this.config.baseUrl;
  }

  getModel(): string {
    return this.config.model;
  }

  getRateLimitInfo(): RateLimitInfo {
    return RATE_LIMITER.getInfo();
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

    RATE_LIMITER.increment();

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
    RATE_LIMITER.getInfo();

    const url = `${this.config.baseUrl.replace(/\/$/, "")}/chat/completions`;

    RATE_LIMITER.increment();

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
}
