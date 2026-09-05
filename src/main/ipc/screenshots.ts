import { readdir, stat, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import AdmZip from "adm-zip";
import { ipcMain } from "electron";
import { z } from "zod";
import { validateIPC } from "../schemas";
import {
  assertBareFilename,
  bulkRenameFiles,
  loadFavorites,
  resolveScreenshotPath,
  sanitizeZipName,
  toggleFavorite,
} from "../screenshot-paths";
import type { IpcContext } from "./context";

export function registerScreenshotHandlers(ctx: IpcContext): void {
  // NB: no caller-supplied directory — listing is always scoped to the
  // configured screenshot dir so the channel can't enumerate arbitrary paths.
  ipcMain.handle("screenshots:list", async () => {
    const dir = ctx.appConfig.screenshotDir;
    if (!dir) return [];
    try {
      const files = await readdir(dir);
      const imageFiles = files.filter((f) => /\.(png|jpe?g|gif|webp)$/i.test(f));
      const entries = await Promise.all(
        imageFiles.map(async (filename) => {
          const filepath = join(dir, filename);
          try {
            const info = await stat(filepath);
            return {
              filename,
              path: filepath,
              size: info.size,
              mtime: info.mtimeMs,
            };
          } catch {
            return null;
          }
        }),
      );
      return entries
        .filter((e): e is NonNullable<typeof e> => e !== null)
        .sort((a, b) => b.mtime - a.mtime);
    } catch (error) {
      ctx.logger.error("Screenshots", `Failed to list screenshots: ${error}`);
      return [];
    }
  });

  ipcMain.handle("screenshots:delete", async (_event, filepath: unknown) => {
    const validPath = validateIPC(z.string(), filepath);
    if (!ctx.appConfig.saveScreenshots || !ctx.appConfig.screenshotDir) {
      return false;
    }
    let resolved: string;
    try {
      resolved = resolveScreenshotPath(ctx.appConfig.screenshotDir, validPath);
    } catch {
      ctx.logger.warn("Screenshots", "Rejected invalid screenshot path for delete");
      return false;
    }
    try {
      const { unlink } = await import("node:fs/promises");
      await unlink(resolved);
      ctx.logger.info("Screenshots", `Deleted: ${resolved}`);
      return true;
    } catch (error) {
      ctx.logger.error("Screenshots", `Failed to delete screenshot: ${error}`);
      return false;
    }
  });

  ipcMain.handle("screenshots:open", async (_event, filepath: unknown) => {
    const validPath = validateIPC(z.string(), filepath);
    if (!ctx.appConfig.saveScreenshots || !ctx.appConfig.screenshotDir) {
      return false;
    }
    let resolved: string;
    try {
      resolved = resolveScreenshotPath(ctx.appConfig.screenshotDir, validPath);
    } catch {
      ctx.logger.warn("Screenshots", "Rejected invalid screenshot path for open");
      return false;
    }
    try {
      const { shell } = await import("electron");
      await shell.openPath(resolved);
      return true;
    } catch (error) {
      ctx.logger.error("Screenshots", `Failed to open screenshot: ${error}`);
      return false;
    }
  });

  ipcMain.handle("screenshots:open-containing-folder", async (_event, filename: unknown) => {
    validateIPC(z.string(), filename);
    if (!ctx.appConfig.saveScreenshots || !ctx.appConfig.screenshotDir) {
      return false;
    }
    try {
      const { shell } = await import("electron");
      await shell.openPath(ctx.appConfig.screenshotDir);
      return true;
    } catch (error) {
      ctx.logger.error("Screenshots", `Failed to open containing folder: ${error}`);
      return false;
    }
  });

  ipcMain.handle("screenshots:copy-path", async (_event, path: unknown) => {
    const validPath = validateIPC(z.string(), path);
    try {
      const { clipboard } = await import("electron");
      clipboard.writeText(validPath);
      return true;
    } catch (error) {
      ctx.logger.error("Screenshots", `Failed to copy path: ${error}`);
      return false;
    }
  });

  const tagsFilePath = (dir: string) => join(dir, "screenshot-tags.json");

  async function loadTags(dir: string): Promise<Record<string, string[]>> {
    try {
      const { readFile } = await import("node:fs/promises");
      const data = await readFile(tagsFilePath(dir), "utf-8");
      return JSON.parse(data);
    } catch {
      return {};
    }
  }

  async function saveTags(dir: string, tags: Record<string, string[]>): Promise<void> {
    await writeFile(tagsFilePath(dir), JSON.stringify(tags, null, 2), "utf-8");
  }

  ipcMain.handle("screenshots:get-tags", async () => {
    if (!ctx.appConfig.screenshotDir) return {};
    return loadTags(ctx.appConfig.screenshotDir);
  });

  ipcMain.handle("screenshots:set-tags", async (_event, input: unknown) => {
    const parsed = validateIPC(
      z.object({ filename: z.string(), tags: z.array(z.string()) }),
      input,
    );
    if (!ctx.appConfig.screenshotDir) return false;
    const tags = await loadTags(ctx.appConfig.screenshotDir);
    tags[parsed.filename] = parsed.tags;
    await saveTags(ctx.appConfig.screenshotDir, tags);
    return true;
  });

  ipcMain.handle("screenshots:toggle-favorite", async (_event, filename: unknown) => {
    const validName = validateIPC(z.string(), filename);
    if (!ctx.appConfig.screenshotDir) return false;
    try {
      return await toggleFavorite(ctx.appConfig.screenshotDir, validName);
    } catch {
      return false;
    }
  });

  ipcMain.handle("screenshots:get-favorites", async () => {
    if (!ctx.appConfig.screenshotDir) return {};
    return loadFavorites(ctx.appConfig.screenshotDir);
  });

  ipcMain.handle("screenshots:bulk-rename", async (_event, input: unknown) => {
    const parsed = validateIPC(
      z.object({
        filenames: z.array(z.string()),
        mode: z.enum(["prefix", "suffix", "replace"]),
        value: z.string(),
        find: z.string().optional(),
      }),
      input,
    );
    if (!ctx.appConfig.saveScreenshots || !ctx.appConfig.screenshotDir) {
      return { success: false, error: "Screenshot saving is not enabled" };
    }
    try {
      const { results, conflicts } = await bulkRenameFiles(ctx.appConfig.screenshotDir, parsed);
      ctx.logger.info("Screenshots", `Renamed ${results.length} files`);
      return {
        success: true,
        results,
        conflicts: conflicts.length > 0 ? conflicts : undefined,
      };
    } catch (error) {
      ctx.logger.error("Screenshots", `Failed to rename: ${error}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Rename failed",
      };
    }
  });

  ipcMain.handle("screenshots:get-metadata", async (_event, filename: unknown) => {
    const validName = validateIPC(z.string(), filename);
    if (!ctx.appConfig.screenshotDir) return null;
    try {
      const filepath = resolveScreenshotPath(ctx.appConfig.screenshotDir, validName);
      const { stat } = await import("node:fs/promises");
      const info = await stat(filepath);
      const { nativeImage } = await import("electron");
      const img = nativeImage.createFromPath(filepath);
      const size = img.getSize();
      return {
        filename: validName,
        path: filepath,
        sizeBytes: info.size,
        width: size.width,
        height: size.height,
        createdAt: info.birthtimeMs,
        modifiedAt: info.mtimeMs,
        format: extname(validName).slice(1).toUpperCase() || "UNKNOWN",
      };
    } catch (error) {
      ctx.logger.error("Screenshots", `Failed to get metadata: ${error}`);
      return null;
    }
  });

  ipcMain.handle("screenshots:export-zip", async (_event, input: unknown) => {
    const parsed = validateIPC(
      z.object({
        filenames: z.array(z.string().min(1).max(255)).min(1).max(1000),
        zipName: z.string().min(1).max(100).default("screenshots-export.zip"),
      }),
      input,
    );
    if (!ctx.appConfig.saveScreenshots || !ctx.appConfig.screenshotDir) {
      return { success: false, error: "Screenshot saving is not enabled" };
    }
    try {
      const zip = new AdmZip();
      for (const filename of parsed.filenames) {
        assertBareFilename(filename);
        const filepath = resolveScreenshotPath(ctx.appConfig.screenshotDir, filename);
        zip.addLocalFile(filepath, "", filename);
      }
      const zipPath = resolveScreenshotPath(
        ctx.appConfig.screenshotDir,
        sanitizeZipName(parsed.zipName),
      );
      zip.writeZip(zipPath);
      ctx.logger.info("Screenshots", `Exported ZIP: ${zipPath}`);
      const { shell } = await import("electron");
      await shell.openPath(ctx.appConfig.screenshotDir);
      return { success: true, path: zipPath };
    } catch (error) {
      ctx.logger.error("Screenshots", `Failed to export ZIP: ${error}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Export failed",
      };
    }
  });
}
