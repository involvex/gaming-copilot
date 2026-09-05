import { readdir, stat, writeFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";

import { is } from "@electron-toolkit/utils";
import AdmZip from "adm-zip";
import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  globalShortcut,
  ipcMain,
  Menu,
  Notification,
  nativeImage,
  screen,
  shell,
  Tray,
} from "electron";
import { autoUpdater } from "electron-updater";
import { z } from "zod";

import type { AppConfig } from "../shared/types";
import { ProviderManager } from "./ai-providers";
import { recordScreen, resizeImage, smartCapture } from "./capture";
import { findProcessByExe } from "./capture/win32";
import {
  clearChatHistory,
  getChatHistory,
  initChatStore,
  initConfig,
  saveChatHistory,
  setConfigValue,
} from "./config";
import { logger } from "./logger";
import { extractText, terminateOcrWorker } from "./ocr";
import { MemreaderPlugin } from "./plugins";
import {
  booleanSchema,
  captureModeSchema,
  chatFormatSchema,
  chatMessageSchema,
  configImportSchema,
  endpointConfigSchema,
  exeNameSchema,
  fallbackProviderSchema,
  gameEntrySchema,
  geminiProviderConfigSchema,
  hotkeySchema,
  overlayConfigSchema,
  promptsConfigSchema,
  providerNameSchema,
  regionBoundsSchema,
  ttsConfigSchema,
  validateIPC,
} from "./schemas";
import { deleteKey, getAccount, retrieveKey, storeKey } from "./secure-storage";

export function trackEvent(event: string, metadata?: Record<string, unknown>): void {
  if (!appConfig?.telemetry?.enabled) return;
  logger.info(
    "Telemetry",
    `${event}${metadata ? ` ${JSON.stringify(metadata).slice(0, 200)}` : ""}`,
  );
}

let mainWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let providerManager: ProviderManager | null = null;
let memreaderPlugin: MemreaderPlugin | null = null;

function resolveResourcePath(relativePath: string): string {
  if (is.dev) {
    return join(__dirname, "..", "..", relativePath);
  }
  return join(process.resourcesPath, relativePath);
}

// Load persisted config
const appConfig: AppConfig = initConfig();

function emitConfigUpdated(): void {
  mainWindow?.webContents.send("config:updated");
}

let gameExe = appConfig.gameExe;

function getGameContext(exe: string | undefined): string | undefined {
  if (!exe) return undefined;
  const gameEntry = appConfig.games.find((g) => g.exe === exe);
  if (!gameEntry || gameEntry.urls.length === 0) return undefined;
  return `Game documentation URLs:\n${gameEntry.urls.join("\n")}`;
}

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === "linux"
      ? {
          icon: nativeImage.createFromPath(resolveResourcePath("resources/icon.png")),
        }
      : {}),
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false,
      contextIsolation: true,
    },
  });

  mainWindow.on("ready-to-show", () => {
    mainWindow?.show();
    if (is.dev) {
      mainWindow?.webContents.openDevTools({ mode: "detach" });
    }
    logger.info("MainWindow", "Window ready");
  });

  mainWindow.on("close", (e) => {
    if (app.isQuitting) return;
    if (appConfig.minimizeToTray && tray) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });

  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

const OVERLAY_WIN_WIDTH = 420;
const OVERLAY_WIN_HEIGHT = 220;

function calculateOverlayPosition(position: AppConfig["overlay"]["position"]): {
  x?: number;
  y?: number;
} {
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
  let x: number | undefined;
  let y: number | undefined;
  switch (position) {
    case "top-left":
      x = 20;
      y = 20;
      break;
    case "top-right":
      x = screenWidth - OVERLAY_WIN_WIDTH;
      y = 20;
      break;
    case "bottom-left":
      x = 20;
      y = screenHeight - OVERLAY_WIN_HEIGHT;
      break;
    case "bottom-right":
      x = screenWidth - OVERLAY_WIN_WIDTH;
      y = screenHeight - OVERLAY_WIN_HEIGHT;
      break;
  }
  return { x, y };
}

function createOverlayWindow(): void {
  const { x, y } = calculateOverlayPosition(appConfig.overlay.position);

  overlayWindow = new BrowserWindow({
    width: 400,
    height: 200,
    x,
    y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focusable: false,
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false,
      contextIsolation: true,
    },
  });

  overlayWindow.setVisibleOnAllWorkspaces(true);
  overlayWindow.setAlwaysOnTop(true, "screen-saver");
  overlayWindow.setIgnoreMouseEvents(appConfig.overlay.clickThrough);

  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    overlayWindow.loadURL(`${process.env.ELECTRON_RENDERER_URL}/#/overlay`);
  } else {
    overlayWindow.loadFile(join(__dirname, "../renderer/index.html"), {
      hash: "/overlay",
    });
  }

  overlayWindow.hide();
  logger.info("Overlay", "Overlay window created");

  overlayWindow.webContents.on("will-navigate", (e) => e.preventDefault());
  overlayWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
}

function initProviders(): void {
  providerManager = new ProviderManager(appConfig);
  logger.info("Providers", `Initialized with active: ${appConfig.activeProvider}`);
}

async function loadSecureKeys(): Promise<void> {
  if (!appConfig.useKeychain) return;

  try {
    if (appConfig.providers.gemini) {
      const stored = await retrieveKey("gemini");
      if (stored) {
        appConfig.providers.gemini.apiKey = stored;
        logger.info("Providers", "Loaded Gemini API key from keychain");
      }
    }

    if (appConfig.providers.openaiCompat?.endpoints) {
      for (const endpoint of appConfig.providers.openaiCompat.endpoints) {
        const account = getAccount("endpoint", endpoint.name);
        const stored = await retrieveKey(account);
        if (stored) {
          endpoint.apiKey = stored;
          logger.info("Providers", `Loaded ${endpoint.name} API key from keychain`);
        }
      }
    }
  } catch (error) {
    logger.error("SecureStorage", `Failed to load keys from keychain: ${error}`);
  }
}

