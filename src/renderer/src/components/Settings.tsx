import { useEffect, useState } from "react";

import OverlayStyle from "./OverlayStyle";
import PromptEditor from "./PromptEditor";
import ProviderConfig from "./ProviderConfig";
import TTSConfig from "./TTSConfig";

type Tab = "providers" | "capture" | "overlay" | "tts" | "prompts" | "general";

export default function Settings() {
  const [activeTab, setActiveTab] = useState<Tab>("providers");
  const [config, setConfig] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    window.electronAPI.getConfig().then((cfg) => setConfig(cfg as Record<string, unknown>));
  }, []);

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "providers", label: "AI Providers" },
    { id: "capture", label: "Capture" },
    { id: "overlay", label: "Overlay" },
    { id: "tts", label: "TTS" },
    { id: "prompts", label: "Prompts" },
    { id: "general", label: "General" },
  ];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey) {
        const num = e.key;
        if (num >= "1" && num <= "6") {
          e.preventDefault();
          const idx = Number(num) - 1;
          const tabIds: Tab[] = ["providers", "capture", "overlay", "tts", "prompts", "general"];
          if (idx < tabIds.length) {
            setActiveTab(tabIds[idx]);
          }
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <div className="flex gap-1 mb-6 bg-gray-800 rounded-lg p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-blue-600 text-white"
                : "text-gray-400 hover:text-white hover:bg-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-gray-800 rounded-lg p-6">
        {activeTab === "providers" && <ProviderConfig config={config} />}
        {activeTab === "capture" && <CaptureConfig config={config} />}
        {activeTab === "overlay" && <OverlayStyle config={config} />}
        {activeTab === "tts" && <TTSConfig config={config} />}
        {activeTab === "prompts" && <PromptEditor config={config} />}
        {activeTab === "general" && <GeneralConfig config={config} />}
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

function GeneralConfig({ config }: { config: Record<string, unknown> | null }) {
  const [telemetry, setTelemetry] = useState<boolean>(
    ((config?.telemetry as Record<string, unknown>)?.enabled as boolean) ?? false,
  );

  const handleTelemetryToggle = async () => {
    const newValue = !telemetry;
    setTelemetry(newValue);
    await window.electronAPI.setTelemetry(newValue);
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
