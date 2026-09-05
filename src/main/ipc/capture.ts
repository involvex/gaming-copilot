import { ipcMain, screen } from "electron";
import { z } from "zod";
import { recordScreen, resizeImage, smartCapture } from "../capture";
import { findProcessByExe } from "../capture/win32";
import {
  buildScreenshotFilename,
  isValidGameExeName,
  parseScreenshotDataUrl,
} from "../capture-utils";
import { setConfigValue } from "../config";
import { exeNameSchema, regionBoundsSchema, validateIPC } from "../schemas";
import type { IpcContext } from "./context";

export function registerCaptureHandlers(ctx: IpcContext): void {
  ipcMain.handle("capture:get-screens", () => {
    const displays = screen.getAllDisplays();
    return displays.map((d, index) => ({
      index,
      name: d.label || `Display ${index + 1}`,
      bounds: d.bounds,
      workArea: d.workArea,
      primary: screen.getPrimaryDisplay().id === d.id,
    }));
  });

  ipcMain.handle("capture:screenshot", async () => {
    const region = ctx.appConfig.captureRegion;
    const result = await smartCapture(
      ctx.appConfig.gameExe || undefined,
      region,
      ctx.appConfig.captureQuality,
      ctx.appConfig.monitorIndex,
    );
    if (!result) return null;
    const resizedBuffer = resizeImage(
      result.buffer,
      result.format,
      ctx.appConfig.captureQuality,
      ctx.appConfig.maxImageWidth,
    );
    const mimeType = result.format === "jpeg" ? "image/jpeg" : "image/png";
    return `data:${mimeType};base64,${resizedBuffer.toString("base64")}`;
  });

  ipcMain.handle("capture:record", async () => {
    const result = await recordScreen(
      ctx.appConfig.recordDuration,
      ctx.appConfig.captureQuality,
      ctx.appConfig.monitorIndex,
    );
    if (!result) return null;
    const resizedBuffer = resizeImage(
      result.buffer,
      result.format,
      ctx.appConfig.captureQuality,
      ctx.appConfig.maxImageWidth,
    );
    const mimeType = result.format === "jpeg" ? "image/jpeg" : "image/png";
    return `data:${mimeType};base64,${resizedBuffer.toString("base64")}`;
  });

  ipcMain.handle("capture:preview", async () => {
    const region = ctx.appConfig.captureRegion;
    const result = await smartCapture(
      ctx.appConfig.gameExe || undefined,
      region,
      ctx.appConfig.captureQuality,
      ctx.appConfig.monitorIndex,
    );
    if (!result) return null;
    const resizedBuffer = resizeImage(
      result.buffer,
      result.format,
      ctx.appConfig.captureQuality,
      256,
    );
    const mimeType = result.format === "jpeg" ? "image/jpeg" : "image/png";
    return `data:${mimeType};base64,${resizedBuffer.toString("base64")}`;
  });

  ipcMain.handle("capture:check-game", (_event, exeName: unknown) => {
    const name = validateIPC(exeNameSchema, exeName);
    if (!isValidGameExeName(name)) {
      return { running: false, pid: null };
    }
    const pid = findProcessByExe(name);
    return { running: pid !== null, pid };
  });

  ipcMain.handle("capture:set-region", (_event, region: unknown) => {
    const parsed = region === null ? null : validateIPC(regionBoundsSchema, region);
    ctx.appConfig.captureRegion = parsed || undefined;
    setConfigValue("captureRegion", parsed || undefined);
    ctx.logger.info(
      "Capture",
      parsed ? `Region set: ${parsed.width}x${parsed.height}` : "Region cleared",
    );
  });

  ipcMain.handle("capture:pick-directory", async () => {
    const { dialog } = await import("electron");
    const result = await dialog.showOpenDialog(ctx.mainWindow!, {
      properties: ["openDirectory", "createDirectory"],
      title: "Select screenshot save directory",
    });
    if (!result.canceled && result.filePaths[0]) {
      ctx.appConfig.screenshotDir = result.filePaths[0];
      setConfigValue("screenshotDir", ctx.appConfig.screenshotDir);
      return ctx.appConfig.screenshotDir;
    }
    return null;
  });

  ipcMain.handle("capture:save-screenshot", async (_event, dataUrl: unknown) => {
    const validUrl = validateIPC(z.string().url(), dataUrl);
    if (!ctx.appConfig.saveScreenshots || !ctx.appConfig.screenshotDir) {
      return false;
    }
    try {
      const parsed = parseScreenshotDataUrl(validUrl);
      if (!parsed) {
        ctx.logger.warn("Capture", "Failed to save screenshot: invalid data URL format");
        return false;
      }
      const filename = buildScreenshotFilename(parsed.ext);
      const filepath = `${ctx.appConfig.screenshotDir}/${filename}`;
      const { writeFile } = await import("node:fs/promises");
      await writeFile(filepath, parsed.buffer);
      ctx.logger.info("Capture", `Screenshot saved: ${filepath}`);
      return true;
    } catch (error) {
      ctx.logger.error("Capture", `Failed to save screenshot: ${error}`);
      return false;
    }
  });
}
