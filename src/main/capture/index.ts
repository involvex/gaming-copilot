import { execSync } from "node:child_process";

import { desktopCapturer, nativeImage } from "electron";

export interface CaptureResult {
  buffer: Buffer;
  width: number;
  height: number;
  timestamp: number;
  format: "png" | "jpeg";
}

export interface RegionBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

const SAFE_EXE_PATTERN = /^[\w.-]+\.exe$/;

function ensureExeExtension(exeName: string): string {
  return exeName.endsWith(".exe") ? exeName : `${exeName}.exe`;
}

/**
 * Validate that the exe name is safe (no shell metacharacters) before
 * interpolating it into shell commands.
 */
function validateExeName(exeName: string): boolean {
  const name = ensureExeExtension(exeName);
  return SAFE_EXE_PATTERN.test(name);
}

/**
 * Crop a buffer to the specified region using GDI+.
 * Preserves the original format (PNG or JPEG).
 */
function cropBuffer(buffer: Buffer, region: RegionBounds, format: "png" | "jpeg"): Buffer {
  const imageFormat = format === "jpeg" ? "Jpeg" : "Png";
  try {
    const script = `
Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromStream([System.IO.MemoryStream]::new([Convert]::FromBase64String('${buffer.toString("base64")}')))
$cropped = New-Object System.Drawing.Bitmap ${region.width}, ${region.height}
$g = [System.Drawing.Graphics]::FromImage($cropped)
$g.DrawImage($img, -${region.x}, -${region.y}, $img.Width, $img.Height)
$ms = New-Object System.IO.MemoryStream
$cropped.Save($ms, [System.Drawing.Imaging.ImageFormat]::${imageFormat})
[Convert]::ToBase64String($ms.ToArray())
$g.Dispose(); $cropped.Dispose(); $img.Dispose()
`.trim();

    const output = execSync(
      `powershell -NoProfile -Command "${script.replace(/"/g, '\\"').replace(/\n/g, "; ")}"`,
      { encoding: "base64", timeout: 10000, maxBuffer: 10 * 1024 * 1024 },
    );

    const cropped = Buffer.from(output, "base64");
    return cropped.length > 0 ? cropped : buffer;
  } catch {
    return buffer;
  }
}

/**
 * Capture a screenshot of a specific window by its executable name.
 * Uses Electron desktopCapturer for windowed/borderless games.
 * @param quality - JPEG quality (1-100). PNG used if 100 or undefined.
 */
export async function captureWindowByExe(
  exeName: string,
  quality?: number,
): Promise<CaptureResult | null> {
  const { findProcessByExe } = await import("./win32");
  const pid = findProcessByExe(exeName);
  if (!pid) return null;

  const sources = await desktopCapturer.getSources({
    types: ["window"],
    thumbnailSize: { width: 1920, height: 1080 },
  });

  const exe = ensureExeExtension(exeName).toLowerCase().replace(".exe", "");
  const source = sources.find((s) => s.name.toLowerCase().includes(exe));

  if (source) {
    const thumbnail = source.thumbnail;
    const format: "png" | "jpeg" = quality && quality < 100 ? "jpeg" : "png";
    const buffer = format === "jpeg" ? thumbnail.toJPEG(quality ?? 80) : thumbnail.toPNG();
    return {
      buffer,
      width: thumbnail.getSize().width,
      height: thumbnail.getSize().height,
      timestamp: Date.now(),
      format,
    };
  }

  return null;
}

/**
 * Capture the primary screen using Electron desktopCapturer.
 * @param quality - JPEG quality (1-100). PNG used if 100 or undefined.
 */
export async function captureFullScreen(quality?: number): Promise<CaptureResult> {
  const sources = await desktopCapturer.getSources({
    types: ["screen"],
    thumbnailSize: { width: 1920, height: 1080 },
  });

  const primaryScreen = sources[0];
  if (!primaryScreen) {
    throw new Error("No screen found");
  }

  const thumbnail = primaryScreen.thumbnail;
  const format: "png" | "jpeg" = quality && quality < 100 ? "jpeg" : "png";
  const buffer = format === "jpeg" ? thumbnail.toJPEG(quality ?? 80) : thumbnail.toPNG();
  return {
    buffer,
    width: thumbnail.getSize().width,
    height: thumbnail.getSize().height,
    timestamp: Date.now(),
    format,
  };
}

