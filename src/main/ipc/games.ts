import { ipcMain } from "electron";
import { z } from "zod";
import { setConfigValue } from "../config";
import { addGameEntry, removeGameEntry, updateGameEntry } from "../game-entries";
import { gameEntrySchema, validateIPC } from "../schemas";
import type { IpcContext } from "./context";

export function registerGamesHandlers(ctx: IpcContext): void {
  ipcMain.handle("games:add", (_event, game: unknown) => {
    const parsed = validateIPC(gameEntrySchema, game);
    ctx.appConfig.games = addGameEntry(ctx.appConfig.games, parsed);
    setConfigValue("games", ctx.appConfig.games);
    ctx.logger.info("Games", `Added game: ${parsed.name} (${parsed.exe})`);
    ctx.emitConfigUpdated();
    return parsed;
  });

  ipcMain.handle("games:update", (_event, game: unknown) => {
    const parsed = validateIPC(gameEntrySchema, game);
    ctx.appConfig.games = updateGameEntry(ctx.appConfig.games, parsed);
    setConfigValue("games", ctx.appConfig.games);
    ctx.logger.info("Games", `Updated game: ${parsed.name} (${parsed.exe})`);
    ctx.emitConfigUpdated();
    return parsed;
  });

  ipcMain.handle("games:remove", (_event, id: unknown) => {
    const validId = validateIPC(z.string().uuid(), id);
    const { games, removed } = removeGameEntry(ctx.appConfig.games, validId);
    ctx.appConfig.games = games;
    setConfigValue("games", ctx.appConfig.games);
    ctx.logger.info("Games", `Removed game: ${removed.name} (${removed.exe})`);
    ctx.emitConfigUpdated();
    return true;
  });

  ipcMain.handle("games:list", () => {
    return ctx.appConfig.games;
  });
}
