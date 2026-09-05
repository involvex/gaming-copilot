import { ipcMain } from "electron";
import { z } from "zod";
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
    const messages = getChatHistory();
    if (validFormat === "markdown") {
      let md = "# Gaming Copilot Chat History\n\n";
      for (const msg of messages) {
        if (msg.role === "user") {
          md += `## User (${new Date(msg.timestamp).toLocaleString()})\n\n${msg.text}\n\n`;
        } else {
          md += `## Assistant (${new Date(msg.timestamp).toLocaleString()}${msg.provider ? ` · ${msg.provider}` : ""})\n\n${msg.text}\n\n`;
        }
      }
      return md;
    }
    return JSON.stringify(messages, null, 2);
  });
}
