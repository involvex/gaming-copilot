import { ipcMain } from "electron";
import { MemreaderPlugin } from "../plugins";
import type { IpcContext } from "./context";

export function registerPluginHandlers(ctx: IpcContext): void {
  ipcMain.handle("plugin:memreader:start", async () => {
    if (!ctx.memreaderPlugin) {
      ctx.memreaderPlugin = new MemreaderPlugin(ctx.appConfig.plugins.bunMemreader);
    }
    await ctx.memreaderPlugin.start();
    return ctx.memreaderPlugin.isConnected();
  });

  ipcMain.handle("plugin:memreader:stop", () => {
    ctx.memreaderPlugin?.stop();
    return true;
  });

  ipcMain.handle("plugin:memreader:state", () => {
    return ctx.memreaderPlugin?.getState() || null;
  });

  ipcMain.handle("plugin:memreader:connected", () => {
    return ctx.memreaderPlugin?.isConnected() || false;
  });
}
