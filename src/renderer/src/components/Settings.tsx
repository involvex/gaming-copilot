import { useEffect, useState } from "react";
import OverlayStyle from "./OverlayStyle";
import PromptEditor from "./PromptEditor";
import ProviderConfig from "./ProviderConfig";
import { useTheme } from "./ThemeProvider";
import TTSConfig from "./TTSConfig";
import { Button, Card, Input, Select, Toggle } from "./ui";

type Tab = "providers" | "capture" | "overlay" | "tts" | "prompts" | "general";

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const [config, setConfig] = useState<Record<string, unknown> | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        window.location.hash = "#/";
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    const loadConfig = () => {
      window.electronAPI.getConfig().then((cfg) => {
        const c = cfg as Record<string, unknown>;
        setConfig(c);
      });
    };
    loadConfig();

    window.electronAPI.onConfigUpdated(() => {
      loadConfig();
    });
    return () => {
      window.electronAPI.removeAllListeners("config:updated");
    };
  }, []);

  const tabs: Array<{ id: Tab; label: string; keywords: string[] }> = [
    {
      id: "providers",
      label: "AI Providers",
      keywords: [
        "api key",
        "model",
        "provider",
        "endpoint",
        "openai",
        "gemini",
        "cache",
        "fallback",
        "test connection",
        "active provider",
      ],
    },
    {
      id: "capture",
      label: "Capture",
      keywords: [
        "screenshot",
        "quality",
        "region",
        "monitor",
        "fullscreen",
        "game exe",
        "recording",
        "ocr",
        "language",
        "gdi",
        "jpeg",
        "image",
        "save",
        "directory",
        "auto-start",
      ],
    },
    {
      id: "overlay",
      label: "Overlay",
      keywords: [
        "position",
        "opacity",
        "duration",
        "font size",
        "click-through",
        "theme",
        "background",
        "text color",
        "border",
        "css",
        "custom css",
        "radius",
        "padding",
        "transparency",
      ],
    },
    {
      id: "tts",
      label: "TTS",
      keywords: ["voice", "rate", "pitch", "volume", "speech", "text-to-speech", "speed"],
    },
    {
      id: "prompts",
      label: "Prompts",
      keywords: ["system prompt", "game-specific", "prompt", "instruction"],
    },
    {
      id: "general",
      label: "General",
      keywords: [
        "theme",
        "hotkey",
        "auto-start",
        "notification",
        "telemetry",
        "keychain",
        "update",
        "minimize",
        "tray",
        "windows",
        "export",
        "import",
        "config",
        "backup",
        "restore",
      ],
    },
  ];

  const [activeTab, setActiveTab] = useState<Tab>("providers");

  const filteredTabs = tabs.filter((tab) => {
    if (!search) return true;
    const query = search.toLowerCase();
    return (
      tab.label.toLowerCase().includes(query) ||
      tab.keywords.some((kw) => kw.toLowerCase().includes(query))
    );
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey) {
        const num = e.key;
        if (num >= "1" && num <= "6") {
          e.preventDefault();
          const idx = Number(num) - 1;
          const tabIds: Tab[] = ["providers", "capture", "overlay", "tts", "prompts", "general"];
          const tab = tabIds[idx];
          if (tab) {
            setActiveTab(tab);
          }
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] p-4 sm:p-6">
      <div className="container mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-3">
          <h1 className="text-2xl font-bold">Settings</h1>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              window.location.hash = "#/";
            }}
          >
            Back to App
          </Button>
        </div>

        <div className="mb-6">
          <label htmlFor="settings-search" className="sr-only">
            Search settings
          </label>
          <Input
            id="settings-search"
            type="text"
            placeholder="Search settings..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex gap-1 mb-6 bg-[var(--color-surface)] rounded-lg p-1 flex-wrap overflow-x-auto">
          {filteredTabs.length === 0 && search ? (
            <div className="w-full text-center py-4 text-[var(--color-text-tertiary)] text-sm">
              No settings found matching "{search}"
            </div>
          ) : (
            filteredTabs.map((tab) => {
              const matchesSearch =
                search &&
                (tab.label.toLowerCase().includes(search.toLowerCase()) ||
                  tab.keywords.some((kw) => kw.toLowerCase().includes(search.toLowerCase())));
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id);
                    if (search) setSearch("");
                  }}
                  className={`relative flex-1 min-w-[120px] px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? "bg-[var(--color-accent)] text-white"
                      : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]"
                  } ${matchesSearch ? "ring-2 ring-[var(--color-accent)]/50" : ""}`}
                >
                  {tab.label}
                </button>
              );
            })
          )}
        </div>

        <Card>
          {activeTab === "providers" && <ProviderConfig config={config} />}
          {activeTab === "capture" && <CaptureConfig config={config} />}
          {activeTab === "overlay" && <OverlayStyle config={config} />}
          {activeTab === "tts" && <TTSConfig config={config} />}
          {activeTab === "prompts" && <PromptEditor config={config} />}
          {activeTab === "general" && (
            <GeneralConfig config={config} theme={theme} onThemeChange={setTheme} />
          )}
        </Card>
      </div>
    </div>
  );
}

