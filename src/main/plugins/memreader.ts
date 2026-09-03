import { type ChildProcess, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { logger } from "../logger";

export interface GameState {
  hp: number;
  mp: number;
  level: number;
  mapName: string;
  className: string;
  pos: { x: number; y: number; z: number };
  targets: Array<{ name: string; hp: number; distance: number }>;
  timestamp: number;
}

export interface MemreaderConfig {
  enabled: boolean;
  port: number;
  autoStart: boolean;
}

const DEFAULT_STATE: GameState = {
  hp: 0,
  mp: 0,
  level: 0,
  mapName: "",
  className: "",
  pos: { x: 0, y: 0, z: 0 },
  targets: [],
  timestamp: 0,
};

export class MemreaderPlugin {
  private process: ChildProcess | null = null;
  private state: GameState = { ...DEFAULT_STATE };
  private config: MemreaderConfig;
  private memreaderPath: string;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private onStateChange?: (state: GameState) => void;

  constructor(config: MemreaderConfig) {
    this.config = config;
    // Resolve bun-memreader path relative to gaming-copilot project root
    this.memreaderPath = join(__dirname, "../../../../bun-memreader");
  }

  async start(): Promise<void> {
    if (this.process) return;
    if (!this.config.enabled) return;

    const binPath = join(this.memreaderPath, "bin/memreader.ts");
    if (!existsSync(binPath)) {
      logger.error("Memreader", `bun-memreader not found at ${binPath}`);
      return;
    }

    try {
      this.process = spawn("bun", ["run", binPath, "serve", String(this.config.port)], {
        stdio: ["ignore", "pipe", "pipe"],
        detached: false,
      });

      this.process.stdout?.on("data", (data: Buffer) => {
        const line = data.toString().trim();
        if (line) logger.info("Memreader", line);
      });

      this.process.stderr?.on("data", (data: Buffer) => {
        const line = data.toString().trim();
        if (line) logger.error("Memreader", line);
      });

      this.process.on("exit", (code) => {
        logger.info("Memreader", `Process exited with code ${code}`);
        this.process = null;
        this.stopPolling();
      });

      // Wait briefly for server to start, then begin polling
      await new Promise((r) => setTimeout(r, 1500));
      this.startPolling();
      logger.info("Memreader", `Started on port ${this.config.port}`);
    } catch (error) {
      logger.errorWithStack("Memreader", "Failed to start", error);
    }
  }

  stop(): void {
    this.stopPolling();
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    this.state = { ...DEFAULT_STATE };
  }

  getState(): GameState {
    return this.state;
  }

  isConnected(): boolean {
    return this.process !== null;
  }

  setOnStateChange(callback: (state: GameState) => void): void {
    this.onStateChange = callback;
  }

  updateConfig(config: Partial<MemreaderConfig>): void {
    const oldPort = this.config.port;
    this.config = { ...this.config, ...config };
    if (config.enabled !== undefined) {
      if (config.enabled && !this.process) {
        this.start();
      } else if (!config.enabled && this.process) {
        this.stop();
      }
    }
    if (config.port !== undefined && oldPort !== config.port && this.pollTimer) {
      this.stopPolling();
      this.startPolling();
      logger.info("Memreader", `Polling restarted on port ${config.port}`);
    }
  }

  private startPolling(): void {
    this.pollTimer = setInterval(() => this.fetchState(), 2000);
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private async fetchState(): Promise<void> {
    try {
      const response = await fetch(`http://localhost:${this.config.port}/api/state`);
      if (response.ok) {
        const data = (await response.json()) as Record<string, unknown>;
        this.state = this.parseState(data);
        this.onStateChange?.(this.state);
      }
    } catch {
      // Server not ready or game not attached
    }
  }

  private parseState(data: Record<string, unknown>): GameState {
    return {
      hp: (data.hp as number) || 0,
      mp: (data.mp as number) || 0,
      level: (data.level as number) || 0,
      mapName: (data.mapName as string) || "",
      className: (data.className as string) || "",
      pos: (data.pos as GameState["pos"]) || { x: 0, y: 0, z: 0 },
      targets: Array.isArray(data.targets)
        ? (data.targets as Array<Record<string, unknown>>).map((t) => ({
            name: (t.name as string) || "",
            hp: (t.hp as number) || 0,
            distance: (t.distance as number) || 0,
          }))
        : [],
      timestamp: Date.now(),
    };
  }
}
