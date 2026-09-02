import { appendFileSync, mkdirSync, readdirSync, renameSync } from "node:fs";
import { join } from "node:path";
import { app } from "electron";

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

let logDir: string;
let minLevel: LogLevel = "info";

function getLogDir(): string {
  if (!logDir) {
    logDir = join(app.getPath("userData"), "logs");
    mkdirSync(logDir, { recursive: true });
  }
  return logDir;
}

function getLogFilePath(): string {
  const now = new Date();
  const date = now.toISOString().split("T")[0];
  return join(getLogDir(), `${date}.log`);
}

function rotateIfNeeded(): void {
  const dir = getLogDir();
  try {
    const files = readdirSync(dir)
      .filter((f) => f.endsWith(".log"))
      .sort();
    // Keep max 7 log files
    while (files.length > 7) {
      const oldest = files.shift();
      if (oldest) {
        renameSync(join(dir, oldest), join(dir, `${oldest}.old`));
      }
    }
  } catch {
    // Ignore rotation errors
  }
}

function formatMessage(level: LogLevel, component: string, message: string): string {
  const ts = new Date().toISOString();
  return `[${ts}] [${level.toUpperCase()}] [${component}] ${message}\n`;
}

export function setLogLevel(level: LogLevel): void {
  minLevel = level;
}

export function getLogLevel(): LogLevel {
  return minLevel;
}

export function log(level: LogLevel, component: string, message: string): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[minLevel]) return;

  const formatted = formatMessage(level, component, message);
  try {
    rotateIfNeeded();
    appendFileSync(getLogFilePath(), formatted, "utf-8");
  } catch {
    // Silently fail if we can't write logs
  }

  // Also log to console in dev
  if (process.env.NODE_ENV === "development" || process.env.DEBUG) {
    const consoleFn =
      level === "error" ? console.error : level === "warn" ? console.warn : console.log;
    consoleFn(`[${component}] ${message}`);
  }
}

export const logger = {
  debug: (component: string, message: string) => log("debug", component, message),
  info: (component: string, message: string) => log("info", component, message),
  warn: (component: string, message: string) => log("warn", component, message),
  error: (component: string, message: string) => log("error", component, message),
  errorWithStack: (component: string, message: string, error: unknown) => {
    const stack = error instanceof Error ? error.stack : String(error);
    log("error", component, `${message}\n${stack}`);
  },
};
