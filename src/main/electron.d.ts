import type { App } from "electron";

declare module "electron" {
  interface App {
    isQuitting?: boolean;
  }
}
