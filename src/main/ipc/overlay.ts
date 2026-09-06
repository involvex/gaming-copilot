import { ipcMain } from "electron";
import { z } from "zod";
import { setConfigValue } from "../config";
import { booleanSchema, validateIPC } from "../schemas";
import type { IpcContext } from "./context";

export function registerOverlayHandlers(ctx: IpcContext): void {
  ipcMain.handle("overlay:show", (_event, text: unknown) => {
    const validText = validateIPC(z.string(), text);
    ctx.overlayWindow?.webContents.send("overlay:data", validText);
    ctx.overlayWindow?.show();
  });

  ipcMain.handle("overlay:hide", () => {
    ctx.overlayWindow?.hide();
  });

  ipcMain.handle("overlay:toggle", () => {
    ctx.toggleOverlay();
  });

  ipcMain.handle("overlay:set-click-through", (_event, enable: unknown) => {
    const parsed = validateIPC(booleanSchema, enable);
    ctx.appConfig.overlay.clickThrough = parsed;
    setConfigValue("overlay", ctx.appConfig.overlay);
    ctx.emitConfigUpdated();
    ctx.overlayWindow?.setIgnoreMouseEvents(parsed);
  });

  ipcMain.handle("overlay:set-css", (_event, css: unknown) => {
    const rawCss = validateIPC(z.string(), css);
    const sanitizedCss = rawCss
      .replace(/@import\b[^;]+;?/gi, "")
      .replace(/@font-face\b[^^{]*\{[^}]*\}/gi, "")
      .replace(/url\s*\([^)]*\)/gi, "url('' )");
    ctx.appConfig.overlay.customCSS = sanitizedCss;
    setConfigValue("overlay", ctx.appConfig.overlay);
    ctx.emitConfigUpdated();
    ctx.overlayWindow?.webContents.send("overlay:set-css", sanitizedCss);
  });

  ipcMain.handle("overlay:set-persistent", (_event, persistent: unknown) => {
    const parsed = validateIPC(booleanSchema, persistent);
    ctx.appConfig.overlay.persistent = parsed;
    setConfigValue("overlay", ctx.appConfig.overlay);
    ctx.emitConfigUpdated();
  });

  ipcMain.handle("overlay:annotate", (_event, dataUrl: unknown) => {
    const validDataUrl = validateIPC(z.string(), dataUrl);
    ctx.overlayWindow?.webContents.send("overlay:annotate", validDataUrl);
    ctx.overlayWindow?.show();
  });

  ipcMain.handle("overlay:annotated", (_event, dataUrl: unknown) => {
    const validDataUrl = validateIPC(z.string(), dataUrl);
    ctx.resolveAnnotation(validDataUrl);
  });
}