function registerHotkey(): void {
  if (!appConfig.hotkeyEnabled) {
    logger.info("Hotkey", "Hotkey registration skipped (disabled)");
    return;
  }
  const hotkey = appConfig.hotkey;
  globalShortcut.register(hotkey, async () => {
    logger.info("Hotkey", `${hotkey} triggered`);
    trackEvent("hotkey_triggered", { hotkey });
    const region = appConfig.captureRegion;
    const result = await smartCapture(
      gameExe || undefined,
      region,
      appConfig.captureQuality,
      appConfig.monitorIndex,
      appConfig.captureMode,
    );
    if (!result) {
      logger.warn("Hotkey", "No capture result");
      return;
    }

    const resizedBuffer = resizeImage(
      result.buffer,
      result.format,
      appConfig.captureQuality,
      appConfig.maxImageWidth,
    );
    const resizedMimeType = result.format === "jpeg" ? "image/jpeg" : "image/png";
    const resizedBase64 = resizedBuffer.toString("base64");
    const resizedDataUrl = `data:${resizedMimeType};base64,${resizedBase64}`;

    if (appConfig.saveScreenshots && appConfig.screenshotDir) {
      try {
        const ext = result.format;
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const filename = `gaming-copilot_${timestamp}.${ext}`;
        await writeFile(join(appConfig.screenshotDir, filename), result.buffer);
        logger.info("Capture", `Screenshot saved: ${join(appConfig.screenshotDir, filename)}`);
        trackEvent("screenshot_saved", { format: ext });
      } catch (error) {
        logger.error("Capture", `Failed to save screenshot: ${error}`);
      }
    }

    overlayWindow?.webContents.send("overlay:data", "Analyzing screenshot...");
    overlayWindow?.webContents.send("overlay:screenshot", resizedDataUrl);
    overlayWindow?.show();

    const providerInfo = providerManager?.getActiveProviderInfo();
    if (providerInfo) {
      overlayWindow?.webContents.send("overlay:provider", providerInfo);
    }

    let ocrContext: string | undefined;
    if (appConfig.ocr.enabled) {
      try {
        const ocrResult = await extractText(resizedDataUrl, appConfig.ocr);
        if (ocrResult.text) {
          ocrContext = `On-screen text (OCR):\n${ocrResult.text}`;
          logger.info(
            "OCR",
            `Extracted ${ocrResult.text.length} chars, confidence: ${Math.round(ocrResult.confidence)}%`,
          );
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : "OCR failed";
        logger.warn("OCR", `Failed to extract text: ${msg}`);
      }
    }

    const gameContext = getGameContext(gameExe);
    const context = [ocrContext, gameContext].filter(Boolean).join("\n\n");

    if (providerManager && providerManager.getAvailableProviders().length > 0) {
      try {
        const systemPrompt = appConfig.prompts.system;
        const gameSpecificPrompt = gameExe ? appConfig.prompts.gameSpecific?.[gameExe] : undefined;
        const finalPrompt = gameSpecificPrompt
          ? `${systemPrompt}\n\n${gameSpecificPrompt}`
          : systemPrompt;

        let fullText = "";
        for await (const chunk of providerManager.streamAnalyze(
          resizedBase64,
          resizedMimeType,
          finalPrompt,
          "Analyze this game screenshot.",
          context || undefined,
        )) {
          if (chunk.done) {
            logger.info("Hotkey", `AI streaming complete, total: ${fullText.length} chars`);
            trackEvent("analysis_complete", {
              textLength: fullText.length,
              provider: "unknown",
            });
          } else {
            fullText += chunk.text;
            overlayWindow?.webContents.send("overlay:data", fullText);
          }
        }
        overlayWindow?.webContents.send("overlay:stream-done", fullText);

        if (appConfig.notifications) {
          const summary = fullText.slice(0, 100) + (fullText.length > 100 ? "..." : "");
          new Notification({
            title: "Gaming Copilot",
            body: summary || "Analysis complete",
            icon: nativeImage.createFromPath(resolveResourcePath("resources/icon.png")),
            silent: false,
          }).show();
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Analysis failed";
        overlayWindow?.webContents.send("overlay:data", `Error: ${message}`);
        logger.errorWithStack("Hotkey", "AI analysis failed", error);
      }
    } else {
      mainWindow?.webContents.send("capture:result", resizedDataUrl);
      overlayWindow?.webContents.send(
        "overlay:data",
        "No AI provider configured. Open Settings to add one.",
      );
    }

    mainWindow?.webContents.send("capture:result", resizedDataUrl);
  });
  logger.info("Hotkey", `Registered: ${hotkey}`);
}

function unregisterHotkey(): void {
  globalShortcut.unregisterAll();
  logger.info("Hotkey", "Unregistered all shortcuts");
}

function setHotkey(newHotkey: string): void {
  if (!appConfig.hotkeyEnabled) return;
  globalShortcut.unregisterAll();
  appConfig.hotkey = newHotkey;
  setConfigValue("hotkey", newHotkey);
  registerHotkey();
  registerOverlayHotkey();
  logger.info("Hotkey", `Updated to: ${newHotkey}`);
}

function toggleOverlay(): void {
  if (!overlayWindow) return;
  if (overlayWindow.isVisible()) {
    overlayWindow.hide();
    logger.info("Overlay", "Overlay hidden via hotkey");
  } else {
    overlayWindow.webContents.send("overlay:data", "Ready to analyze.");
    overlayWindow.show();
    logger.info("Overlay", "Overlay shown via hotkey");
  }
}

function repositionOverlay(): void {
  if (!overlayWindow) return;
  const { x, y } = calculateOverlayPosition(appConfig.overlay.position);
  overlayWindow.setPosition(x, y);
}

function registerOverlayHotkey(): void {
  if (!appConfig.hotkeyEnabled) return;
  const hotkey = appConfig.overlayHotkey;
  globalShortcut.register(hotkey, () => {
    logger.info("Hotkey", `${hotkey} triggered (overlay toggle)`);
    toggleOverlay();
  });
  logger.info("Hotkey", `Registered overlay toggle: ${hotkey}`);
}

function createTray(): void {
  const iconPath = resolveResourcePath("resources/icon.png");
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  tray = new Tray(icon);
  tray.setToolTip("Gaming Copilot");

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Show Settings",
      click: () => {
        mainWindow?.show();
        mainWindow?.webContents.send("navigate:settings");
      },
    },
    {
      label: "Toggle Overlay",
      click: () => {
        toggleOverlay();
      },
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on("click", () => {
    if (mainWindow?.isVisible()) {
      mainWindow?.hide();
    } else {
      mainWindow?.show();
    }
  });

  tray.on("double-click", () => {
    mainWindow?.show();
  });
  logger.info("Tray", "System tray created");
}

function updateAutoStart(): void {
  app.setLoginItemSettings({
    openAtLogin: appConfig.autoStart,
    path: app.isPackaged ? process.execPath : undefined,
  });
  logger.info("AutoStart", `Auto-start set to: ${appConfig.autoStart}`);
}

app.whenReady().then(async () => {
  logger.info("App", `Starting Gaming Copilot v${app.getVersion()}`);
  createMainWindow();
  createOverlayWindow();
  await loadSecureKeys();
  initProviders();
  initChatStore();
  registerHotkey();
  registerOverlayHotkey();
  createTray();
  updateAutoStart();

  autoUpdater.on("checking-for-update", () => {
    mainWindow?.webContents.send("app:update-status", "checking");
  });
  autoUpdater.on("update-available", (info) => {
    logger.info("Updater", `Update available: ${info.version}`);
    mainWindow?.webContents.send("app:update-status", "available", info.version);
  });
  autoUpdater.on("update-not-available", () => {
    mainWindow?.webContents.send("app:update-status", "not-available");
  });
  autoUpdater.on("error", (error) => {
    logger.error("Updater", `Update error: ${error?.message}`);
    mainWindow?.webContents.send("app:update-status", "error", error?.message);
  });
  autoUpdater.on("update-downloaded", (info) => {
    logger.info("Updater", `Update downloaded: ${info.version}`);
    mainWindow?.webContents.send("app:update-status", "downloaded", info.version);
  });

  const pluginConfig = appConfig.plugins.bunMemreader;
  if (pluginConfig.enabled) {
    memreaderPlugin = new MemreaderPlugin(pluginConfig);
    memreaderPlugin.start();
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  memreaderPlugin?.stop();
  void terminateOcrWorker();
  logger.info("App", "Quitting");
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// IPC Handlers — Capture
ipcMain.handle("capture:get-screens", () => {
  const displays = screen.getAllDisplays();
  return displays.map((d, index) => ({
    index,
    name: d.label || `Display ${index + 1}`,
    bounds: d.bounds,
    workArea: d.workArea,
    primary: screen.getPrimaryDisplay().displayId === d.displayId,
  }));
});

ipcMain.handle("capture:screenshot", async () => {
  const region = appConfig.captureRegion;
  const result = await smartCapture(
    gameExe || undefined,
    region,
    appConfig.captureQuality,
    appConfig.monitorIndex,
  );
  if (!result) return null;
  const resizedBuffer = resizeImage(
    result.buffer,
    result.format,
    appConfig.captureQuality,
    appConfig.maxImageWidth,
  );
  const mimeType = result.format === "jpeg" ? "image/jpeg" : "image/png";
  return `data:${mimeType};base64,${resizedBuffer.toString("base64")}`;
});

ipcMain.handle("capture:record", async () => {
  const result = await recordScreen(
    appConfig.recordDuration,
    appConfig.captureQuality,
    appConfig.monitorIndex,
  );
  if (!result) return null;
  const resizedBuffer = resizeImage(
    result.buffer,
    result.format,
    appConfig.captureQuality,
    appConfig.maxImageWidth,
  );
  const mimeType = result.format === "jpeg" ? "image/jpeg" : "image/png";
  return `data:${mimeType};base64,${resizedBuffer.toString("base64")}`;
});

ipcMain.handle("capture:preview", async () => {
  const region = appConfig.captureRegion;
  const result = await smartCapture(
    gameExe || undefined,
    region,
    appConfig.captureQuality,
    appConfig.monitorIndex,
  );
  if (!result) return null;
  const resizedBuffer = resizeImage(result.buffer, result.format, appConfig.captureQuality, 256);
  const mimeType = result.format === "jpeg" ? "image/jpeg" : "image/png";
  return `data:${mimeType};base64,${resizedBuffer.toString("base64")}`;
});
ipcMain.handle("capture:check-game", (_event, exeName: unknown) => {
  const name = validateIPC(exeNameSchema, exeName);
  if (!/^[\w.-]+\.exe$/.test(name.endsWith(".exe") ? name : `${name}.exe`)) {
    return { running: false, pid: null };
  }
  const pid = findProcessByExe(name);
  return { running: pid !== null, pid };
});

ipcMain.handle("capture:set-region", (_event, region: unknown) => {
  const parsed = region === null ? null : validateIPC(regionBoundsSchema, region);
  appConfig.captureRegion = parsed || undefined;
  setConfigValue("captureRegion", parsed || undefined);
  logger.info(
    "Capture",
    parsed ? `Region set: ${parsed.width}x${parsed.height}` : "Region cleared",
  );
});

// IPC Handlers — AI
const aiAnalyzeSchema = z.object({
  imageBase64: z.string().min(1),
  userMessage: z.string().optional(),
});

ipcMain.handle("ai:analyze", async (_event, imageBase64: unknown, userMessage?: unknown) => {
  const parsed = validateIPC(aiAnalyzeSchema, { imageBase64, userMessage });
  if (!providerManager) return { error: "Provider manager not initialized" };

  let ocrContext: string | undefined;
  if (appConfig.ocr.enabled) {
    try {
      const dataUrl = `data:image/png;base64,${parsed.imageBase64}`;
      const ocrResult = await extractText(dataUrl, appConfig.ocr);
      if (ocrResult.text) {
        ocrContext = `On-screen text (OCR):\n${ocrResult.text}`;
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "OCR failed";
      logger.warn("OCR", `Failed to extract text: ${msg}`);
    }
  }

  const gameContext = getGameContext(gameExe);
  const context = [ocrContext, gameContext].filter(Boolean).join("\n\n");

  try {
    const response = await providerManager.analyze(
      parsed.imageBase64,
      "image/png",
      appConfig.prompts.system,
      parsed.userMessage || "Analyze this game screenshot.",
      context || undefined,
    );
    return { response };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Analysis failed";
    return { error: message };
  }
});

ipcMain.handle("ai:test-provider", async (_event, name: unknown) => {
  const validName = validateIPC(providerNameSchema, name);
  if (!providerManager) return false;
  return providerManager.testProvider(validName);
});

ipcMain.on("ai:analyze-stream", async (event, imageBase64: string, userMessage?: string) => {
  if (!providerManager) {
    event.sender.send("ai:stream-error", "Provider manager not initialized");
    return;
  }

  const dataUrl = `data:image/png;base64,${imageBase64}`;
  event.sender.send("overlay:data", "Analyzing screenshot...");
  event.sender.send("overlay:screenshot", dataUrl);
  overlayWindow?.show();

  const gameSpecificPrompt = gameExe ? appConfig.prompts.gameSpecific?.[gameExe] : undefined;
  const finalPrompt = gameSpecificPrompt
    ? `${appConfig.prompts.system}\n\n${gameSpecificPrompt}`
    : appConfig.prompts.system;

  let ocrContext: string | undefined;
  if (appConfig.ocr.enabled) {
    try {
      const ocrResult = await extractText(dataUrl, appConfig.ocr);
      if (ocrResult.text) {
        ocrContext = `On-screen text (OCR):\n${ocrResult.text}`;
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "OCR failed";
      logger.warn("OCR", `Failed to extract text: ${msg}`);
    }
  }

  const gameContext = getGameContext(gameExe);
  const context = [ocrContext, gameContext].filter(Boolean).join("\n\n");

  try {
    let fullText = "";
    for await (const chunk of providerManager.streamAnalyze(
      imageBase64,
      "image/png",
      finalPrompt,
      userMessage || "Analyze this game screenshot.",
      context || undefined,
    )) {
      if (!chunk.done) {
        fullText += chunk.text;
        event.sender.send("ai:stream-chunk", chunk.text);
      }
    }
    event.sender.send("ai:stream-done", fullText);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Analysis failed";
    event.sender.send("ai:stream-error", message);
  }
});

ipcMain.handle("ai:get-providers", () => {
  if (!providerManager) return [];
  return providerManager.getAvailableProviders().map((p) => ({
    name: p.name,
    displayName: p.displayName,
    rateLimit: p.getRateLimitInfo(),
  }));
});

ipcMain.handle("ai:clear-cache", () => {
  if (!providerManager) return false;
  providerManager.clearCache();
  return true;
});

ipcMain.handle("ai:fetch-models", async (_event, name: unknown) => {
  const validName = validateIPC(providerNameSchema, name);
  if (!providerManager) {
    throw new Error("Provider manager not initialized");
  }
  return providerManager.fetchModelsForProvider(validName);
});

// IPC Handlers — Config
ipcMain.handle("config:set-game-exe", (_event, exe: string) => {
  gameExe = exe;
  appConfig.gameExe = exe;
  setConfigValue("gameExe", exe);
});

ipcMain.handle("config:get", async () => {
  if (appConfig.useKeychain) {
    const providersCopy = JSON.parse(
      JSON.stringify(appConfig.providers),
    ) as typeof appConfig.providers;

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

    return { ...appConfig, providers: providersCopy };
  }
  return appConfig;
});

ipcMain.handle("config:set-provider", async (_event, name: unknown, config: unknown) => {
  const validName = validateIPC(providerNameSchema, name);
  if (validName === "gemini") {
    const parsed = validateIPC(geminiProviderConfigSchema, config);
    appConfig.providers.gemini = {
      apiKey: parsed.apiKey || "",
      model: parsed.model || "",
      grounding: parsed.grounding ?? false,
    };
  } else {
    const parsed = validateIPC(endpointConfigSchema, config);
    if (!appConfig.providers.openaiCompat) {
      appConfig.providers.openaiCompat = { endpoints: [] };
    }
    const existing = appConfig.providers.openaiCompat.endpoints.findIndex(
      (e) => e.name === validName,
    );
    if (existing >= 0) {
      appConfig.providers.openaiCompat.endpoints[existing] = {
        ...appConfig.providers.openaiCompat.endpoints[existing],
        ...parsed,
      };
    } else {
      appConfig.providers.openaiCompat.endpoints.push({
        name: validName,
        baseUrl: parsed.baseUrl || "",
        apiKey: parsed.apiKey || "",
        model: parsed.model || "",
      });
    }
  }

  // Store API keys in OS keychain if enabled
  let storedApiKey: string | undefined;
  if (appConfig.useKeychain) {
    const apiKey =
      validName === "gemini"
        ? appConfig.providers.gemini?.apiKey
        : appConfig.providers.openaiCompat?.endpoints.find((e) => e.name === validName)?.apiKey;
    if (apiKey) {
      storedApiKey = apiKey;
      try {
        if (validName === "gemini") {
          await storeKey("gemini", apiKey);
          appConfig.providers.gemini!.apiKey = "";
        } else {
          const account = getAccount("endpoint", validName);
          await storeKey(account, apiKey);
          const ep = appConfig.providers.openaiCompat?.endpoints.find((e) => e.name === validName);
          if (ep) ep.apiKey = "";
        }
      } catch (keychainError) {
        logger.warn("Config", `Keychain store failed, keeping API key in config: ${keychainError}`);
      }
    }
  }

  setConfigValue("providers", appConfig.providers);

  // Restore API key in memory for ProviderManager (blanked only for disk save)
  if (storedApiKey) {
    if (validName === "gemini" && appConfig.providers.gemini) {
      appConfig.providers.gemini.apiKey = storedApiKey;
    } else {
      const ep = appConfig.providers.openaiCompat?.endpoints.find((e) => e.name === validName);
      if (ep) ep.apiKey = storedApiKey;
    }
  }

  initProviders();
  emitConfigUpdated();
});

ipcMain.handle("config:remove-endpoint", async (_event, name: unknown) => {
  const validName = validateIPC(providerNameSchema, name);
  if (!appConfig.providers.openaiCompat) return;
  appConfig.providers.openaiCompat.endpoints = appConfig.providers.openaiCompat.endpoints.filter(
    (e) => e.name !== validName,
  );

  if (appConfig.useKeychain) {
    const account = getAccount("endpoint", validName);
    try {
      await deleteKey(account);
    } catch (keychainError) {
      logger.warn("Config", `Keychain delete failed for ${validName}: ${keychainError}`);
    }
  }

  setConfigValue("providers", appConfig.providers);
  initProviders();
  emitConfigUpdated();
});

ipcMain.handle("config:set-active-provider", (_event, name: unknown) => {
  const validName = validateIPC(providerNameSchema, name);
  if (
    validName !== "gemini" &&
    !appConfig.providers.openaiCompat?.endpoints.some((e) => e.name === validName)
  ) {
    throw new Error(`Unknown provider: ${validName}`);
  }
  appConfig.activeProvider = validName;
  providerManager?.setActiveProvider(validName);
  setConfigValue("activeProvider", validName);
  logger.info("Providers", `Active provider set to: ${validName}`);
  emitConfigUpdated();
});

ipcMain.handle("config:set-fallback-provider", (_event, name: unknown) => {
  const validName = validateIPC(fallbackProviderSchema, name);
  if (validName) {
    if (
      validName !== "gemini" &&
      !appConfig.providers.openaiCompat?.endpoints.some((e) => e.name === validName)
    ) {
      throw new Error(`Unknown provider: ${validName}`);
    }
  }
  appConfig.fallbackProvider = validName || null;
  providerManager?.setFallbackProvider(validName || null);
  setConfigValue("fallbackProvider", validName || null);
  logger.info("Providers", `Fallback provider set to: ${validName || "none"}`);
  emitConfigUpdated();
});

// IPC Handlers — Games
ipcMain.handle("games:add", (_event, game: unknown) => {
  const parsed = validateIPC(gameEntrySchema, game);
  appConfig.games = [...appConfig.games, parsed];
  setConfigValue("games", appConfig.games);
  logger.info("Games", `Added game: ${parsed.name} (${parsed.exe})`);
  emitConfigUpdated();
  return parsed;
});

ipcMain.handle("games:update", (_event, game: unknown) => {
  const parsed = validateIPC(gameEntrySchema, game);
  const idx = appConfig.games.findIndex((g) => g.id === parsed.id);
  if (idx < 0) {
    throw new Error(`Game not found: ${parsed.id}`);
  }
  appConfig.games[idx] = parsed;
  setConfigValue("games", appConfig.games);
  logger.info("Games", `Updated game: ${parsed.name} (${parsed.exe})`);
  emitConfigUpdated();
  return parsed;
});

ipcMain.handle("games:remove", (_event, id: unknown) => {
  const validId = validateIPC(z.string().uuid(), id);
  const existing = appConfig.games.findIndex((g) => g.id === validId);
  if (existing < 0) {
    throw new Error(`Game not found: ${validId}`);
  }
  const removed = appConfig.games.splice(existing, 1)[0];
  setConfigValue("games", appConfig.games);
  logger.info("Games", `Removed game: ${removed?.name} (${removed?.exe})`);
  emitConfigUpdated();
  return true;
});

ipcMain.handle("games:list", () => {
  return appConfig.games;
});

ipcMain.handle("config:set-overlay", (_event, overlay: unknown) => {
  const parsed = validateIPC(overlayConfigSchema, overlay);
  const positionChanged = parsed.position && parsed.position !== appConfig.overlay.position;
  appConfig.overlay = { ...appConfig.overlay, ...parsed };
  setConfigValue("overlay", appConfig.overlay);
  if (positionChanged) {
    repositionOverlay();
    overlayWindow?.webContents.send("overlay:set-position", appConfig.overlay.position);
  }
  emitConfigUpdated();
});

ipcMain.handle("config:set-tts", (_event, tts: unknown) => {
  const parsed = validateIPC(ttsConfigSchema, tts);
  appConfig.tts = { ...appConfig.tts, ...parsed };
  setConfigValue("tts", appConfig.tts);
  emitConfigUpdated();
});

ipcMain.handle("config:set-prompts", (_event, prompts: unknown) => {
  const parsed = validateIPC(promptsConfigSchema, prompts);
  appConfig.prompts = { ...appConfig.prompts, ...parsed };
  setConfigValue("prompts", appConfig.prompts);
  emitConfigUpdated();
});

ipcMain.handle("config:set-auto-start", (_event, enable: unknown) => {
  const parsed = validateIPC(booleanSchema, enable);
  appConfig.autoStart = parsed;
  setConfigValue("autoStart", parsed);
  updateAutoStart();
  emitConfigUpdated();
});

ipcMain.handle("config:set-generic", (_event, key: unknown, value: unknown) => {
  const typedKey = validateIPC(hotkeySchema, key) as keyof AppConfig;
  if (typedKey in appConfig) {
    appConfig[typedKey] = value as never;
    setConfigValue(typedKey, value as never);
    emitConfigUpdated();
  }
});

ipcMain.handle("config:set-telemetry", (_event, enabled: unknown) => {
  const parsed = validateIPC(booleanSchema, enabled);
  appConfig.telemetry = { enabled: parsed };
  setConfigValue("telemetry", { enabled: parsed });
  if (parsed) {
    logger.info("Telemetry", "Telemetry enabled — anonymous usage data will be collected");
    trackEvent("telemetry_enabled", { enabled: parsed });
  } else {
    logger.info("Telemetry", "Telemetry disabled");
  }
  emitConfigUpdated();
});

ipcMain.handle("config:set-capture-mode", (_event, mode: unknown) => {
  const parsed = validateIPC(captureModeSchema, mode);
  appConfig.captureMode = parsed;
  setConfigValue("captureMode", parsed);
  logger.info("Capture", `Capture mode set to: ${parsed}`);
  emitConfigUpdated();
});

ipcMain.handle("config:set-hotkey", (_event, hotkey: unknown) => {
  const parsed = validateIPC(hotkeySchema, hotkey);
  if (!parsed || !/^\w+([+-].+)*$/.test(parsed)) {
    return false;
  }
  setHotkey(parsed);
  return true;
});

ipcMain.handle("config:set-overlay-hotkey", (_event, hotkey: unknown) => {
  const parsed = validateIPC(hotkeySchema, hotkey);
  if (!parsed || !/^\w+([+-].+)*$/.test(parsed)) {
    return false;
  }
  appConfig.overlayHotkey = parsed;
  setConfigValue("overlayHotkey", parsed);
  globalShortcut.unregisterAll();
  registerHotkey();
  registerOverlayHotkey();
  logger.info("Hotkey", `Overlay hotkey set to: ${parsed}`);
  return true;
});

ipcMain.handle("config:set-hotkey-enabled", (_event, enabled: unknown) => {
  const parsed = validateIPC(booleanSchema, enabled);
  appConfig.hotkeyEnabled = parsed;
  setConfigValue("hotkeyEnabled", parsed);
  if (parsed) {
    registerHotkey();
  } else {
    unregisterHotkey();
  }
  logger.info("Hotkey", `Hotkey enabled: ${enabled}`);
  return true;
});

ipcMain.handle("config:export", () => {
  const safeCopy = JSON.parse(JSON.stringify(appConfig)) as typeof appConfig;
  safeCopy.providers = { gemini: undefined, openaiCompat: undefined };
  if (appConfig.providers.gemini) {
    safeCopy.providers.gemini = {
      ...appConfig.providers.gemini,
      apiKey: "[REDACTED]",
    };
  }
  if (appConfig.providers.openaiCompat?.endpoints) {
    safeCopy.providers.openaiCompat = {
      endpoints: appConfig.providers.openaiCompat.endpoints.map((ep) => ({
        ...ep,
        apiKey: "[REDACTED]",
      })),
    };
  }
  return safeCopy;
});

ipcMain.handle("config:import", async (_event, config: unknown) => {
  const parsed = validateIPC(configImportSchema, config);
  const overlayParsed = validateIPC(overlayConfigSchema, parsed.overlay || {});
  const ttsParsed = validateIPC(ttsConfigSchema, parsed.tts || {});
  const promptsParsed = validateIPC(promptsConfigSchema, parsed.prompts || {});
  for (const [key, value] of Object.entries(parsed)) {
    if (
      key !== "providers" &&
      key !== "telemetry" &&
      key !== "overlay" &&
      key !== "tts" &&
      key !== "prompts"
    ) {
      appConfig[key] = value;
      setConfigValue(key, value);
    }
  }
  appConfig.overlay = { ...appConfig.overlay, ...overlayParsed };
  setConfigValue("overlay", appConfig.overlay);
  appConfig.tts = { ...appConfig.tts, ...ttsParsed };
  setConfigValue("tts", appConfig.tts);
  appConfig.prompts = { ...appConfig.prompts, ...promptsParsed };
  setConfigValue("prompts", appConfig.prompts);
  logger.info("Config", "Configuration imported successfully");
  return true;
});

// IPC Handlers — Screenshot Saving
ipcMain.handle("capture:pick-directory", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory", "createDirectory"],
    title: "Select screenshot save directory",
  });
  if (!result.canceled && result.filePaths[0]) {
    appConfig.screenshotDir = result.filePaths[0];
    setConfigValue("screenshotDir", appConfig.screenshotDir);
    return appConfig.screenshotDir;
  }
  return null;
});

ipcMain.handle("capture:save-screenshot", async (_event, dataUrl: unknown) => {
  const validUrl = validateIPC(z.string().url(), dataUrl);
  if (!appConfig.saveScreenshots || !appConfig.screenshotDir) {
    return false;
  }
  try {
    const base64Match = validUrl.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!base64Match?.[1] || !base64Match[2]) {
      logger.warn("Capture", "Failed to save screenshot: invalid data URL format");
      return false;
    }
    const mimeType = base64Match[1];
    const ext = mimeType.replace("image/", "");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `gaming-copilot_${timestamp}.${ext}`;
    const filepath = join(appConfig.screenshotDir, filename);
    const buffer = Buffer.from(base64Match[2], "base64");
    await writeFile(filepath, buffer);
    logger.info("Capture", `Screenshot saved: ${filepath}`);
    return true;
  } catch (error) {
    logger.error("Capture", `Failed to save screenshot: ${error}`);
    return false;
  }
});

// IPC Handlers — Screenshot Gallery
const screenshotsListSchema = z.object({
  dir: z.string().optional(),
});

ipcMain.handle("screenshots:list", async (_event, input: unknown) => {
  const parsed = validateIPC(screenshotsListSchema, input);
  const dir = parsed.dir || appConfig.screenshotDir;
  if (!dir) return [];
  try {
    const files = await readdir(dir);
    const imageFiles = files.filter((f) => /\.(png|jpe?g|gif|webp)$/i.test(f));
    const entries = await Promise.all(
      imageFiles.map(async (filename) => {
        const filepath = join(dir, filename);
        try {
          const info = await stat(filepath);
          return {
            filename,
            path: filepath,
            size: info.size,
            mtime: info.mtimeMs,
          };
        } catch {
          return null;
        }
      }),
    );
    return entries
      .filter((e): e is NonNullable<typeof e> => e !== null)
      .sort((a, b) => b.mtime - a.mtime);
  } catch (error) {
    logger.error("Screenshots", `Failed to list screenshots: ${error}`);
    return [];
  }
});

ipcMain.handle("screenshots:delete", async (_event, filepath: unknown) => {
  const validPath = validateIPC(z.string(), filepath);
  if (!appConfig.saveScreenshots || !appConfig.screenshotDir) {
    return false;
  }
  const resolved = join(appConfig.screenshotDir, validPath);
  try {
    const { unlink } = await import("node:fs/promises");
    await unlink(resolved);
    logger.info("Screenshots", `Deleted: ${resolved}`);
    return true;
  } catch (error) {
    logger.error("Screenshots", `Failed to delete screenshot: ${error}`);
    return false;
  }
});

ipcMain.handle("screenshots:open", async (_event, filepath: unknown) => {
  const validPath = validateIPC(z.string(), filepath);
  if (!appConfig.saveScreenshots || !appConfig.screenshotDir) {
    return false;
  }
  const resolved = join(appConfig.screenshotDir, validPath);
  try {
    await shell.openPath(resolved);
    return true;
  } catch (error) {
    logger.error("Screenshots", `Failed to open screenshot: ${error}`);
    return false;
  }
});

ipcMain.handle("screenshots:open-containing-folder", async (_event, filename: unknown) => {
  const _validName = validateIPC(z.string(), filename);
  if (!appConfig.saveScreenshots || !appConfig.screenshotDir) {
    return false;
  }
  try {
    await shell.openPath(appConfig.screenshotDir);
    return true;
  } catch (error) {
    logger.error("Screenshots", `Failed to open containing folder: ${error}`);
    return false;
  }
});

ipcMain.handle("screenshots:copy-path", async (_event, path: unknown) => {
  const validPath = validateIPC(z.string(), path);
  try {
    clipboard.writeText(validPath);
    return true;
  } catch (error) {
    logger.error("Screenshots", `Failed to copy path: ${error}`);
    return false;
  }
});

const tagsFilePath = (dir: string) => join(dir, "screenshot-tags.json");
const favoritesFilePath = (dir: string) => join(dir, "screenshot-favorites.json");

function resolveScreenshotPath(dir: string, filename: string): string {
  const resolved = resolve(dir, filename);
  const base = resolve(dir);
  if (!resolved.startsWith(base + join("", "")) && resolved !== base) {
    throw new Error("Invalid screenshot path");
  }
  return resolved;
}

async function loadTags(dir: string): Promise<Record<string, string[]>> {
  try {
    const { readFile } = await import("node:fs/promises");
    const data = await readFile(tagsFilePath(dir), "utf-8");
    return JSON.parse(data);
  } catch {
    return {};
  }
}

async function saveTags(dir: string, tags: Record<string, string[]>): Promise<void> {
  await writeFile(tagsFilePath(dir), JSON.stringify(tags, null, 2), "utf-8");
}

async function loadFavorites(dir: string): Promise<Record<string, boolean>> {
  try {
    const { readFile } = await import("node:fs/promises");
    const data = await readFile(favoritesFilePath(dir), "utf-8");
    return JSON.parse(data);
  } catch {
    return {};
  }
}

async function saveFavorites(dir: string, favorites: Record<string, boolean>): Promise<void> {
  await writeFile(favoritesFilePath(dir), JSON.stringify(favorites, null, 2), "utf-8");
}

ipcMain.handle("screenshots:get-tags", async () => {
  if (!appConfig.screenshotDir) return {};
  return loadTags(appConfig.screenshotDir);
});

ipcMain.handle("screenshots:set-tags", async (_event, input: unknown) => {
  const parsed = validateIPC(z.object({ filename: z.string(), tags: z.array(z.string()) }), input);
  if (!appConfig.screenshotDir) return false;
  const tags = await loadTags(appConfig.screenshotDir);
  tags[parsed.filename] = parsed.tags;
  await saveTags(appConfig.screenshotDir, tags);
  return true;
});

ipcMain.handle("screenshots:toggle-favorite", async (_event, filename: unknown) => {
  const validName = validateIPC(z.string(), filename);
  if (!appConfig.screenshotDir) return false;
  try {
    resolveScreenshotPath(appConfig.screenshotDir, validName);
  } catch {
    return false;
  }
  const favorites = await loadFavorites(appConfig.screenshotDir);
  favorites[validName] = !favorites[validName];
  await saveFavorites(appConfig.screenshotDir, favorites);
  return true;
});

ipcMain.handle("screenshots:get-favorites", async () => {
  if (!appConfig.screenshotDir) return {};
  return loadFavorites(appConfig.screenshotDir);
});

ipcMain.handle("screenshots:bulk-rename", async (_event, input: unknown) => {
  const parsed = validateIPC(
    z.object({
      filenames: z.array(z.string()),
      mode: z.enum(["prefix", "suffix", "replace"]),
      value: z.string(),
      find: z.string().optional(),
    }),
    input,
  );
  if (!appConfig.saveScreenshots || !appConfig.screenshotDir) {
    return { success: false, error: "Screenshot saving is not enabled" };
  }
  try {
    const { rename, access } = await import("node:fs/promises");
    const results: Array<{ old: string; new: string }> = [];
    const conflicts: string[] = [];
    for (const oldName of parsed.filenames) {
      const oldPath = resolveScreenshotPath(appConfig.screenshotDir, oldName);
      const ext = extname(oldName);
      const base = oldName.slice(0, oldName.lastIndexOf("."));
      let newBase = base;
      if (parsed.mode === "prefix") {
        newBase = `${parsed.value}${base}`;
      } else if (parsed.mode === "suffix") {
        newBase = `${base}${parsed.value}`;
      } else if (parsed.mode === "replace") {
        newBase = base.replace(parsed.find || "", parsed.value);
      }
      const newName = `${newBase}${ext}`;
      if (newName !== oldName) {
        const newPath = resolveScreenshotPath(appConfig.screenshotDir, newName);
        try {
          await access(newPath);
          conflicts.push(newName);
        } catch {
          await rename(oldPath, newPath);
          results.push({ old: oldName, new: newName });
        }
      }
    }
    logger.info("Screenshots", `Renamed ${results.length} files`);
    return {
      success: true,
      results,
      conflicts: conflicts.length > 0 ? conflicts : undefined,
    };
  } catch (error) {
    logger.error("Screenshots", `Failed to rename: ${error}`);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Rename failed",
    };
  }
});

ipcMain.handle("screenshots:get-metadata", async (_event, filename: unknown) => {
  const validName = validateIPC(z.string(), filename);
  if (!appConfig.screenshotDir) return null;
  try {
    const filepath = resolveScreenshotPath(appConfig.screenshotDir, validName);
    const { stat } = await import("node:fs/promises");
    const info = await stat(filepath);
    const nativeImage = (await import("electron")).nativeImage;
    const img = nativeImage.createFromPath(filepath);
    const size = img.getSize();
    return {
      filename: validName,
      path: filepath,
      sizeBytes: info.size,
      width: size.width,
      height: size.height,
      createdAt: info.birthtimeMs,
      modifiedAt: info.mtimeMs,
      format: extname(validName).slice(1).toUpperCase() || "UNKNOWN",
    };
  } catch (error) {
    logger.error("Screenshots", `Failed to get metadata: ${error}`);
    return null;
  }
});

ipcMain.handle("screenshots:export-zip", async (_event, input: unknown) => {
  const parsed = validateIPC(
    z.object({
      filenames: z.array(z.string()),
      zipName: z.string().default("screenshots-export.zip"),
    }),
    input,
  );
  if (!appConfig.saveScreenshots || !appConfig.screenshotDir) {
    return { success: false, error: "Screenshot saving is not enabled" };
  }
  try {
    const zip = new AdmZip();
    for (const filename of parsed.filenames) {
      const filepath = join(appConfig.screenshotDir, filename);
      zip.addLocalFile(filepath, "", filename);
    }
    const zipPath = join(appConfig.screenshotDir, parsed.zipName);
    zip.writeZip(zipPath);
    logger.info("Screenshots", `Exported ZIP: ${zipPath}`);
    await shell.openPath(appConfig.screenshotDir);
    return { success: true, path: zipPath };
  } catch (error) {
    logger.error("Screenshots", `Failed to export ZIP: ${error}`);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Export failed",
    };
  }
});

// IPC Handlers — Chat History
const chatSaveSchema = z.array(chatMessageSchema);

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
        md += `## 💬 User (${new Date(msg.timestamp).toLocaleString()})\n\n${msg.text}\n\n`;
      } else {
        md += `## 🤖 Assistant (${new Date(msg.timestamp).toLocaleString()}${msg.provider ? ` · ${msg.provider}` : ""})\n\n${msg.text}\n\n`;
      }
    }
    return md;
  }
  return JSON.stringify(messages, null, 2);
});

