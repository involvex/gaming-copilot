import { access, readFile, rename, writeFile } from "node:fs/promises";
import { basename, extname, isAbsolute, join, resolve, sep } from "node:path";

export const DEFAULT_EXPORT_ZIP_NAME = "screenshots-export.zip";

const MAX_ZIP_NAME_LENGTH = 64;

const FAVORITES_FILENAME = "screenshot-favorites.json";

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

export async function loadFavorites(dir: string): Promise<Record<string, boolean>> {
  try {
    const data = await readFile(join(dir, FAVORITES_FILENAME), "utf-8");
    return JSON.parse(data);
  } catch {
    return {};
  }
}

export async function saveFavorites(
  dir: string,
  favorites: Record<string, boolean>,
): Promise<void> {
  await writeFile(join(dir, FAVORITES_FILENAME), JSON.stringify(favorites, null, 2), "utf-8");
}

/**
 * Flip the favorite flag for a screenshot. Throws on path traversal so
 * callers can fail closed. Returns the new state.
 */
export async function toggleFavorite(dir: string, filename: string): Promise<boolean> {
  resolveScreenshotPath(dir, filename);
  const favorites = await loadFavorites(dir);
  favorites[filename] = !favorites[filename];
  await saveFavorites(dir, favorites);
  return favorites[filename];
}

export interface BulkRenameInput {
  filenames: string[];
  mode: "prefix" | "suffix" | "replace";
  value: string;
  find?: string;
}

export interface BulkRenameResult {
  results: Array<{ old: string; new: string }>;
  conflicts: string[];
}

/**
 * Rename screenshot files on disk. Every source and destination name is
 * resolved against `dir` — traversal throws and aborts the batch. Existing
 * destinations are reported as conflicts and left untouched.
 */
export async function bulkRenameFiles(
  dir: string,
  input: BulkRenameInput,
): Promise<BulkRenameResult> {
  const results: Array<{ old: string; new: string }> = [];
  const conflicts: string[] = [];
  for (const oldName of input.filenames) {
    const oldPath = resolveScreenshotPath(dir, oldName);
    const ext = extname(oldName);
    const base = oldName.slice(0, oldName.lastIndexOf("."));
    let newBase = base;
    if (input.mode === "prefix") {
      newBase = `${input.value}${base}`;
    } else if (input.mode === "suffix") {
      newBase = `${base}${input.value}`;
    } else if (input.mode === "replace") {
      newBase = base.replace(input.find || "", input.value);
    }
    const newName = `${newBase}${ext}`;
    if (newName !== oldName) {
      const newPath = resolveScreenshotPath(dir, newName);
      try {
        await access(newPath);
        conflicts.push(newName);
      } catch {
        await rename(oldPath, newPath);
        results.push({ old: oldName, new: newName });
      }
    }
  }
  return { results, conflicts };
}
