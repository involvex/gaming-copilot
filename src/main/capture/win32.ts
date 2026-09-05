import { execFile, execSync } from "node:child_process";
import { promisify } from "node:util";
import { GAME_EXE_PATTERN } from "../capture-utils";

const execFileAsync = promisify(execFile);

/** Process lookups are cached briefly so polling never spawns tasklist per call. */
const LOOKUP_CACHE_TTL_MS = 2000;
const MAX_CACHE_ENTRIES = 64;

interface LookupEntry {
  pid: number | null;
  expiresAt: number;
}

const lookupCache = new Map<string, LookupEntry>();

export interface ProcessInfo {
  pid: number;
  name: string;
  title: string;
}

function normalizeExeName(exeName: string): string | null {
  const name = exeName.endsWith(".exe") ? exeName : `${exeName}.exe`;
  return GAME_EXE_PATTERN.test(name) ? name : null;
}

function parseTasklistOutput(output: string): number | null {
  const lines = output.trim().split("\n").filter(Boolean);
  for (const line of lines) {
    const match = line.match(/"([^"]+)","(\d+)"/);
    if (match?.[1] && match[2]) {
      return Number.parseInt(match[2], 10);
    }
  }
  return null;
}

async function runTasklistLookup(name: string): Promise<number | null> {
  try {
    // argv-based spawn (no shell), so the validated name cannot escape into
    // a command line; windowsHide avoids flashing a console window.
    const { stdout } = await execFileAsync(
      "tasklist",
      ["/FI", `IMAGENAME eq ${name}`, "/FO", "CSV", "/NH"],
      { timeout: 5000, encoding: "utf-8", windowsHide: true },
    );
    return parseTasklistOutput(stdout);
  } catch {
    return null;
  }
}

/**
 * Find a running process by executable name (e.g., "Neuz.exe").
 * Async with a short TTL cache so repeated checks don't block the main
 * thread on process spawns. Returns the PID or null if not found.
 */
export async function findProcessByExe(exeName: string): Promise<number | null> {
  const name = normalizeExeName(exeName);
  if (!name) return null;
  const now = Date.now();
  const hit = lookupCache.get(name);
  if (hit && hit.expiresAt > now) return hit.pid;
  const pid = await runTasklistLookup(name);
  lookupCache.set(name, { pid, expiresAt: now + LOOKUP_CACHE_TTL_MS });
  if (lookupCache.size > MAX_CACHE_ENTRIES) {
    const oldest = lookupCache.keys().next();
    if (!oldest.done) lookupCache.delete(oldest.value);
  }
  return pid;
}

/**
 * Get the window title for a given PID using PowerShell.
 */
export function getWindowTitleByPid(pid: number): string | null {
  try {
    const ps = `
      Add-Type @"
        using System;
        using System.Runtime.InteropServices;
        public class Win32 {
          [DllImport("user32.dll")]
          public static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder text, int count);
          [DllImport("user32.dll")]
          public static extern int GetWindowTextLength(IntPtr hWnd);
        }
"@
      Get-Process -Id ${pid} -ErrorAction SilentlyContinue |
        Where-Object { $_.MainWindowHandle -ne [IntPtr]::Zero } |
        ForEach-Object {
          $len = [Win32]::GetWindowTextLength($_.MainWindowHandle)
          $sb = New-Object System.Text.StringBuilder ($len + 1)
          [Win32]::GetWindowText($_.MainWindowHandle, $sb, $sb.Capacity) | Out-Null
          $sb.ToString()
        }
    `.trim();

    const output = execSync(`powershell -NoProfile -Command "${ps.replace(/"/g, '\\"')}"`, {
      encoding: "utf-8",
      timeout: 5000,
    });

    const title = output.trim();
    return title || null;
  } catch {
    return null;
  }
}

/**
 * Check if a process is running.
 */
export async function isProcessRunning(exeName: string): Promise<boolean> {
  return (await findProcessByExe(exeName)) !== null;
}
