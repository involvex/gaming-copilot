import { ipcMain } from "electron";

import type { IpcContext } from "./context";

export function registerWindowHandlers(ctx: IpcContext): void {
  ipcMain.handle("window:open-settings", () => {
    ctx.mainWindow?.show();
    ctx.mainWindow?.webContents.send("navigate:settings");
  });

  ipcMain.handle("window:minimize", () => {
    ctx.mainWindow?.minimize();
  });

  ipcMain.handle("window:toggle-maximize", () => {
    if (!ctx.mainWindow) return;
    if (ctx.mainWindow.isMaximized()) {
      ctx.mainWindow.unmaximize();
    } else {
      ctx.mainWindow.maximize();
    }
  });

  ipcMain.handle("window:close", () => {
    ctx.mainWindow?.close();
  });
}
