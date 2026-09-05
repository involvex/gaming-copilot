import { ipcMain } from "electron";
import { z } from "zod";
import { setConfigValue } from "../config";
import { gameEntrySchema, validateIPC } from "../schemas";
import type { IpcContext } from "./context";

export function registerGamesHandlers(ctx: IpcContext): void {
  ipcMain.handle("games:add", (_event, game: unknown) => {
    const parsed = validateIPC(gameEntrySchema, game);
    ctx.appConfig.games = [...ctx.appConfig.games, parsed];
    setConfigValue("games", ctx.appConfig.games);
    ctx.logger.info("Games", `Added game: ${parsed.name} (${parsed.exe})`);
    ctx.emitConfigUpdated();
    return parsed;
  });

  ipcMain.handle("games:update", (_event, game: unknown) => {
    const parsed = validateIPC(gameEntrySchema, game);
    const idx = ctx.appConfig.games.findIndex((g) => g.id === parsed.id);
    if (idx < 0) {
      throw new Error(`Game not found: ${parsed.id}`);
    }
    ctx.appConfig.games[idx] = parsed;
    setConfigValue("games", ctx.appConfig.games);
    ctx.logger.info("Games", `Updated game: ${parsed.name} (${parsed.exe})`);
    ctx.emitConfigUpdated();
    return parsed;
  });

  ipcMain.handle("games:remove", (_event, id: unknown) => {
    const validId = validateIPC(z.string().uuid(), id);
    const existing = ctx.appConfig.games.findIndex((g) => g.id === validId);
    if (existing < 0) {
      throw new Error(`Game not found: ${validId}`);
    }
    const removed = ctx.appConfig.games.splice(existing, 1)[0];
    setConfigValue("games", ctx.appConfig.games);
    ctx.logger.info("Games", `Removed game: ${removed?.name} (${removed?.exe})`);
    ctx.emitConfigUpdated();
    return true;
  });

  ipcMain.handle("games:list", () => {
    return ctx.appConfig.games;
  });
}
