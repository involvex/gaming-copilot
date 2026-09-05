import { registerAiHandlers } from "./ai";
import { registerAppHandlers } from "./app";
import { registerCaptureHandlers } from "./capture";
import { registerChatHandlers } from "./chat";
import { registerConfigHandlers } from "./config";
import type { IpcContext } from "./context";
import { registerGamesHandlers } from "./games";
import { registerOverlayHandlers } from "./overlay";
import { registerPluginHandlers } from "./plugins";
import { registerScreenshotHandlers } from "./screenshots";
import { registerWindowHandlers } from "./window";

export function registerIpcHandlers(ctx: IpcContext): void {
  registerCaptureHandlers(ctx);
  registerAiHandlers(ctx);
  registerConfigHandlers(ctx);
  registerGamesHandlers(ctx);
  registerScreenshotHandlers(ctx);
  registerChatHandlers(ctx);
  registerOverlayHandlers(ctx);
  registerWindowHandlers(ctx);
  registerPluginHandlers(ctx);
  registerAppHandlers(ctx);
}
