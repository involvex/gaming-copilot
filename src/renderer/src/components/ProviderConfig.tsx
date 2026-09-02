import { useState } from "react";

export default function ProviderConfig({ config }: { config: Record<string, unknown> | null }) {
  const providers = (config?.providers as Record<string, unknown>) || {};
  const activeProvider = (config?.activeProvider as string) || "gemini";

  const [geminiKey, setGeminiKey] = useState(
    ((providers.gemini as Record<string, unknown>)?.apiKey as string) || "",
  );
  const [geminiModel, setGeminiModel] = useState(
    ((providers.gemini as Record<string, unknown>)?.model as string) || "gemini-2.5-flash",
  );

  const [zenKey, setZenKey] = useState("");
  const [kiloKey, setKiloKey] = useState("");

  const [testing, setTesting] = useState<string | null>(null);

  const handleSaveGemini = async () => {
    await window.electronAPI.setProvider("gemini", {
      apiKey: geminiKey,
      model: geminiModel,
      grounding: true,
    });
  };

  const handleTest = async (name: string) => {
    setTesting(name);
    const ok = await window.electronAPI.testProvider(name);
    setTesting(null);
    alert(ok ? `${name} connected successfully!` : `${name} failed. Check your API key.`);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">AI Providers</h2>

      {/* Gemini */}
      <div className="bg-gray-700/50 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Google Gemini</h3>
          {activeProvider === "gemini" && (
            <span className="text-xs bg-blue-600 px-2 py-1 rounded">Active</span>
          )}
        </div>
        <div>
          <label htmlFor="gemini-key" className="block text-xs text-gray-400 mb-1">
            API Key
          </label>
          <input
            id="gemini-key"
            type="password"
            value={geminiKey}
            onChange={(e) => setGeminiKey(e.target.value)}
            onBlur={handleSaveGemini}
            placeholder="AIza..."
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label htmlFor="gemini-model" className="block text-xs text-gray-400 mb-1">
            Model
          </label>
          <select
            id="gemini-model"
            value={geminiModel}
            onChange={(e) => setGeminiModel(e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          >
            <option value="gemini-2.5-flash">Gemini 2.5 Flash (Recommended)</option>
            <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash Lite</option>
            <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
          </select>
        </div>
        <button
          type="button"
          onClick={() => handleTest("gemini")}
          disabled={!geminiKey || testing === "gemini"}
          className="bg-gray-600 hover:bg-gray-500 disabled:opacity-50 px-3 py-1.5 rounded text-sm transition-colors"
        >
          {testing === "gemini" ? "Testing..." : "Test Connection"}
        </button>
      </div>

      {/* OpenCode Zen */}
      <div className="bg-gray-700/50 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">OpenCode Zen</h3>
          {activeProvider === "zen" && (
            <span className="text-xs bg-blue-600 px-2 py-1 rounded">Active</span>
          )}
        </div>
        <p className="text-xs text-gray-400">Base URL: https://opencode.ai/zen/v1</p>
        <div>
          <label htmlFor="zen-key" className="block text-xs text-gray-400 mb-1">
            API Key
          </label>
          <input
            id="zen-key"
            type="password"
            value={zenKey}
            onChange={(e) => setZenKey(e.target.value)}
            placeholder="Enter your Zen API key"
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          />
        </div>
        <button
          type="button"
          onClick={() => handleTest("zen")}
          disabled={!zenKey || testing === "zen"}
          className="bg-gray-600 hover:bg-gray-500 disabled:opacity-50 px-3 py-1.5 rounded text-sm transition-colors"
        >
          {testing === "zen" ? "Testing..." : "Test Connection"}
        </button>
      </div>

      {/* Kilo Gateway */}
      <div className="bg-gray-700/50 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Kilo Gateway</h3>
          {activeProvider === "kilo" && (
            <span className="text-xs bg-blue-600 px-2 py-1 rounded">Active</span>
          )}
        </div>
        <p className="text-xs text-gray-400">Base URL: https://api.kilo.ai/api/gateway</p>
        <div>
          <label htmlFor="kilo-key" className="block text-xs text-gray-400 mb-1">
            API Key
          </label>
          <input
            id="kilo-key"
            type="password"
            value={kiloKey}
            onChange={(e) => setKiloKey(e.target.value)}
            placeholder="Enter your Kilo API key"
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          />
        </div>
        <button
          type="button"
          onClick={() => handleTest("kilo")}
          disabled={!kiloKey || testing === "kilo"}
          className="bg-gray-600 hover:bg-gray-500 disabled:opacity-50 px-3 py-1.5 rounded text-sm transition-colors"
        >
          {testing === "kilo" ? "Testing..." : "Test Connection"}
        </button>
      </div>
    </div>
  );
}
