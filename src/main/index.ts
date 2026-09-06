import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { is } from "@electron-toolkit/utils";
import {
  app,
  BrowserWindow,
  globalShortcut,
  Menu,
  Notification,
  nativeImage,
  screen,
  Tray,
} from "electron";
import { autoUpdater } from "electron-updater";

import type { AppConfig } from "../shared/types";
import type { ProviderManager } from "./ai-providers";
import { initProviders, updateAutoStart } from "./app-helpers";
import { resizeImage, smartCapture } from "./capture";
import { initChatStore, initConfig, setConfigValue } from "./config";
import { registerIpcHandlers } from "./ipc";
import { logger } from "./logger";
import { extractText, terminateOcrWorker } from "./ocr";
import { MemreaderPlugin } from "./plugins";
import { getAccount, retrieveKey } from "./secure-storage";

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
let isQuitting = false;

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

const gameExe = appConfig.gameExe;

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
    frame: false,
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
    if (isQuitting) return;
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

interface DisplayBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

function calculateOverlayPosition(
  position: AppConfig["overlay"]["position"],
  display?: DisplayBounds,
): {
  x: number;
  y: number;
} {
  const workArea = display ?? screen.getPrimaryDisplay().workArea;
  const screenWidth = workArea.width;
  const screenHeight = workArea.height;
  const offsetX = workArea.x;
  const offsetY = workArea.y;
  switch (position) {
    case "top-left":
      return { x: offsetX + 20, y: offsetY + 20 };
    case "top-right":
      return { x: offsetX + screenWidth - OVERLAY_WIN_WIDTH, y: offsetY + 20 };
    case "bottom-left":
      return {
        x: offsetX + 20,
        y: offsetY + screenHeight - OVERLAY_WIN_HEIGHT,
      };
    default:
      return {
        x: offsetX + screenWidth - OVERLAY_WIN_WIDTH,
        y: offsetY + screenHeight - OVERLAY_WIN_HEIGHT,
      };
  }
}

function getDisplayBounds(displayId: string): DisplayBounds | undefined {
  const displays = screen.getAllDisplays();
  const display = displays.find((d) => String(d.id) === displayId);
  if (!display) return undefined;
  return {
    x: display.workArea.x,
    y: display.workArea.y,
    width: display.workArea.width,
    height: display.workArea.height,
  };
}

function createOverlayWindow(): void {
  const displayBounds = appConfig.lastActiveDisplayId
    ? getDisplayBounds(appConfig.lastActiveDisplayId)
    : undefined;
  const { x, y } = calculateOverlayPosition(appConfig.overlay.position, displayBounds);

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

    if (result.displayId) {
      appConfig.lastActiveDisplayId = result.displayId;
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
  const displayBounds = appConfig.lastActiveDisplayId
    ? getDisplayBounds(appConfig.lastActiveDisplayId)
    : undefined;
  const { x, y } = calculateOverlayPosition(appConfig.overlay.position, displayBounds);
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
        isQuitting = true;
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

app.whenReady().then(async () => {
  logger.info("App", `Starting Gaming Copilot v${app.getVersion()}`);
  createMainWindow();
  createOverlayWindow();
  await loadSecureKeys();
  providerManager = initProviders(appConfig);
  initChatStore();
  registerHotkey();
  registerOverlayHotkey();
  createTray();
  updateAutoStart(appConfig);

  registerIpcHandlers({
    appConfig,
    mainWindow,
    overlayWindow,
    providerManager,
    setProviderManager: (manager) => {
      providerManager = manager;
    },
    memreaderPlugin,
    autoUpdater,
    emitConfigUpdated,
    setConfigValue,
    toggleOverlay,
    repositionOverlay,
    registerHotkey,
    unregisterHotkey,
    registerOverlayHotkey,
    setHotkey,
    logger,
  });

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

// Fires on every quit intent (Cmd+Q, app.quit(), OS shutdown) before any
// window `close` event, so the minimize-to-tray intercept below lets real
// quits through instead of hiding back to the tray.
app.on("before-quit", () => {
  isQuitting = true;
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
