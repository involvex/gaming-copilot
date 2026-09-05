import { ipcMain } from "electron";
import { z } from "zod";
import { formatChatExport } from "../chat-export";
import { clearChatHistory, getChatHistory, saveChatHistory } from "../config";
import { chatFormatSchema, chatMessageSchema, validateIPC } from "../schemas";
import type { IpcContext } from "./context";

const chatSaveSchema = z.array(chatMessageSchema);

export function registerChatHandlers(_ctx: IpcContext): void {
  ipcMain.handle("chat:save", (_event, messages: unknown) => {
    const parsed = validateIPC(chatSaveSchema, messages);
    saveChatHistory(parsed);
    return true;
  });

  ipcMain.handle("chat:load", () => {
    return getChatHistory();
  });

  ipcMain.handle("chat:clear", () => {
    clearChatHistory();
    return true;
  });

  ipcMain.handle("chat:export", (_event, format: unknown) => {
    const validFormat = validateIPC(chatFormatSchema, format);
    return formatChatExport(getChatHistory(), validFormat);
  });
}