/**
 * Capture using Windows GDI+ fallback (for exclusive fullscreen games).
 * This runs a PowerShell script that uses CopyFromScreen.
 * @param quality - JPEG quality (1-100). PNG used if 100 or undefined.
 */
export async function captureWithGDI(
  exeName: string,
  quality?: number,
): Promise<CaptureResult | null> {
  const { findProcessByExe, getWindowTitleByPid } = await import("./win32");
  const pid = findProcessByExe(exeName);
  if (!pid) return null;

  const title = getWindowTitleByPid(pid);
  if (!title) return null;

  const format: "png" | "jpeg" = quality && quality < 100 ? "jpeg" : "png";
  const jpegEncoder =
    format === "jpeg" && quality !== undefined
      ? `$jpegEncoder = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/jpeg" }; $encoderParams = New-Object System.Drawing.Imaging.EncoderParameters(1); $encoderParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]@(${quality})); $bitmap.Save($ms, $jpegEncoder, $encoderParams);`
      : `$bitmap.Save($ms, [System.Drawing.Imaging.ImageFormat]::${format === "jpeg" ? "Jpeg" : "Png"})`;

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
  ${jpegEncoder}
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
      width: 1920,
      height: 1080,
      timestamp: Date.now(),
      format,
    };
  } catch {
    return null;
  }
}

/**
 * Smart capture: tries window capture first, falls back to GDI+ then fullscreen.
 * Optionally crops to a region.
 * @param exeName - Process exe name to capture (e.g. "Neuz.exe")
 * @param region - Optional crop region bounds
 * @param quality - Optional JPEG quality (1-100). PNG used if 100 or undefined.
 */
export async function smartCapture(
  gameExe?: string,
  region?: RegionBounds,
  quality?: number,
): Promise<CaptureResult> {
  let result: CaptureResult;

  if (gameExe && validateExeName(gameExe)) {
    const windowCapture = await captureWindowByExe(gameExe, quality);
    if (windowCapture) {
      result = windowCapture;
    } else {
      const gdiCapture = await captureWithGDI(gameExe, quality);
      if (gdiCapture) {
        result = gdiCapture;
      } else {
        result = await captureFullScreen(quality);
      }
    }
  } else {
    result = await captureFullScreen(quality);
  }

  if (region && region.width > 0 && region.height > 0) {
    const croppedBuffer = cropBuffer(result.buffer, region, result.format);
    return {
      buffer: croppedBuffer,
      width: region.width,
      height: region.height,
      timestamp: result.timestamp,
      format: result.format,
    };
  }

  return result;
}

const DEFAULT_MAX_IMAGE_WIDTH = 1024;

/**
 * Resize an image buffer to a maximum width while maintaining aspect ratio.
 * Uses JPEG compression when quality < 100, otherwise preserves PNG.
 * If quality is 100 (or the image is already small enough), downsizing still
 * applies but PNG format is used (lossless).
 * Returns the resized/compressed buffer.
 */
export function resizeImage(
  buffer: Buffer,
  format: "png" | "jpeg",
  quality: number,
  maxWidth: number = DEFAULT_MAX_IMAGE_WIDTH,
): Buffer {
  const image = nativeImage.createFromBuffer(buffer);

  if (image.isEmpty()) {
    return buffer;
  }

  const { width, height } = image.getSize();
  const shouldResize = width > maxWidth;
  const shouldCompress = format === "jpeg" && quality < 100;

  if (!shouldResize && !shouldCompress) {
    return buffer;
  }

  let result = image;
  if (shouldResize) {
    const newHeight = Math.round((height * maxWidth) / width);
    result = image.resize({ width: maxWidth, height: newHeight });
  }

  if (shouldCompress) {
    return result.toJPEG(quality);
  }

  return result.toPNG();
}
