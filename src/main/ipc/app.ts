import { app, ipcMain } from "electron";

import type { IpcContext } from "./context";

export function registerAppHandlers(ctx: IpcContext): void {
  ipcMain.handle("app:update", async (_event, action: string) => {
    if (action === "check") {
      const result = await ctx.autoUpdater.checkForUpdates();
      if (!result) {
        return { status: "not-available" };
      }
      return { status: "checking" };
    }
    if (action === "install") {
      ctx.autoUpdater.quitAndInstall();
      return { status: "installing" };
    }
    return { status: "unknown" };
  });

  ipcMain.handle("app:get-version", () => {
    return app.getVersion();
  });
}
