import { globalShortcut, ipcMain } from "electron";
import { hotkeySchema, validateIPC } from "../schemas";

export interface HotkeyValidationResult {
  valid: boolean;
  conflict: boolean;
  registeredBy: string | null;
}

export function validateHotkey(candidate: unknown): HotkeyValidationResult {
  let accelerator: string;
  try {
    accelerator = validateIPC(hotkeySchema, candidate);
  } catch {
    return { valid: false, conflict: false, registeredBy: null };
  }

  if (!accelerator || typeof accelerator !== "string" || accelerator.trim() === "") {
    return { valid: false, conflict: false, registeredBy: null };
  }

  const trimmed = accelerator.trim();

  try {
    const isAlreadyRegistered = globalShortcut.isRegistered(trimmed);
    if (isAlreadyRegistered) {
      return { valid: true, conflict: true, registeredBy: "this-app" };
    }

    const registered = globalShortcut.register(trimmed, () => {});
    if (!registered) {
      return { valid: false, conflict: false, registeredBy: null };
    }

    globalShortcut.unregister(trimmed);
    return { valid: true, conflict: false, registeredBy: null };
  } catch {
    return { valid: false, conflict: false, registeredBy: null };
  }
}

export function registerHotkeyHandlers(): void {
  ipcMain.handle("hotkeys:validate", (_event, candidate: unknown) => {
    return validateHotkey(candidate);
  });
}
