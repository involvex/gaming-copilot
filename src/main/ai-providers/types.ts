export interface AIProvider {
  readonly name: string;
  readonly displayName: string;

  analyze(params: {
    imageBase64: string;
    mimeType: "image/png" | "image/jpeg";
    systemPrompt: string;
    userMessage: string;
    context?: string;
  }): Promise<AIResponse>;

  streamAnalyze(params: {
    imageBase64: string;
    mimeType: "image/png" | "image/jpeg";
    systemPrompt: string;
    userMessage: string;
    context?: string;
  }): AsyncGenerator<StreamChunk>;

  isConfigured(): boolean;
  getRateLimitInfo(): RateLimitInfo;
  getModel(): string;
  fetchModels?(): Promise<string[]>;
}

export interface StreamChunk {
  text: string;
  done: boolean;
  tokens?: { input: number; output: number };
}

export interface AIResponse {
  text: string;
  provider: string;
  model: string;
  tokens: { input: number; output: number };
  latencyMs: number;
  timestamp: number;
}

export interface RateLimitInfo {
  rpm: number; // requests per minute
  rpd: number; // requests per day
  remaining: { minute: number; day: number };
}

export interface GeminiConfig {
  apiKey: string;
  model: string;
  grounding: boolean;
}

export interface OpenAICompatConfig {
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
}
