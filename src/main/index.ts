import { join } from "node:path";

import { is } from "@electron-toolkit/utils";
import {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  Menu,
  nativeImage,
  screen,
  Tray,
} from "electron";

import { DEFAULT_SYSTEM_PROMPT } from "../shared/constants";
import type { AppConfig } from "../shared/types";
import { ProviderManager } from "./ai-providers";
import { smartCapture } from "./capture";
import { findProcessByExe } from "./capture/win32";

let mainWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let providerManager: ProviderManager | null = null;

// Default config (will be loaded from electron-store in Phase 5)
let gameExe = "";
const appConfig: AppConfig = {
  hotkey: "CommandOrControl+Shift+G",
  autoStart: false,
  minimizeToTray: true,
  gameExe: "",
  captureQuality: 85,
  providers: {},
  activeProvider: "gemini",
  overlay: {
    position: "bottom-right",
    duration: 8000,
    opacity: 0.9,
    fontSize: 14,
    theme: "dark",
    clickThrough: true,
  },
  tts: {
    enabled: false,
    voice: "",
    rate: 1.0,
    pitch: 1.0,
    volume: 0.8,
  },
  plugins: {
    bunMemreader: {
      enabled: false,
      port: 31337,
      autoStart: false,
    },
  },
  prompts: {
    system: DEFAULT_SYSTEM_PROMPT,
    gameSpecific: {},
  },
};

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

  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    overlayWindow.loadURL(`${process.env.ELECTRON_RENDERER_URL}/#/overlay`);
  } else {
    overlayWindow.loadFile(join(__dirname, "../renderer/index.html"), {
      hash: "/overlay",
    });
  }

  overlayWindow.hide();
}

function initProviders(): void {
  providerManager = new ProviderManager(appConfig);
}

function registerHotkey(): void {
  globalShortcut.register("CommandOrControl+Shift+G", async () => {
    // Capture screenshot
    const result = await smartCapture(gameExe || undefined);
    if (!result) return;

    const imageBase64 = result.buffer.toString("base64");
    const dataUrl = `data:image/png;base64,${imageBase64}`;

    // Show "analyzing" state in overlay
    overlayWindow?.webContents.send("overlay:data", "Analyzing screenshot...");
    overlayWindow?.show();

    // Send to AI provider
    if (providerManager && providerManager.getAvailableProviders().length > 0) {
      try {
        const response = await providerManager.analyze(
          imageBase64,
          "image/png",
          appConfig.prompts.system,
          "Analyze this game screenshot.",
        );
        overlayWindow?.webContents.send("overlay:data", response.text);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Analysis failed";
        overlayWindow?.webContents.send("overlay:data", `Error: ${message}`);
      }
    } else {
      // No providers configured, just show screenshot
      mainWindow?.webContents.send("capture:result", dataUrl);
      overlayWindow?.webContents.send(
        "overlay:data",
        "No AI provider configured. Open Settings to add one.",
      );
    }

    // Also send to main window
    mainWindow?.webContents.send("capture:result", dataUrl);
  });
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
}

app.whenReady().then(() => {
  createMainWindow();
  createOverlayWindow();
  initProviders();
  registerHotkey();
  createTray();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// IPC Handlers — Capture
ipcMain.handle("capture:screenshot", async () => {
  const result = await smartCapture(gameExe || undefined);
  if (!result) return null;
  return `data:image/png;base64,${result.buffer.toString("base64")}`;
});

ipcMain.handle("capture:check-game", (_event, exeName: string) => {
  const pid = findProcessByExe(exeName);
  return { running: pid !== null, pid };
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

ipcMain.handle("ai:get-providers", () => {
  if (!providerManager) return [];
  return providerManager.getAvailableProviders().map((p) => ({
    name: p.name,
    displayName: p.displayName,
    rateLimit: p.getRateLimitInfo(),
  }));
});

// IPC Handlers — Config
ipcMain.handle("config:set-game-exe", (_event, exe: string) => {
  gameExe = exe;
  appConfig.gameExe = exe;
});

ipcMain.handle("config:get", () => appConfig);

ipcMain.handle("config:set-provider", (_event, name: string, config: Record<string, unknown>) => {
  if (name === "gemini") {
    appConfig.providers.gemini = config as AppConfig["providers"]["gemini"];
  } else if (appConfig.providers.openaiCompat) {
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
  initProviders();
});

// IPC Handlers — Overlay
ipcMain.handle("overlay:show", (_event, text: string) => {
  overlayWindow?.webContents.send("overlay:data", text);
  overlayWindow?.show();
});

ipcMain.handle("overlay:hide", () => {
  overlayWindow?.hide();
});

// IPC Handlers — Window
ipcMain.handle("window:open-settings", () => {
  mainWindow?.show();
  mainWindow?.webContents.send("navigate:settings");
});
