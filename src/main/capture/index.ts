import { desktopCapturer } from "electron";

export interface CaptureResult {
  buffer: Buffer;
  width: number;
  height: number;
  timestamp: number;
}

/**
 * Capture a screenshot of a specific window by its executable name.
 * Uses Electron desktopCapturer for windowed/borderless games.
 */
export async function captureWindowByExe(exeName: string): Promise<CaptureResult | null> {
  const { findProcessByExe } = await import("./win32");
  const pid = findProcessByExe(exeName);
  if (!pid) return null;

  const sources = await desktopCapturer.getSources({
    types: ["window"],
    thumbnailSize: { width: 1920, height: 1080 },
  });

  // Find source matching the process name (Electron uses name for window titles)
  const source = sources.find((s) => {
    const name = s.name.toLowerCase();
    const exe = exeName.toLowerCase().replace(".exe", "");
    return name.includes(exe);
  });

  if (source) {
    const thumbnail = source.thumbnail;
    return {
      buffer: thumbnail.toPNG(),
      width: thumbnail.getSize().width,
      height: thumbnail.getSize().height,
      timestamp: Date.now(),
    };
  }

  return null;
}

/**
 * Capture the primary screen using Electron desktopCapturer.
 */
export async function captureFullScreen(): Promise<CaptureResult> {
  const sources = await desktopCapturer.getSources({
    types: ["screen"],
    thumbnailSize: { width: 1920, height: 1080 },
  });

  const primaryScreen = sources[0];
  if (!primaryScreen) {
    throw new Error("No screen found");
  }

  const thumbnail = primaryScreen.thumbnail;
  return {
    buffer: thumbnail.toPNG(),
    width: thumbnail.getSize().width,
    height: thumbnail.getSize().height,
    timestamp: Date.now(),
  };
}

/**
 * Capture using Windows GDI+ fallback (for exclusive fullscreen games).
 * This runs a PowerShell script that uses CopyFromScreen.
 */
export async function captureWithGDI(exeName: string): Promise<CaptureResult | null> {
  const { findProcessByExe, getWindowTitleByPid } = await import("./win32");
  const pid = findProcessByExe(exeName);
  if (!pid) return null;

  const title = getWindowTitleByPid(pid);
  if (!title) return null;

  try {
    const script = `
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms

Add-Type @"
  using System;
  using System.Runtime.InteropServices;
  public class Win32 {
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool GetWindowRect(IntPtr hWnd, out Rect lpRect);
    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    [StructLayout(LayoutKind.Sequential)]
    public struct Rect {
      public int left;
      public int top;
      public int right;
      public int bottom;
    }
  }
"@

$process = Get-Process -Id ${pid} -ErrorAction SilentlyContinue
if ($null -eq $process) { exit 1 }

$hwnd = $process.MainWindowHandle
if ($hwnd -eq [IntPtr]::Zero) { exit 1 }

[Win32]::SetForegroundWindow($hwnd) | Out-Null
Start-Sleep -Milliseconds 250

$rect = New-Object Win32+Rect
[Win32]::GetWindowRect($hwnd, [ref]$rect) | Out-Null

$width = $rect.right - $rect.left
$height = $rect.bottom - $rect.top

if ($width -gt 0 -and $height -gt 0) {
  $bitmap = New-Object System.Drawing.Bitmap $width, $height
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.CopyFromScreen($rect.left, $rect.top, 0, 0, $bitmap.Size)

  $ms = New-Object System.IO.MemoryStream
  $bitmap.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
  [Convert]::ToBase64String($ms.ToArray())

  $graphics.Dispose()
  $bitmap.Dispose()
} else {
  exit 1
}
`.trim();

    const output = execSync(
      `powershell -NoProfile -Command "${script.replace(/"/g, '\\"').replace(/\n/g, "; ")}"`,
      { encoding: "base64", timeout: 10000, maxBuffer: 10 * 1024 * 1024 },
    );

    const buffer = Buffer.from(output, "base64");
    if (buffer.length === 0) return null;

    return {
      buffer,
      width: 1920, // Will be determined from actual image
      height: 1080,
      timestamp: Date.now(),
    };
  } catch {
    return null;
  }
}

/**
 * Smart capture: tries window capture first, falls back to GDI+ then fullscreen.
 */
export async function smartCapture(gameExe?: string): Promise<CaptureResult> {
  // Try window capture by exe name
  if (gameExe) {
    const windowCapture = await captureWindowByExe(gameExe);
    if (windowCapture) return windowCapture;

    // Fallback to GDI+
    const gdiCapture = await captureWithGDI(gameExe);
    if (gdiCapture) return gdiCapture;
  }

  // Final fallback: capture primary screen
  return captureFullScreen();
}
