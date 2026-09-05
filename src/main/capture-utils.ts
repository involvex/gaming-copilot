/**
 * Pure capture helpers. No Electron imports and no I/O, so they can be
 * unit-tested without the Electron mock (same precedent as
 * `screenshot-paths.ts`). The IPC handlers in `ipc/capture.ts` validate
 * input at the boundary and delegate here.
 */

/**
 * Check a renderer-supplied game executable name. The name may omit the
 * `.exe` suffix; anything that is not a bare `<name>.exe` (letters,
 * digits, `_`, `.`, `-`) is rejected so the handler never passes a
 * shell-hostile string to the process lookup.
 */
export function isValidGameExeName(name: string): boolean {
  return /^[\w.-]+\.exe$/.test(name.endsWith(".exe") ? name : `${name}.exe`);
}

export interface ParsedScreenshotDataUrl {
  mimeType: string;
  ext: string;
  buffer: Buffer;
}

/**
 * Parse a `data:image/...;base64,...` URL into its parts. Returns `null`
 * when the URL is not a well-formed base64 image data URL.
 */
export function parseScreenshotDataUrl(dataUrl: string): ParsedScreenshotDataUrl | null {
  const match = dataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match?.[1] || !match[2]) return null;
  const mimeType = match[1];
  return {
    mimeType,
    ext: mimeType.replace("image/", ""),
    buffer: Buffer.from(match[2], "base64"),
  };
}

/**
 * Build a timestamped screenshot filename for the given image extension.
 * The `now` parameter exists so tests can pin the clock; handlers pass the
 * current time by default.
 */
export function buildScreenshotFilename(ext: string, now: Date = new Date()): string {
  const timestamp = now.toISOString().replace(/[:.]/g, "-");
  return `gaming-copilot_${timestamp}.${ext}`;
}
