import { useEffect, useState } from "react";

import OverlayStyle from "./OverlayStyle";
import PromptEditor from "./PromptEditor";
import ProviderConfig from "./ProviderConfig";
import TTSConfig from "./TTSConfig";

type Tab = "providers" | "capture" | "overlay" | "tts" | "prompts" | "general";

function resolveSystemTheme(): "dark" | "light" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState<Tab>("providers");
  const [config, setConfig] = useState<Record<string, unknown> | null>(null);
  const [theme, setTheme] = useState<"dark" | "light" | "system">("system");
  const [resolvedTheme, setResolvedTheme] = useState<"dark" | "light">("dark");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const updateResolved = () => {
      if (theme === "system") {
        setResolvedTheme(resolveSystemTheme());
      } else {
        setResolvedTheme(theme);
      }
    };
    updateResolved();

    if (theme === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => setResolvedTheme(resolveSystemTheme());
      mediaQuery.addEventListener("change", handler);
      return () => mediaQuery.removeEventListener("change", handler);
    }
  }, [theme]);

  useEffect(() => {
    const loadConfig = () => {
      window.electronAPI.getConfig().then((cfg) => {
        const c = cfg as Record<string, unknown>;
        setConfig(c);
        setTheme((c.theme as "dark" | "light" | "system") || "system");
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
    <div
      className={`min-h-screen p-6 transition-colors ${
        resolvedTheme === "dark" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-900"
      }`}
    >
      {resolvedTheme === "light" && (
        <style>{`
          [data-light] .bg-gray-800 { background-color: #f3f4f6; }
          [data-light] .bg-gray-700 { background-color: #e5e7eb; }
          [data-light] .bg-gray-600 { background-color: #d1d5db; }
          [data-light] .bg-gray-700\\/50 { background-color: #e5e7eb; }
          [data-light] .border-gray-600 { border-color: #9ca3af; }
          [data-light] .border-gray-700 { border-color: #d1d5db; }
          [data-light] .text-gray-300 { color: #6b7280; }
          [data-light] .text-gray-400 { color: #6b7280; }
          [data-light] .text-gray-500 { color: #4b5563; }
          [data-light] .text-gray-100 { color: #111827; }
          [data-light] input { background-color: #f9fafb; border-color: #9ca3af; color: #111827; }
          [data-light] select { background-color: #f9fafb; border-color: #9ca3af; color: #111827; }
        `}</style>
      )}
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <div className="mb-6">
        <label htmlFor="settings-search" className="sr-only">
          Search settings
        </label>
        <input
          id="settings-search"
          type="text"
          placeholder="Search settings..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`w-full bg-gray-800 border rounded-lg px-3 py-2 text-sm transition-colors ${
            resolvedTheme === "dark"
              ? "border-gray-600 focus:border-blue-500 text-white"
              : "border-gray-300 focus:border-blue-500 text-gray-900"
          }}`}
          data-light={resolvedTheme === "light" ? "" : undefined}
        />
      </div>

      <div
        className="flex gap-1 mb-6 bg-gray-800 rounded-lg p-1 flex-wrap"
        data-light={resolvedTheme === "light" ? "" : undefined}
      >
        {filteredTabs.length === 0 && search ? (
          <div className="w-full text-center py-4 text-gray-500 text-sm">
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
                className={`relative flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? "bg-blue-600 text-white"
                    : "text-gray-400 hover:text-white hover:bg-gray-700"
                } ${matchesSearch ? "ring-2 ring-blue-400" : ""}`}
              >
                {tab.label}
              </button>
            );
          })
        )}
      </div>

      <div
        className="bg-gray-800 rounded-lg p-6"
        data-light={resolvedTheme === "light" ? "" : undefined}
      >
        {activeTab === "providers" && <ProviderConfig config={config} />}
        {activeTab === "capture" && <CaptureConfig config={config} />}
        {activeTab === "overlay" && <OverlayStyle config={config} />}
        {activeTab === "tts" && <TTSConfig config={config} />}
        {activeTab === "prompts" && <PromptEditor config={config} />}
        {activeTab === "general" && (
          <GeneralConfig
            config={config}
            theme={theme}
            resolvedTheme={resolvedTheme}
            onThemeChange={setTheme}
          />
        )}
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

  const handleAutoStartToggle = async () => {
    const newValue = !autoStart;
    setAutoStart(newValue);
    await window.electronAPI.setAutoStart(newValue);
  };

  const handleNotificationsToggle = async () => {
    const newValue = !notifications;
    setNotifications(newValue);
    await window.electronAPI.setSetting("notifications", newValue);
  };

  const handleOcrToggle = async () => {
    const newValue = !ocrEnabled;
    setOcrEnabled(newValue);
    await window.electronAPI.setSetting("ocr", {
      ...(config?.ocr as Record<string, unknown> | undefined),
      enabled: newValue,
    });
  };

  const handleOcrLanguageChange = async (lang: string) => {
    setOcrLanguage(lang);
    await window.electronAPI.setSetting("ocr", {
      ...(config?.ocr as Record<string, unknown> | undefined),
      language: lang,
    });
  };

  const handleHotkeyToggle = async () => {
    const newValue = !hotkeyEnabled;
    setHotkeyEnabled(newValue);
    await window.electronAPI.setHotkeyEnabled(newValue);
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

  const handleSaveScreenshotsToggle = async () => {
    const newValue = !saveScreenshots;
    setSaveScreenshots(newValue);
    if (newValue && !screenshotDir) {
      const dir = await window.electronAPI.pickScreenshotDir();
      if (dir) {
        setScreenshotDir(dir);
        await window.electronAPI.setSaveScreenshots(newValue, dir);
      } else {
        setSaveScreenshots(false);
        await window.electronAPI.setSaveScreenshots(false, null);
      }
    } else {
      await window.electronAPI.setSaveScreenshots(newValue, screenshotDir || null);
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
      <h2 className="text-lg font-semibold">Game Capture</h2>

      <div>
        <label htmlFor="game-exe" className="block text-sm font-medium text-gray-300 mb-2">
          Game Executable
        </label>
        <p className="text-xs text-gray-500 mb-2">
          Enter the .exe name of your game (e.g., Neuz.exe, NewWorld.exe)
        </p>
        <div className="flex gap-2">
          <input
            id="game-exe"
            type="text"
            value={gameExe}
            onChange={(e) => setGameExe(e.target.value)}
            placeholder="Neuz.exe"
            className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          />
          <button
            type="button"
            onClick={handleCheckGame}
            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Check
          </button>
          <button
            type="button"
            onClick={handlePreview}
            disabled={previewLoading}
            className="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            title="Capture a preview thumbnail"
          >
            {previewLoading ? "…" : "Preview"}
          </button>
        </div>
        {gameStatus === "running" && (
          <p className="text-green-400 text-sm mt-2">Game detected and running</p>
        )}
        {gameStatus === "not-found" && (
          <p className="text-yellow-400 text-sm mt-2">
            Game not found — screenshot will use fullscreen
          </p>
        )}
        {preview && (
          <img
            src={preview}
            alt="Capture preview"
            className="mt-3 rounded border border-gray-600 max-w-full max-h-40 object-contain"
          />
        )}
      </div>

      <div>
        <label htmlFor="hotkey-input" className="block text-sm font-medium text-gray-300 mb-2">
          Screenshot Hotkey
        </label>
        <p className="text-xs text-gray-500 mb-2">
          Current: <kbd className="bg-gray-700 px-1 rounded">{hotkey}</kbd>
        </p>
        <div className="flex gap-2">
          <input
            id="hotkey-input"
            type="text"
            value={hotkeyInput}
            onChange={(e) => setHotkeyInput(e.target.value)}
            onBlur={handleHotkeyChange}
            placeholder="Ctrl+Shift+G"
            className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          />
          <button
            type="button"
            onClick={handleHotkeyChange}
            disabled={!hotkeyInput.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Save
          </button>
        </div>
      </div>

      <div>
        <label
          htmlFor="hotkey-enabled"
          className="flex items-center justify-between cursor-pointer"
        >
          <span className="text-sm font-medium text-gray-300">Enable Hotkey</span>
          <button
            id="hotkey-enabled"
            type="button"
            onClick={handleHotkeyToggle}
            className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors ${
              hotkeyEnabled ? "bg-blue-600" : "bg-gray-600"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                hotkeyEnabled ? "translate-x-5" : "translate-x-1"
              }`}
            />
          </button>
        </label>
        <p className="text-xs text-gray-500 mt-1">
          Disable to temporarily stop the global hotkey from triggering.
        </p>
      </div>

      <div>
        <label htmlFor="capture-quality" className="block text-sm font-medium text-gray-300 mb-2">
          Capture Quality: {captureQuality}
        </label>
        <p className="text-xs text-gray-400 mb-2">
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
        <label htmlFor="max-image-width" className="block text-sm font-medium text-gray-300 mb-2">
          Max Image Width: {maxImageWidth}px
        </label>
        <p className="text-xs text-gray-400 mb-2">
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
        <label htmlFor="monitor-select" className="block text-sm font-medium text-gray-300 mb-2">
          Monitor
        </label>
        <p className="text-xs text-gray-400 mb-2">
          Select which monitor to capture when the game is not detectable.
        </p>
        {screens.length > 0 ? (
          <select
            id="monitor-select"
            value={monitorIndex}
            onChange={(e) => {
              const v = Number(e.target.value);
              setMonitorIndex(v);
              window.electronAPI.setSetting("monitorIndex", v);
            }}
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          >
            {screens.map((s) => (
              <option key={s.index} value={s.index}>
                {s.name} {s.primary ? "(Primary)" : ""}
              </option>
            ))}
          </select>
        ) : (
          <p className="text-xs text-gray-500">Loading displays...</p>
        )}
      </div>

      <div>
        <label htmlFor="capture-mode" className="block text-sm font-medium text-gray-300 mb-2">
          Capture Mode
        </label>
        <p className="text-xs text-gray-400 mb-2">
          Auto tries window capture first, then GDI+ fallback, then fullscreen. Override to force a
          specific method.
        </p>
        <select
          id="capture-mode"
          value={captureMode}
          onChange={(e) => {
            const v = e.target.value;
            setCaptureMode(v);
            window.electronAPI.setCaptureMode(v as "auto" | "window" | "fullscreen" | "gdi");
          }}
          className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="auto">Auto (window → GDI+ → fullscreen)</option>
          <option value="window">Window Only</option>
          <option value="gdi">GDI+ Fallback Only</option>
          <option value="fullscreen">Fullscreen Only</option>
        </select>
      </div>

      <div>
        <label htmlFor="record-duration" className="block text-sm font-medium text-gray-300 mb-2">
          Recording Duration: {recordDuration}s
        </label>
        <p className="text-xs text-gray-400 mb-2">
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

      <div>
        <label
          htmlFor="save-screenshots"
          className="flex items-center justify-between cursor-pointer"
        >
          <span className="text-sm font-medium text-gray-300">Save Screenshots</span>
          <button
            id="save-screenshots"
            type="button"
            onClick={handleSaveScreenshotsToggle}
            className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors ${
              saveScreenshots ? "bg-blue-600" : "bg-gray-600"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                saveScreenshots ? "translate-x-5" : "translate-x-1"
              }`}
            />
          </button>
        </label>
        <p className="text-xs text-gray-500 mt-1">
          When enabled, captured screenshots are automatically saved to the selected directory with
          timestamped filenames.
        </p>
        {saveScreenshots && (
          <div className="mt-3 space-y-2">
            <div className="flex gap-2 items-center">
              <input
                type="text"
                value={screenshotDir}
                onChange={(e) => setScreenshotDir(e.target.value)}
                placeholder="C:\Screenshots"
                className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500"
              />
              <button
                type="button"
                onClick={handleScreenshotDirChange}
                className="bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded text-sm font-medium transition-colors"
              >
                Browse
              </button>
            </div>
            <p className="text-xs text-gray-500">
              Files will be saved as{" "}
              <code className="bg-gray-700 px-1 rounded">
                gaming-copilot_yyyy-mm-dd-hh-mm-ss.jpg
              </code>
            </p>
          </div>
        )}
      </div>

      <div>
        <label htmlFor="auto-start" className="flex items-center justify-between cursor-pointer">
          <span className="text-sm font-medium text-gray-300">Start with Windows</span>
          <button
            id="auto-start"
            type="button"
            onClick={handleAutoStartToggle}
            className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors ${
              autoStart ? "bg-blue-600" : "bg-gray-600"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                autoStart ? "translate-x-5" : "translate-x-1"
              }`}
            />
          </button>
        </label>
        <p className="text-xs text-gray-500 mt-1">
          Launch Gaming Copilot automatically when Windows starts.
        </p>
      </div>

      <div>
        <label htmlFor="notifications" className="flex items-center justify-between cursor-pointer">
          <span className="text-sm font-medium text-gray-300">System Notifications</span>
          <button
            id="notifications"
            type="button"
            onClick={handleNotificationsToggle}
            className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors ${
              notifications ? "bg-blue-600" : "bg-gray-600"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                notifications ? "translate-x-5" : "translate-x-1"
              }`}
            />
          </button>
        </label>
        <p className="text-xs text-gray-500 mt-1">
          Show a system notification when AI analysis completes.
        </p>
      </div>

      <div>
        <label htmlFor="ocr-enabled" className="flex items-center justify-between cursor-pointer">
          <span className="text-sm font-medium text-gray-300">OCR Text Extraction</span>
          <button
            id="ocr-enabled"
            type="button"
            onClick={handleOcrToggle}
            className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors ${
              ocrEnabled ? "bg-blue-600" : "bg-gray-600"
            }}`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                ocrEnabled ? "translate-x-5" : "translate-x-1"
              }`}
            />
          </button>
        </label>
        <p className="text-xs text-gray-500 mt-1">
          Extract on-screen text via OCR and include it in AI prompts for better context.
        </p>
        {ocrEnabled && (
          <div className="mt-2">
            <label htmlFor="ocr-language" className="block text-sm font-medium text-gray-300 mb-1">
              OCR Language
            </label>
            <select
              id="ocr-language"
              value={ocrLanguage}
              onChange={(e) => handleOcrLanguageChange(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="eng">English</option>
              <option value="eng+osd">English + Orientation</option>
              <option value="universal">Universal (all scripts)</option>
            </select>
          </div>
        )}
      </div>
    </div>
  );
}

function GeneralConfig({
  config,
  theme,
  resolvedTheme,
  onThemeChange,
}: {
  config: Record<string, unknown> | null;
  theme: "dark" | "light" | "system";
  resolvedTheme: "dark" | "light";
  onThemeChange: (theme: "dark" | "light" | "system") => void;
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

  const handleTelemetryToggle = async () => {
    const newValue = !telemetry;
    setTelemetry(newValue);
    await window.electronAPI.setTelemetry(newValue);
  };

  const handleThemeToggle = async () => {
    const nextTheme = theme === "dark" ? "light" : theme === "light" ? "system" : "dark";
    onThemeChange(nextTheme);
    await window.electronAPI.setSetting("theme", nextTheme);
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
      <h2 className="text-lg font-semibold">General</h2>

      <div>
        <label
          htmlFor="telemetry-toggle"
          className="flex items-center justify-between cursor-pointer"
        >
          <div>
            <span className="text-sm font-medium text-gray-300">Anonymous Usage Analytics</span>
            <p className="text-xs text-gray-500 mt-1">
              Send anonymous usage data (hotkey usage, capture frequency, provider success rates) to
              help improve Gaming Copilot. No screenshots or personal data are ever sent.
            </p>
          </div>
          <button
            id="telemetry-toggle"
            type="button"
            onClick={handleTelemetryToggle}
            className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors ${
              telemetry ? "bg-blue-600" : "bg-gray-600"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                telemetry ? "translate-x-5" : "translate-x-1"
              }`}
            />
          </button>
        </label>
      </div>

      <div>
        <label
          htmlFor="theme-toggle"
          className="flex items-center justify-between cursor-pointer"
          data-light={resolvedTheme === "light" ? "" : undefined}
        >
          <div>
            <span className="text-sm font-medium text-gray-300">Color Theme</span>
            <p className="text-xs text-gray-500 mt-1">
              Current: <strong>{theme}</strong>. Cycle through Dark, Light, and System (auto-detect)
              modes for the Settings window. The overlay has its own separate theme settings.
            </p>
          </div>
          <button
            id="theme-toggle"
            type="button"
            onClick={handleThemeToggle}
            className={`relative inline-flex h-6 w-12 items-center rounded-full transition-colors ${
              theme === "dark" ? "bg-gray-700" : theme === "light" ? "bg-blue-600" : "bg-purple-600"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                theme === "dark"
                  ? "translate-x-1"
                  : theme === "light"
                    ? "translate-x-7"
                    : "translate-x-4"
              }`}
            />
          </button>
        </label>
      </div>

      <div>
        <label
          htmlFor="keychain-toggle"
          className="flex items-center justify-between cursor-pointer"
          data-light={resolvedTheme === "light" ? "" : undefined}
        >
          <div>
            <span className="text-sm font-medium text-gray-300">Encrypt API Keys</span>
            <p className="text-xs text-gray-500 mt-1">
              Store API keys in your OS keychain (Windows Credential Manager) instead of plaintext
              config. Toggling off will move keys back to the config file.
            </p>
          </div>
          <button
            id="keychain-toggle"
            type="button"
            onClick={async () => {
              const useKc = !((config?.useKeychain as boolean) ?? true);
              await window.electronAPI.setSetting("useKeychain", useKc);
              window.location.reload();
            }}
            className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors ${
              ((config?.useKeychain as boolean) ?? true) ? "bg-blue-600" : "bg-gray-600"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                ((config?.useKeychain as boolean) ?? true) ? "translate-x-5" : "translate-x-1"
              }`}
            />
          </button>
        </label>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-gray-300 mb-1">Application Updates</h3>
            <p className="text-xs text-gray-500 mt-1">
              Current version: <strong>v{version}</strong> ·{" "}
              {updateStatus === "idle" && "No updates checked"}
              {updateStatus === "checking" && "Checking for updates…"}
              {updateStatus === "available" && `Update ${updateVersion} available!`}
              {updateStatus === "not-available" && "You are up to date"}
              {updateStatus === "downloaded" && `Update ${updateVersion} ready to install!`}
              {updateStatus === "error" && updateMessage}
            </p>
          </div>
          {updateStatus === "available" || updateStatus === "downloaded" ? (
            <button
              type="button"
              onClick={handleInstallUpdate}
              className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Install Update
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCheckUpdates}
              disabled={updateStatus === "checking"}
              className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              data-light={resolvedTheme === "light" ? "" : undefined}
            >
              Check for Updates
            </button>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2" htmlFor="config-export">
          Configuration Backup &amp; Restore
        </label>
        <p className="text-xs text-gray-500 mb-3">
          Export your app settings to a JSON file for backup or migration. API keys are redacted in
          the exported file for security — re-enter them after importing.
        </p>
        <div className="flex flex-col gap-3">
          <button
            id="config-export"
            type="button"
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
            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors self-start"
          >
            Export Config
          </button>

          <div className="flex items-center gap-2">
            <input
              type="file"
              id="config-import"
              accept=".json,application/json"
              onChange={handleImportConfig}
              className="hidden"
            />
            <label
              htmlFor="config-import"
              className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors inline-block"
              data-light={resolvedTheme === "light" ? "" : undefined}
            >
              Choose Config File
            </label>
            <button
              id="config-import-btn"
              type="button"
              onClick={() => document.getElementById("config-import")?.click()}
              className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              data-light={resolvedTheme === "light" ? "" : undefined}
            >
              Import
            </button>
          </div>

          {importStatus?.message && (
            <p className={`text-xs ${importStatus.success ? "text-green-400" : "text-red-400"}`}>
              {importStatus.message}
            </p>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2" htmlFor="export-markdown">
          Export Chat History
        </label>
        <p className="text-xs text-gray-500 mb-3">
          Export all chat messages to a file for saving or sharing.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleExport("markdown")}
            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Export as Markdown
          </button>
          <button
            type="button"
            onClick={() => handleExport("json")}
            className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Export as JSON
          </button>
        </div>
      </div>
    </div>
  );
}