// IPC Handlers — Overlay
ipcMain.handle("overlay:show", (_event, text: unknown) => {
  const validText = validateIPC(z.string(), text);
  overlayWindow?.webContents.send("overlay:data", validText);
  overlayWindow?.show();
});

ipcMain.handle("overlay:hide", () => {
  overlayWindow?.hide();
});

ipcMain.handle("overlay:toggle", () => {
  toggleOverlay();
});

ipcMain.handle("overlay:set-click-through", (_event, enable: unknown) => {
  const parsed = validateIPC(booleanSchema, enable);
  appConfig.overlay.clickThrough = parsed;
  setConfigValue("overlay", appConfig.overlay);
  emitConfigUpdated();
  overlayWindow?.setIgnoreMouseEvents(parsed);
});

ipcMain.handle("overlay:set-css", (_event, css: unknown) => {
  const rawCss = validateIPC(z.string(), css);
  const sanitizedCss = rawCss
    .replace(/@import\b[^;]+;?/gi, "")
    .replace(/@font-face\b[^{]*\{[^}]*\}/gi, "")
    .replace(/url\s*\([^)]*\)/gi, "url('' )");
  appConfig.overlay.customCSS = sanitizedCss;
  setConfigValue("overlay", appConfig.overlay);
  emitConfigUpdated();
  overlayWindow?.webContents.send("overlay:set-css", sanitizedCss);
});

