import { execSync } from "node:child_process";

export interface ProcessInfo {
  pid: number;
  name: string;
  title: string;
}

/**
 * Find a running process by executable name (e.g., "Neuz.exe").
 * Returns the PID or null if not found.
 */
const SAFE_EXE_PATTERN = /^[\w.-]+\.exe$/;

export function findProcessByExe(exeName: string): number | null {
  try {
    const name = exeName.endsWith(".exe") ? exeName : `${exeName}.exe`;
    if (!SAFE_EXE_PATTERN.test(name)) {
      return null;
    }
    const output = execSync(`tasklist /FI "IMAGENAME eq ${name}" /FO CSV /NH`, {
      encoding: "utf-8",
      timeout: 5000,
    });

    const lines = output.trim().split("\n").filter(Boolean);
    for (const line of lines) {
      const match = line.match(/"([^"]+)","(\d+)"/);
      if (match) {
        return Number.parseInt(match[2], 10);
      }
    }
    return null;
  } catch {
    return null;
  }
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
export function isProcessRunning(exeName: string): boolean {
  return findProcessByExe(exeName) !== null;
}