function CaptureConfig({ config }: { config: Record<string, unknown> | null }) {
  const [gameExe, setGameExe] = useState((config?.gameExe as string) || "");
  const [autoStart, setAutoStart] = useState<boolean>((config?.autoStart as boolean) || false);
  const [notifications, setNotifications] = useState<boolean>(
    (config?.notifications as boolean) || true,
  );
  const [captureQuality, setCaptureQuality] = useState<number>(
    (config?.captureQuality as number) || 85,
  );
  const [hotkey, setHotkey] = useState((config?.hotkey as string) || "CommandOrControl+Shift+G");
  const [overlayHotkey, setOverlayHotkey] = useState(
    (config?.overlayHotkey as string) || "CommandOrControl+Shift+O",
  );
  const [hotkeyEnabled, setHotkeyEnabled] = useState<boolean>(
    (config?.hotkeyEnabled as boolean) ?? true,
  );
  const [maxImageWidth, setMaxImageWidth] = useState<number>(
    (config?.maxImageWidth as number) || 1024,
  );
  const [hotkeyInput, setHotkeyInput] = useState("");
  const [ocrEnabled, setOcrEnabled] = useState<boolean>(
    ((config?.ocr as Record<string, unknown>)?.enabled as boolean) ?? true,
  );
  const [ocrLanguage, setOcrLanguage] = useState<string>(
    ((config?.ocr as Record<string, unknown>)?.language as string) || "eng",
  );
  const [monitorIndex, setMonitorIndex] = useState<number>((config?.monitorIndex as number) || 0);
  const [captureMode, setCaptureMode] = useState<string>((config?.captureMode as string) || "auto");
  const [recordDuration, setRecordDuration] = useState<number>(
    (config?.recordDuration as number) || 10,
  );
  const [saveScreenshots, setSaveScreenshots] = useState<boolean>(
    (config?.saveScreenshots as boolean) ?? false,
  );
  const [screenshotDir, setScreenshotDir] = useState<string>(
    (config?.screenshotDir as string) || "",
  );
  const [screens, setScreens] = useState<Array<{ index: number; name: string; primary: boolean }>>(
    [],
  );
  const [preview, setPreview] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [gameStatus, setGameStatus] = useState<"idle" | "checking" | "running" | "not-found">(
    "idle",
  );

  useEffect(() => {
    window.electronAPI.getScreens().then((screens) => {
      setScreens(screens);
    });
  }, []);

  const handleCheckGame = async () => {
    if (!gameExe) return;
    setGameStatus("checking");
    const result = await window.electronAPI.checkGame(gameExe);
    setGameStatus(result.running ? "running" : "not-found");
    if (result.running) {
      await window.electronAPI.setGameExe(gameExe);
    }
  };

  const handlePreview = async () => {
    setPreviewLoading(true);
    try {
      const result = await window.electronAPI.capturePreview();
      setPreview(result);
    } catch {
      setPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleAutoStartToggle = async (next: boolean) => {
    setAutoStart(next);
    await window.electronAPI.setAutoStart(next);
  };

  const handleNotificationsToggle = async (next: boolean) => {
    setNotifications(next);
    await window.electronAPI.setSetting("notifications", next);
  };

  const handleOcrToggle = async (next: boolean) => {
    setOcrEnabled(next);
    await window.electronAPI.setSetting("ocr", {
      ...(config?.ocr as Record<string, unknown> | undefined),
      enabled: next,
    });
  };

  const handleOcrLanguageChange = async (lang: string) => {
    setOcrLanguage(lang);
    await window.electronAPI.setSetting("ocr", {
      ...(config?.ocr as Record<string, unknown> | undefined),
      language: lang,
    });
  };

  const handleHotkeyToggle = async (next: boolean) => {
    setHotkeyEnabled(next);
    await window.electronAPI.setHotkeyEnabled(next);
  };

  const handleHotkeyChange = async () => {
    if (hotkeyInput.trim()) {
      const ok = await window.electronAPI.setHotkey(hotkeyInput.trim());
      if (ok) {
        setHotkey(hotkeyInput.trim());
        setHotkeyInput("");
      }
    }
  };

  const [overlayHotkeyInput, setOverlayHotkeyInput] = useState("");
  const handleOverlayHotkeyChange = async () => {
    if (overlayHotkeyInput.trim()) {
      const ok = await window.electronAPI.setOverlayHotkey(overlayHotkeyInput.trim());
      if (ok) {
        setOverlayHotkey(overlayHotkeyInput.trim());
        setOverlayHotkeyInput("");
      }
    }
  };

  const handleSaveScreenshotsToggle = async (next: boolean) => {
    setSaveScreenshots(next);
    if (next && !screenshotDir) {
      const dir = await window.electronAPI.pickScreenshotDir();
      if (dir) {
        setScreenshotDir(dir);
        await window.electronAPI.setSaveScreenshots(next, dir);
      } else {
        setSaveScreenshots(false);
        await window.electronAPI.setSaveScreenshots(false, null);
      }
    } else {
      await window.electronAPI.setSaveScreenshots(next, screenshotDir || null);
    }
  };

  const handleScreenshotDirChange = async () => {
    const dir = await window.electronAPI.pickScreenshotDir();
    if (dir) {
      setScreenshotDir(dir);
      await window.electronAPI.setSaveScreenshots(saveScreenshots, dir);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="section-heading">Game Capture</h2>

      <div>
        <label htmlFor="game-exe" className="field-label">
          Game Executable
        </label>
        <p className="field-label-description">
          Enter the .exe name of your game (e.g., Neuz.exe, NewWorld.exe)
        </p>
        <div className="flex gap-2">
          <Input
            id="game-exe"
            type="text"
            value={gameExe}
            onChange={(e) => setGameExe(e.target.value)}
            placeholder="Neuz.exe"
          />
          <Button variant="primary" size="md" onClick={handleCheckGame}>
            Check
          </Button>
          <Button
            variant="secondary"
            size="md"
            onClick={handlePreview}
            disabled={previewLoading}
            title="Capture a preview thumbnail"
          >
            {previewLoading ? "..." : "Preview"}
          </Button>
        </div>
        {gameStatus === "running" && (
          <p className="text-sm text-[var(--color-success)] mt-2">Game detected and running</p>
        )}
        {gameStatus === "not-found" && (
          <p className="text-sm text-[var(--color-warning)] mt-2">
            Game not found — screenshot will use fullscreen
          </p>
        )}
        {preview && (
          <img
            src={preview}
            alt="Capture preview"
            className="mt-3 rounded border border-[var(--color-border)] max-w-full max-h-40 object-contain"
          />
        )}
      </div>

      <div>
        <label htmlFor="hotkey-input" className="field-label">
          Screenshot Hotkey
        </label>
        <p className="field-label-description">
          Current: <kbd className="kbd">{hotkey}</kbd>
        </p>
        <div className="flex gap-2">
          <Input
            id="hotkey-input"
            type="text"
            value={hotkeyInput}
            onChange={(e) => setHotkeyInput(e.target.value)}
            onBlur={handleHotkeyChange}
            placeholder="Ctrl+Shift+G"
          />
          <Button
            variant="primary"
            size="md"
            onClick={handleHotkeyChange}
            disabled={!hotkeyInput.trim()}
          >
            Save
          </Button>
        </div>
      </div>

      <div>
        <label htmlFor="overlay-hotkey-input" className="field-label">
          Overlay Toggle Hotkey
        </label>
        <p className="field-label-description">
          Current: <kbd className="kbd">{overlayHotkey}</kbd>
        </p>
        <div className="flex gap-2">
          <Input
            id="overlay-hotkey-input"
            type="text"
            value={overlayHotkeyInput}
            onChange={(e) => setOverlayHotkeyInput(e.target.value)}
            onBlur={handleOverlayHotkeyChange}
            placeholder="Ctrl+Shift+O"
          />
          <Button
            variant="primary"
            size="md"
            onClick={handleOverlayHotkeyChange}
            disabled={!overlayHotkeyInput.trim()}
          >
            Save
          </Button>
        </div>
        <p className="field-label-description">
          Show/hide the overlay window. Also available in the tray context menu.
        </p>
      </div>

      <Toggle
        id="hotkey-enabled"
        checked={hotkeyEnabled}
        onChange={handleHotkeyToggle}
        label="Enable Hotkey"
        description="Disable to temporarily stop the global hotkey from triggering."
      />

      <div>
        <label htmlFor="capture-quality" className="field-label">
          Capture Quality: {captureQuality}
        </label>
        <p className="field-label-description">
          JPEG quality for screenshot compression. Lower values reduce token cost but may lose
          detail.
        </p>
        <input
          id="capture-quality"
          type="range"
          min={20}
          max={100}
          step={5}
          value={captureQuality}
          onChange={(e) => {
            const v = Number(e.target.value);
            setCaptureQuality(v);
            window.electronAPI.setSetting("captureQuality", v);
          }}
          className="w-full"
        />
      </div>

      <div>
        <label htmlFor="max-image-width" className="field-label">
          Max Image Width: {maxImageWidth}px
        </label>
        <p className="field-label-description">
          Resizes screenshots to this maximum width before sending to AI. Lower values reduce token
          cost.
        </p>
        <input
          id="max-image-width"
          type="range"
          min={256}
          max={2048}
          step={64}
          value={maxImageWidth}
          onChange={(e) => {
            const v = Number(e.target.value);
            setMaxImageWidth(v);
            window.electronAPI.setSetting("maxImageWidth", v);
          }}
          className="w-full"
        />
      </div>

      <div>
        <label htmlFor="monitor-select" className="field-label">
          Monitor
        </label>
        <p className="field-label-description">
          Select which monitor to capture when the game is not detectible.
        </p>
        {screens.length > 0 ? (
          <Select
            id="monitor-select"
            value={monitorIndex}
            onChange={(e) => {
              const v = Number(e.target.value);
              setMonitorIndex(v);
              window.electronAPI.setSetting("monitorIndex", v);
            }}
          >
            {screens.map((s) => (
              <option key={s.index} value={s.index}>
                {s.name} {s.primary ? "(Primary)" : ""}
              </option>
            ))}
          </Select>
        ) : (
          <p className="text-xs text-[var(--color-text-tertiary)]">Loading displays...</p>
        )}
      </div>

      <div>
        <label htmlFor="capture-mode" className="field-label">
          Capture Mode
        </label>
        <p className="field-label-description">
          Auto tries window capture first, then GDI+ fallback, then fullscreen. Override to force a
          specific method.
        </p>
        <Select
          id="capture-mode"
          value={captureMode}
          onChange={(e) => {
            const v = e.target.value;
            setCaptureMode(v);
            window.electronAPI.setCaptureMode(v as "auto" | "window" | "fullscreen" | "gdi");
          }}
        >
          <option value="auto">Auto (window → GDI+ → fullscreen)</option>
          <option value="window">Window Only</option>
          <option value="gdi">GDI+ Fallback Only</option>
          <option value="fullscreen">Fullscreen Only</option>
        </Select>
      </div>

      <div>
        <label htmlFor="record-duration" className="field-label">
          Recording Duration: {recordDuration}s
        </label>
        <p className="field-label-description">
          Seconds to record when using the screen recording capture mode. Multiple keyframes are
          combined into a single composite image.
        </p>
        <input
          id="record-duration"
          type="range"
          min={5}
          max={30}
          step={1}
          value={recordDuration}
          onChange={(e) => {
            const v = Number(e.target.value);
            setRecordDuration(v);
            window.electronAPI.setSetting("recordDuration", v);
          }}
          className="w-full"
        />
      </div>

      <Toggle
        id="save-screenshots"
        checked={saveScreenshots}
        onChange={handleSaveScreenshotsToggle}
        label="Save Screenshots"
        description="When enabled, captured screenshots are automatically saved to the selected directory with timestamped filenames."
      />

      {saveScreenshots && (
        <div className="mt-3 space-y-2">
          <div className="flex gap-2 items-center">
            <Input
              type="text"
              value={screenshotDir}
              onChange={(e) => setScreenshotDir(e.target.value)}
              placeholder="C:\Screenshots"
            />
            <Button variant="secondary" size="sm" onClick={handleScreenshotDirChange}>
              Browse
            </Button>
          </div>
          <p className="text-xs text-[var(--color-text-tertiary)]">
            Files will be saved as{" "}
            <code className="bg-[var(--color-input-bg)] px-1 rounded">
              gaming-copilot_yyyy-mm-dd-hh-mm-ss.jpg
            </code>
          </p>
        </div>
      )}

      <Toggle
        id="auto-start"
        checked={autoStart}
        onChange={handleAutoStartToggle}
        label="Start with Windows"
        description="Launch Gaming Copilot automatically when Windows starts."
      />

      <Toggle
        id="notifications"
        checked={notifications}
        onChange={handleNotificationsToggle}
        label="System Notifications"
        description="Show a system notification when AI analysis completes."
      />

      <Toggle
        id="ocr-enabled"
        checked={ocrEnabled}
        onChange={handleOcrToggle}
        label="OCR Text Extraction"
        description="Extract on-screen text via OCR and include it in AI prompts for better context."
      />

      {ocrEnabled && (
        <div className="mt-2">
          <label htmlFor="ocr-language" className="field-label">
            OCR Language
          </label>
          <Select
            id="ocr-language"
            value={ocrLanguage}
            onChange={(e) => handleOcrLanguageChange(e.target.value)}
          >
            <option value="eng">English</option>
            <option value="eng+osd">English + Orientation</option>
            <option value="universal">Universal (all scripts)</option>
          </Select>
        </div>
      )}
    </div>
  );
}

function GeneralConfig({
  config,
  theme,
  onThemeChange,
}: {
  config: Record<string, unknown> | null;
  theme: "dark" | "light" | "system" | "hacker" | "monokai";
  onThemeChange: (theme: "dark" | "light" | "system" | "hacker" | "monokai") => void;
}) {
  const [telemetry, setTelemetry] = useState<boolean>(
    ((config?.telemetry as Record<string, unknown>)?.enabled as boolean) ?? false,
  );

  const [version, setVersion] = useState<string>("0.0.0");
  const [updateStatus, setUpdateStatus] = useState<
    "idle" | "checking" | "available" | "not-available" | "downloaded" | "error"
  >("idle");
  const [updateVersion, setUpdateVersion] = useState<string | null>(null);
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);

  useEffect(() => {
    window.electronAPI.getVersion().then(setVersion);

    const handler = (status: string, newVersion?: string, message?: string) => {
      setUpdateStatus(status as typeof updateStatus);
      if (newVersion) setUpdateVersion(newVersion);
      if (message) setUpdateMessage(message);
    };
    window.electronAPI.onUpdateStatus(handler);
    return () => window.electronAPI.removeAllListeners("app:update-status");
  }, []);

  const handleTelemetryToggle = async (next: boolean) => {
    setTelemetry(next);
    await window.electronAPI.setTelemetry(next);
  };

  const handleCheckUpdates = async () => {
    setUpdateStatus("checking");
    await window.electronAPI.checkForUpdates("check");
  };

  const handleInstallUpdate = async () => {
    await window.electronAPI.checkForUpdates("install");
  };

  const [importStatus, setImportStatus] = useState<{
    message: string;
    success: boolean;
  } | null>(null);

  const handleImportConfig = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const config = JSON.parse(text) as Record<string, unknown>;
      await window.electronAPI.importConfig(config);
      setImportStatus({
        message: "Configuration imported successfully! Please restart the app.",
        success: true,
      });
    } catch (error) {
      setImportStatus({
        message: `Import failed: ${error instanceof Error ? error.message : String(error)}`,
        success: false,
      });
    }
  };

  const handleExport = async (format: "markdown" | "json") => {
    try {
      const content = await window.electronAPI.exportChatHistory(format);
      const blob = new Blob([content], {
        type: format === "markdown" ? "text/markdown" : "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `gaming-copilot-history.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export failed:", error);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="section-heading">General</h2>

      <Toggle
        id="telemetry-toggle"
        checked={telemetry}
        onChange={handleTelemetryToggle}
        label="Anonymous Usage Analytics"
        description="Send anonymous usage data (hotkey usage, capture frequency, provider success rates) to help improve Gaming Copilot. No screenshots or personal data are ever sent."
      />

      <div>
        <label htmlFor="app-theme-select" className="field-label">
          Color Theme
        </label>
        <p className="field-label-description">
          Choose a color theme for the application. The overlay has its own separate theme settings.
        </p>
        <Select
          id="app-theme-select"
          value={theme}
          onChange={(e) => onThemeChange(e.target.value as typeof theme)}
        >
          <option value="dark">Dark</option>
          <option value="light">Light</option>
          <option value="system">System (Auto-detect)</option>
          <option value="hacker">Hacker (Matrix)</option>
          <option value="monokai">Monokai</option>
        </Select>
      </div>

      <Toggle
        id="keychain-toggle"
        checked={(config?.useKeychain as boolean) ?? true}
        onChange={async (next) => {
          await window.electronAPI.setSetting("useKeychain", next);
          window.location.reload();
        }}
        label="Encrypt API Keys"
        description="Store API keys in your OS keychain (Windows Credential Manager) instead of plaintext config. Toggling off will move keys back to the config file."
      />

      <div>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-1">
              Application Updates
            </h3>
            <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
              Current version: <strong>v{version}</strong> ·{" "}
              {updateStatus === "idle" && "No updates checked"}
              {updateStatus === "checking" && "Checking for updates..."}
              {updateStatus === "available" && `Update ${updateVersion} available!`}
              {updateStatus === "not-available" && "You are up to date"}
              {updateStatus === "downloaded" && `Update ${updateVersion} ready to install!`}
              {updateStatus === "error" && updateMessage}
            </p>
          </div>
          {updateStatus === "available" || updateStatus === "downloaded" ? (
            <Button variant="primary" size="sm" onClick={handleInstallUpdate}>
              Install Update
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCheckUpdates}
              disabled={updateStatus === "checking"}
            >
              Check for Updates
            </Button>
          )}
        </div>
      </div>

      <div>
        <label className="field-label" htmlFor="config-export">
          Configuration Backup &amp; Restore
        </label>
        <p className="field-label-description">
          Export your app settings to a JSON file for backup or migration. API keys are redacted in
          the exported file for security — re-enter them after importing.
        </p>
        <div className="flex flex-col gap-3">
          <Button
            variant="primary"
            size="md"
            id="config-export"
            onClick={async () => {
              try {
                const cfg = await window.electronAPI.exportConfig();
                const blob = new Blob([JSON.stringify(cfg, null, 2)], {
                  type: "application/json",
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "gaming-copilot-config.json";
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              } catch (error) {
                console.error("Config export failed:", error);
              }
            }}
          >
            Export Config
          </Button>

          <div className="flex items-center gap-2">
            <Input
              type="file"
              id="config-import"
              accept=".json,application/json"
              onChange={handleImportConfig}
              className="hidden"
            />
            <label
              htmlFor="config-import"
              className="btn-secondary btn-sm cursor-pointer inline-block"
            >
              Choose Config File
            </label>
            <Button
              variant="secondary"
              size="sm"
              id="config-import-btn"
              onClick={() => document.getElementById("config-import")?.click()}
            >
              Import
            </Button>
          </div>

          {importStatus?.message && (
            <p
              className={`text-xs ${importStatus.success ? "text-[var(--color-success)]" : "text-[var(--color-error)]"}`}
            >
              {importStatus.message}
            </p>
          )}
        </div>
      </div>

      <div>
        <label className="field-label" htmlFor="export-markdown">
          Export Chat History
        </label>
        <p className="field-label-description">
          Export all chat messages to a file for saving or sharing.
        </p>
        <div className="flex gap-2">
          <Button variant="primary" size="md" onClick={() => handleExport("markdown")}>
            Export as Markdown
          </Button>
          <Button variant="secondary" size="md" onClick={() => handleExport("json")}>
            Export as JSON
          </Button>
        </div>
      </div>
    </div>
  );
}
