import { basename, isAbsolute, resolve, sep } from "node:path";

export const DEFAULT_EXPORT_ZIP_NAME = "screenshots-export.zip";

const MAX_ZIP_NAME_LENGTH = 64;

/**
 * Resolve a renderer-supplied screenshot filename against the screenshot
 * directory. Throws if the resolved path escapes the directory (path
 * traversal via `..`, absolute paths, …). Nested paths that stay inside
 * the directory are allowed; callers that require bare filenames should
 * also call {@link assertBareFilename}.
 */
export function resolveScreenshotPath(dir: string, filename: string): string {
  const base = resolve(dir);
  const resolved = resolve(base, filename);
  if (resolved !== base && !resolved.startsWith(base + sep)) {
    throw new Error("Invalid screenshot path");
  }
  return resolved;
}

/**
 * Reject anything that is not a bare file name: empty names, absolute
 * paths, names containing directory segments or dot segments, and
 * overlong names.
 */
export function assertBareFilename(name: string): void {
  if (
    !name ||
    name.length > 255 ||
    isAbsolute(name) ||
    basename(name) !== name ||
    name === "." ||
    name === ".."
  ) {
    throw new Error(`Invalid screenshot filename: ${name}`);
  }
}

/**
 * Sanitize a user-supplied zip file name into a safe bare filename ending
 * in `.zip`. Directory components are stripped, unsafe characters are
 * replaced, and overlong names are truncated. Falls back to
 * {@link DEFAULT_EXPORT_ZIP_NAME} when nothing usable remains.
 */
export function sanitizeZipName(raw: string): string {
  const cleaned = basename(raw)
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/^\.+/, "")
    .slice(0, MAX_ZIP_NAME_LENGTH);
  const stem = cleaned.replace(/\.zip$/i, "") || "screenshots-export";
  return `${stem.slice(0, MAX_ZIP_NAME_LENGTH - 4)}.zip`;
}
