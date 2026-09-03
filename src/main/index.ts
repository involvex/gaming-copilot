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

import type { AppConfig, RegionBounds } from "../shared/types";
import { ProviderManager } from "./ai-providers";
import { resizeImage, smartCapture } from "./capture";
import { findProcessByExe } from "./capture/win32";
import { initConfig, setConfigValue } from "./config";
import { logger } from "./logger";
import { MemreaderPlugin } from "./plugins";

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
}

function initProviders(): void {
  providerManager = new ProviderManager(appConfig);
  logger.info("Providers", `Initialized with active: ${appConfig.activeProvider}`);
}

function registerHotkey(): void {
  if (!appConfig.hotkeyEnabled) {
    logger.info("Hotkey", "Hotkey registration skipped (disabled)");
    return;
  }
  const hotkey = appConfig.hotkey;
  globalShortcut.register(hotkey, async () => {
    logger.info("Hotkey", `${hotkey} triggered`);
    const region = appConfig.captureRegion;
    const result = await smartCapture(gameExe || undefined, region, appConfig.captureQuality);
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
        )) {
          if (chunk.done) {
            logger.info("Hotkey", `AI streaming complete, total: ${fullText.length} chars`);
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

app.whenReady().then(() => {
  logger.info("App", `Starting Gaming Copilot v${app.getVersion()}`);
  createMainWindow();
  createOverlayWindow();
  initProviders();
  registerHotkey();
  createTray();
  updateAutoStart();

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
  logger.info("App", "Quitting");
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// IPC Handlers — Capture
ipcMain.handle("capture:screenshot", async () => {
  const region = appConfig.captureRegion;
  const result = await smartCapture(gameExe || undefined, region, appConfig.captureQuality);
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
  const result = await smartCapture(gameExe || undefined, region, appConfig.captureQuality);
  if (!result) return null;
  const resizedBuffer = resizeImage(result.buffer, result.format, appConfig.captureQuality, 256);
  const mimeType = result.format === "jpeg" ? "image/jpeg" : "image/png";
  return `data:${mimeType};base64,${resizedBuffer.toString("base64")}`;
});
ipcMain.handle("capture:check-game", (_event, exeName: string) => {
  if (!exeName || !/^[\w.-]+\.exe$/.test(exeName.endsWith(".exe") ? exeName : `${exeName}.exe`)) {
    return { running: false, pid: null };
  }
  const pid = findProcessByExe(exeName);
  return { running: pid !== null, pid };
});

ipcMain.handle("capture:set-region", (_event, region: RegionBounds | null) => {
  appConfig.captureRegion = region || undefined;
  setConfigValue("captureRegion", region || undefined);
  logger.info(
    "Capture",
    region ? `Region set: ${region.width}x${region.height}` : "Region cleared",
  );
});

// IPC Handlers — AI
ipcMain.handle("ai:analyze", async (_event, imageBase64: string, userMessage?: string) => {
  if (!providerManager) return { error: "Provider manager not initialized" };

  try {
    const response = await providerManager.analyze(
      imageBase64,
      "image/png",
      appConfig.prompts.system,
      userMessage || "Analyze this game screenshot.",
    );
    return { response };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Analysis failed";
    return { error: message };
  }
});

ipcMain.handle("ai:test-provider", async (_event, name: string) => {
  if (!providerManager) return false;
  return providerManager.testProvider(name);
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

  try {
    let fullText = "";
    for await (const chunk of providerManager.streamAnalyze(
      imageBase64,
      "image/png",
      finalPrompt,
      userMessage || "Analyze this game screenshot.",
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

ipcMain.handle("config:get", () => appConfig);

ipcMain.handle("config:set-provider", (_event, name: string, config: Record<string, unknown>) => {
  if (name === "gemini") {
    appConfig.providers.gemini = config as AppConfig["providers"]["gemini"];
  } else {
    if (!appConfig.providers.openaiCompat) {
      appConfig.providers.openaiCompat = { endpoints: [] };
    }
    const existing = appConfig.providers.openaiCompat.endpoints.findIndex((e) => e.name === name);
    if (existing >= 0) {
      appConfig.providers.openaiCompat.endpoints[existing] = {
        ...appConfig.providers.openaiCompat.endpoints[existing],
        ...config,
      };
    } else {
      appConfig.providers.openaiCompat.endpoints.push({
        name: name as string,
        baseUrl: config.baseUrl as string,
        apiKey: config.apiKey as string,
        model: config.model as string,
      });
    }
  }
  setConfigValue("providers", appConfig.providers);
  initProviders();
});

ipcMain.handle("config:remove-endpoint", (_event, name: string) => {
  if (!appConfig.providers.openaiCompat) return;
  appConfig.providers.openaiCompat.endpoints = appConfig.providers.openaiCompat.endpoints.filter(
    (e) => e.name !== name,
  );
  setConfigValue("providers", appConfig.providers);
  initProviders();
});

ipcMain.handle("config:set-overlay", (_event, overlay: Partial<AppConfig["overlay"]>) => {
  appConfig.overlay = { ...appConfig.overlay, ...overlay };
  setConfigValue("overlay", appConfig.overlay);
});

ipcMain.handle("config:set-tts", (_event, tts: Partial<AppConfig["tts"]>) => {
  appConfig.tts = { ...appConfig.tts, ...tts };
  setConfigValue("tts", appConfig.tts);
});

ipcMain.handle("config:set-prompts", (_event, prompts: Partial<AppConfig["prompts"]>) => {
  appConfig.prompts = { ...appConfig.prompts, ...prompts };
  setConfigValue("prompts", appConfig.prompts);
});

ipcMain.handle("config:set-auto-start", (_event, enable: boolean) => {
  appConfig.autoStart = enable;
  setConfigValue("autoStart", enable);
  updateAutoStart();
});

ipcMain.handle("config:set-generic", (_event, key: string, value: unknown) => {
  const typedKey = key as keyof AppConfig;
  if (typedKey in appConfig) {
    appConfig[typedKey] = value as never;
    setConfigValue(typedKey, value as never);
  }
});

ipcMain.handle("config:set-hotkey", (_event, hotkey: string) => {
  if (!hotkey || !/^\w+([+-].+)*$/.test(hotkey)) {
    return false;
  }
  setHotkey(hotkey);
  return true;
});

ipcMain.handle("config:set-hotkey-enabled", (_event, enabled: boolean) => {
  appConfig.hotkeyEnabled = enabled;
  setConfigValue("hotkeyEnabled", enabled);
  if (enabled) {
    registerHotkey();
  } else {
    unregisterHotkey();
  }
  logger.info("Hotkey", `Hotkey enabled: ${enabled}`);
  return true;
});

// IPC Handlers — Overlay
ipcMain.handle("overlay:show", (_event, text: string) => {
  overlayWindow?.webContents.send("overlay:data", text);
  overlayWindow?.show();
});

ipcMain.handle("overlay:hide", () => {
  overlayWindow?.hide();
});

ipcMain.handle("overlay:set-click-through", (_event, enable: boolean) => {
  appConfig.overlay.clickThrough = enable;
  setConfigValue("overlay", appConfig.overlay);
  overlayWindow?.setIgnoreMouseEvents(enable);
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
