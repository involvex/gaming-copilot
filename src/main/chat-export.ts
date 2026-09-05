import type { ChatMessage } from "../shared/types";

export type ChatExportFormat = "markdown" | "json";

/**
 * Render chat history for export. Pure string building with no I/O, so it
 * can be unit-tested without the Electron mock (same precedent as
 * `screenshot-paths.ts`).
 */
export function formatChatExport(messages: ChatMessage[], format: ChatExportFormat): string {
  if (format === "markdown") {
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
}
