import { join } from "node:path";

import { is } from "@electron-toolkit/utils";
import {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  Menu,
  Notification,
  nativeImage,
  screen,
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
  endpointConfigSchema,
  exeNameSchema,
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

// Load persisted config
const appConfig: AppConfig = initConfig();
let gameExe = appConfig.gameExe;

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === "linux" ? { icon: join(__dirname, "../resources/icon.png") } : {}),
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false,
      contextIsolation: true,
    },
  });

  mainWindow.on("ready-to-show", () => {
    mainWindow?.show();
    logger.info("MainWindow", "Window ready");
  });

  mainWindow.on("close", (e) => {
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

function createOverlayWindow(): void {
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;

  overlayWindow = new BrowserWindow({
    width: 400,
    height: 200,
    x: screenWidth - 420,
    y: screenHeight - 220,
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

    overlayWindow?.webContents.send("overlay:data", "Analyzing screenshot...");
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
          ocrContext,
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
            icon: nativeImage.createFromPath(join(__dirname, "../resources/icon.png")),
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
  logger.info("Hotkey", `Updated to: ${newHotkey}`);
}

function createTray(): void {
  const iconPath = join(__dirname, "../resources/icon.png");
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
      label: "Show Overlay",
      click: () => {
        overlayWindow?.webContents.send("overlay:data", "Ready to analyze.");
        overlayWindow?.show();
      },
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

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

  try {
    const response = await providerManager.analyze(
      parsed.imageBase64,
      "image/png",
      appConfig.prompts.system,
      parsed.userMessage || "Analyze this game screenshot.",
      ocrContext,
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

  const gameSpecificPrompt = gameExe ? appConfig.prompts.gameSpecific?.[gameExe] : undefined;
  const finalPrompt = gameSpecificPrompt
    ? `${appConfig.prompts.system}\n\n${gameSpecificPrompt}`
    : appConfig.prompts.system;

  let ocrContext: string | undefined;
  if (appConfig.ocr.enabled) {
    try {
      const dataUrl = `data:image/png;base64,${imageBase64}`;
      const ocrResult = await extractText(dataUrl, appConfig.ocr);
      if (ocrResult.text) {
        ocrContext = `On-screen text (OCR):\n${ocrResult.text}`;
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "OCR failed";
      logger.warn("OCR", `Failed to extract text: ${msg}`);
    }
  }

  try {
    let fullText = "";
    for await (const chunk of providerManager.streamAnalyze(
      imageBase64,
      "image/png",
      finalPrompt,
      userMessage || "Analyze this game screenshot.",
      ocrContext,
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
  if (appConfig.useKeychain) {
    const apiKey =
      validName === "gemini"
        ? appConfig.providers.gemini?.apiKey
        : appConfig.providers.openaiCompat?.endpoints.find((e) => e.name === validName)?.apiKey;
    if (apiKey) {
      if (validName === "gemini") {
        await storeKey("gemini", apiKey);
        appConfig.providers.gemini!.apiKey = "";
      } else {
        const account = getAccount("endpoint", validName);
        await storeKey(account, apiKey);
        const ep = appConfig.providers.openaiCompat?.endpoints.find((e) => e.name === validName);
        if (ep) ep.apiKey = "";
      }
    }
  }

  setConfigValue("providers", appConfig.providers);
  initProviders();
});

ipcMain.handle("config:remove-endpoint", async (_event, name: unknown) => {
  const validName = validateIPC(providerNameSchema, name);
  if (!appConfig.providers.openaiCompat) return;
  appConfig.providers.openaiCompat.endpoints = appConfig.providers.openaiCompat.endpoints.filter(
    (e) => e.name !== validName,
  );

  if (appConfig.useKeychain) {
    const account = getAccount("endpoint", validName);
    await deleteKey(account);
  }

  setConfigValue("providers", appConfig.providers);
  initProviders();
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
});

ipcMain.handle("config:set-overlay", (_event, overlay: unknown) => {
  const parsed = validateIPC(overlayConfigSchema, overlay);
  appConfig.overlay = { ...appConfig.overlay, ...parsed };
  setConfigValue("overlay", appConfig.overlay);
});

ipcMain.handle("config:set-tts", (_event, tts: unknown) => {
  const parsed = validateIPC(ttsConfigSchema, tts);
  appConfig.tts = { ...appConfig.tts, ...parsed };
  setConfigValue("tts", appConfig.tts);
});

ipcMain.handle("config:set-prompts", (_event, prompts: unknown) => {
  const parsed = validateIPC(promptsConfigSchema, prompts);
  appConfig.prompts = { ...appConfig.prompts, ...parsed };
  setConfigValue("prompts", appConfig.prompts);
});

ipcMain.handle("config:set-auto-start", (_event, enable: unknown) => {
  const parsed = validateIPC(booleanSchema, enable);
  appConfig.autoStart = parsed;
  setConfigValue("autoStart", parsed);
  updateAutoStart();
});

ipcMain.handle("config:set-generic", (_event, key: unknown, value: unknown) => {
  const typedKey = validateIPC(hotkeySchema, key) as keyof AppConfig;
  if (typedKey in appConfig) {
    appConfig[typedKey] = value as never;
    setConfigValue(typedKey, value as never);
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
});

ipcMain.handle("config:set-capture-mode", (_event, mode: unknown) => {
  const parsed = validateIPC(captureModeSchema, mode);
  appConfig.captureMode = parsed;
  setConfigValue("captureMode", parsed);
  logger.info("Capture", `Capture mode set to: ${parsed}`);
});

ipcMain.handle("config:set-hotkey", (_event, hotkey: unknown) => {
  const parsed = validateIPC(hotkeySchema, hotkey);
  if (!parsed || !/^\w+([+-].+)*$/.test(parsed)) {
    return false;
  }
  setHotkey(parsed);
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

ipcMain.handle("overlay:set-click-through", (_event, enable: unknown) => {
  const parsed = validateIPC(booleanSchema, enable);
  appConfig.overlay.clickThrough = parsed;
  setConfigValue("overlay", appConfig.overlay);
  overlayWindow?.setIgnoreMouseEvents(parsed);
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
