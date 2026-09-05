import { ipcMain } from "electron";
import type { AppConfig } from "../../shared/types";
import { initProviders, updateAutoStart } from "../app-helpers";
import { setConfigValue } from "../config";
import { exportConfigWithoutSecrets, isValidHotkeyFormat } from "../config-utils";
import {
  booleanSchema,
  captureModeSchema,
  configImportSchema,
  endpointConfigSchema,
  fallbackProviderSchema,
  geminiProviderConfigSchema,
  hotkeySchema,
  overlayConfigSchema,
  promptsConfigSchema,
  providerNameSchema,
  ttsConfigSchema,
  validateIPC,
} from "../schemas";
import { deleteKey, getAccount, retrieveKey, storeKey } from "../secure-storage";
import type { IpcContext } from "./context";

export function registerConfigHandlers(ctx: IpcContext): void {
  ipcMain.handle("config:set-game-exe", (_event, exe: string) => {
    ctx.appConfig.gameExe = exe;
    setConfigValue("gameExe", exe);
  });

  ipcMain.handle("config:get", async () => {
    if (ctx.appConfig.useKeychain) {
      const providersCopy = JSON.parse(
        JSON.stringify(ctx.appConfig.providers),
      ) as typeof ctx.appConfig.providers;

      if (providersCopy.gemini) {
        const stored = await retrieveKey("gemini");
        if (stored) providersCopy.gemini.apiKey = stored;
      }

      if (providersCopy.openaiCompat?.endpoints) {
        for (const ep of providersCopy.openaiCompat.endpoints) {
          const account = getAccount("endpoint", ep.name);
          const stored = await retrieveKey(account);
          if (stored) ep.apiKey = stored;
        }
      }

      return { ...ctx.appConfig, providers: providersCopy };
    }
    return ctx.appConfig;
  });

  ipcMain.handle("config:set-provider", async (_event, name: unknown, config: unknown) => {
    const validName = validateIPC(providerNameSchema, name);
    if (validName === "gemini") {
      const parsed = validateIPC(geminiProviderConfigSchema, config);
      ctx.appConfig.providers.gemini = {
        apiKey: parsed.apiKey || "",
        model: parsed.model || "",
        grounding: parsed.grounding ?? false,
      };
    } else {
      const parsed = validateIPC(endpointConfigSchema, config);
      if (!ctx.appConfig.providers.openaiCompat) {
        ctx.appConfig.providers.openaiCompat = { endpoints: [] };
      }
      const existing = ctx.appConfig.providers.openaiCompat.endpoints.findIndex(
        (e) => e.name === validName,
      );
      if (existing >= 0) {
        const current = ctx.appConfig.providers.openaiCompat.endpoints[existing];
        ctx.appConfig.providers.openaiCompat.endpoints[existing] = {
          name: validName,
          baseUrl: parsed.baseUrl ?? current?.baseUrl ?? "",
          apiKey: parsed.apiKey ?? current?.apiKey ?? "",
          model: parsed.model ?? current?.model ?? "",
        };
      } else {
        ctx.appConfig.providers.openaiCompat.endpoints.push({
          name: validName,
          baseUrl: parsed.baseUrl || "",
          apiKey: parsed.apiKey || "",
          model: parsed.model || "",
        });
      }
    }

    let storedApiKey: string | undefined;
    if (ctx.appConfig.useKeychain) {
      const apiKey =
        validName === "gemini"
          ? ctx.appConfig.providers.gemini?.apiKey
          : ctx.appConfig.providers.openaiCompat?.endpoints.find((e) => e.name === validName)
              ?.apiKey;
      if (apiKey) {
        storedApiKey = apiKey;
        try {
          if (validName === "gemini") {
            await storeKey("gemini", apiKey);
            ctx.appConfig.providers.gemini!.apiKey = "";
          } else {
            const account = getAccount("endpoint", validName);
            await storeKey(account, apiKey);
            const ep = ctx.appConfig.providers.openaiCompat?.endpoints.find(
              (e) => e.name === validName,
            );
            if (ep) ep.apiKey = "";
          }
        } catch (keychainError) {
          ctx.logger.warn(
            "Config",
            `Keychain store failed, keeping API key in config: ${keychainError}`,
          );
        }
      }
    }

    setConfigValue("providers", ctx.appConfig.providers);

    if (storedApiKey) {
      if (validName === "gemini" && ctx.appConfig.providers.gemini) {
        ctx.appConfig.providers.gemini.apiKey = storedApiKey;
      } else {
        const ep = ctx.appConfig.providers.openaiCompat?.endpoints.find(
          (e) => e.name === validName,
        );
        if (ep) ep.apiKey = storedApiKey;
      }
    }

    ctx.setProviderManager(initProviders(ctx.appConfig));
    ctx.emitConfigUpdated();
  });

  ipcMain.handle("config:remove-endpoint", async (_event, name: unknown) => {
    const validName = validateIPC(providerNameSchema, name);
    if (!ctx.appConfig.providers.openaiCompat) return;
    ctx.appConfig.providers.openaiCompat.endpoints =
      ctx.appConfig.providers.openaiCompat.endpoints.filter((e) => e.name !== validName);

    if (ctx.appConfig.useKeychain) {
      const account = getAccount("endpoint", validName);
      try {
        await deleteKey(account);
      } catch (keychainError) {
        ctx.logger.warn("Config", `Keychain delete failed for ${validName}: ${keychainError}`);
      }
    }

    setConfigValue("providers", ctx.appConfig.providers);
    ctx.providerManager = initProviders(ctx.appConfig);
    ctx.emitConfigUpdated();
  });

  ipcMain.handle("config:set-active-provider", (_event, name: unknown) => {
    const validName = validateIPC(providerNameSchema, name);
    if (
      validName !== "gemini" &&
      !ctx.appConfig.providers.openaiCompat?.endpoints.some((e) => e.name === validName)
    ) {
      throw new Error(`Unknown provider: ${validName}`);
    }
    ctx.appConfig.activeProvider = validName;
    ctx.providerManager?.setActiveProvider(validName);
    setConfigValue("activeProvider", validName);
    ctx.logger.info("Providers", `Active provider set to: ${validName}`);
    ctx.emitConfigUpdated();
  });

  ipcMain.handle("config:set-fallback-provider", (_event, name: unknown) => {
    const validName = validateIPC(fallbackProviderSchema, name);
    if (validName) {
      if (
        validName !== "gemini" &&
        !ctx.appConfig.providers.openaiCompat?.endpoints.some((e) => e.name === validName)
      ) {
        throw new Error(`Unknown provider: ${validName}`);
      }
    }
    ctx.appConfig.fallbackProvider = validName || null;
    ctx.providerManager?.setFallbackProvider(validName || null);
    setConfigValue("fallbackProvider", validName || null);
    ctx.logger.info("Providers", `Fallback provider set to: ${validName || "none"}`);
    ctx.emitConfigUpdated();
  });

  ipcMain.handle("config:set-overlay", (_event, overlay: unknown) => {
    const parsed = validateIPC(overlayConfigSchema, overlay);
    const positionChanged = parsed.position && parsed.position !== ctx.appConfig.overlay.position;
    ctx.appConfig.overlay = { ...ctx.appConfig.overlay, ...parsed };
    setConfigValue("overlay", ctx.appConfig.overlay);
    if (positionChanged) {
      ctx.repositionOverlay();
      ctx.overlayWindow?.webContents.send("overlay:set-position", ctx.appConfig.overlay.position);
    }
    ctx.emitConfigUpdated();
  });

  ipcMain.handle("config:set-tts", (_event, tts: unknown) => {
    const parsed = validateIPC(ttsConfigSchema, tts);
    ctx.appConfig.tts = { ...ctx.appConfig.tts, ...parsed };
    setConfigValue("tts", ctx.appConfig.tts);
    ctx.emitConfigUpdated();
  });

  ipcMain.handle("config:set-prompts", (_event, prompts: unknown) => {
    const parsed = validateIPC(promptsConfigSchema, prompts);
    ctx.appConfig.prompts = { ...ctx.appConfig.prompts, ...parsed };
    setConfigValue("prompts", ctx.appConfig.prompts);
    ctx.emitConfigUpdated();
  });

  ipcMain.handle("config:set-auto-start", (_event, enable: unknown) => {
    const parsed = validateIPC(booleanSchema, enable);
    ctx.appConfig.autoStart = parsed;
    setConfigValue("autoStart", parsed);
    updateAutoStart(ctx.appConfig);
    ctx.emitConfigUpdated();
  });

  ipcMain.handle("config:set-generic", (_event, key: unknown, value: unknown) => {
    const typedKey = validateIPC(hotkeySchema, key) as keyof typeof ctx.appConfig;
    if (typedKey in ctx.appConfig) {
      ctx.appConfig[typedKey] = value as never;
      setConfigValue(typedKey, value as never);
      ctx.emitConfigUpdated();
    }
  });

  ipcMain.handle("config:set-telemetry", (_event, enabled: unknown) => {
    const parsed = validateIPC(booleanSchema, enabled);
    ctx.appConfig.telemetry = { enabled: parsed };
    setConfigValue("telemetry", { enabled: parsed });
    if (parsed) {
      ctx.logger.info("Telemetry", "Telemetry enabled — anonymous usage data will be collected");
    } else {
      ctx.logger.info("Telemetry", "Telemetry disabled");
    }
    ctx.emitConfigUpdated();
  });

  ipcMain.handle("config:set-capture-mode", (_event, mode: unknown) => {
    const parsed = validateIPC(captureModeSchema, mode);
    ctx.appConfig.captureMode = parsed;
    setConfigValue("captureMode", parsed);
    ctx.logger.info("Capture", `Capture mode set to: ${parsed}`);
    ctx.emitConfigUpdated();
  });

  ipcMain.handle("config:set-hotkey", (_event, hotkey: unknown) => {
    const parsed = validateIPC(hotkeySchema, hotkey);
    if (!isValidHotkeyFormat(parsed)) {
      return false;
    }
    ctx.setHotkey(parsed);
    return true;
  });

  ipcMain.handle("config:set-overlay-hotkey", (_event, hotkey: unknown) => {
    const parsed = validateIPC(hotkeySchema, hotkey);
    if (!isValidHotkeyFormat(parsed)) {
      return false;
    }
    ctx.appConfig.overlayHotkey = parsed;
    setConfigValue("overlayHotkey", parsed);
    ctx.registerHotkey();
    ctx.registerOverlayHotkey();
    ctx.logger.info("Hotkey", `Overlay hotkey set to: ${parsed}`);
    return true;
  });

  ipcMain.handle("config:set-hotkey-enabled", (_event, enabled: unknown) => {
    const parsed = validateIPC(booleanSchema, enabled);
    ctx.appConfig.hotkeyEnabled = parsed;
    setConfigValue("hotkeyEnabled", parsed);
    if (parsed) {
      ctx.registerHotkey();
    } else {
      ctx.unregisterHotkey();
    }
    ctx.logger.info("Hotkey", `Hotkey enabled: ${enabled}`);
    return true;
  });

  ipcMain.handle("config:export", () => {
    return exportConfigWithoutSecrets(ctx.appConfig);
  });

  ipcMain.handle("config:import", async (_event, config: unknown) => {
    const parsed = validateIPC(configImportSchema, config);
    const overlayParsed = validateIPC(overlayConfigSchema, parsed.overlay || {});
    const ttsParsed = validateIPC(ttsConfigSchema, parsed.tts || {});
    const promptsParsed = validateIPC(promptsConfigSchema, parsed.prompts || {});
    const appConfigRecord = ctx.appConfig as unknown as Record<string, unknown>;
    for (const [key, value] of Object.entries(parsed)) {
      if (
        key !== "providers" &&
        key !== "telemetry" &&
        key !== "overlay" &&
        key !== "tts" &&
        key !== "prompts"
      ) {
        appConfigRecord[key] = value;
        setConfigValue(key as keyof AppConfig, value as never);
      }
    }
    ctx.appConfig.overlay = { ...ctx.appConfig.overlay, ...overlayParsed };
    setConfigValue("overlay", ctx.appConfig.overlay);
    ctx.appConfig.tts = { ...ctx.appConfig.tts, ...ttsParsed };
    setConfigValue("tts", ctx.appConfig.tts);
    ctx.appConfig.prompts = { ...ctx.appConfig.prompts, ...promptsParsed };
    setConfigValue("prompts", ctx.appConfig.prompts);
    ctx.logger.info("Config", "Configuration imported successfully");
    return true;
  });
}