// IPC Handlers — Window
ipcMain.handle("window:open-settings", () => {
  mainWindow?.show();
  mainWindow?.webContents.send("navigate:settings");
});

// IPC Handlers — Plugins
ipcMain.handle("plugin:memreader:start", async () => {
  if (!memreaderPlugin) {
    memreaderPlugin = new MemreaderPlugin(appConfig.plugins.bunMemreader);
  }
  await memreaderPlugin.start();
  return memreaderPlugin.isConnected();
});

ipcMain.handle("plugin:memreader:stop", () => {
  memreaderPlugin?.stop();
  return true;
});

ipcMain.handle("plugin:memreader:state", () => {
  return memreaderPlugin?.getState() || null;
});

ipcMain.handle("plugin:memreader:connected", () => {
  return memreaderPlugin?.isConnected() || false;
});

// IPC Handlers — App / Auto-Update
ipcMain.handle("app:update", async (_event, action: string) => {
  if (action === "check") {
    const result = await autoUpdater.checkForUpdates();
    if (!result) {
      return { status: "not-available" };
    }
    return { status: "checking" };
  }
  if (action === "install") {
    autoUpdater.quitAndInstall();
    return { status: "installing" };
  }
  return { status: "unknown" };
});

ipcMain.handle("app:get-version", () => {
  return app.getVersion();
});
