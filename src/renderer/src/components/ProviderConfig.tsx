import { useEffect, useState } from "react";
import { OPENAI_COMPAT_PRESETS } from "../../../shared/constants";

export default function ProviderConfig({ config }: { config: Record<string, unknown> | null }) {
  const providers = (config?.providers as Record<string, unknown>) || {};
  const activeProvider = (config?.activeProvider as string) || "gemini";

  const openaiCompat = providers.openaiCompat as Record<string, unknown> | undefined;
  const endpoints = (openaiCompat?.endpoints as Array<Record<string, unknown>>) || [];

  const getEndpoint = (name: string) => endpoints.find((e) => e.name === name) || null;

  const geminiProvider = providers.gemini as Record<string, unknown> | undefined;
  const zenEndpoint = getEndpoint("zen");
  const kiloEndpoint = getEndpoint("kilo");

  const [geminiKey, setGeminiKey] = useState((geminiProvider?.apiKey as string) || "");
  const [geminiModel, setGeminiModel] = useState(
    (geminiProvider?.model as string) || "gemini-2.5-flash",
  );

  const [zenKey, setZenKey] = useState((zenEndpoint?.apiKey as string) || "");
  const [zenModel, setZenModel] = useState(
    (zenEndpoint?.model as string) || "gpt-4-vision-preview",
  );

  const [kiloKey, setKiloKey] = useState((kiloEndpoint?.apiKey as string) || "");
  const [kiloModel, setKiloModel] = useState(
    (kiloEndpoint?.model as string) || "gpt-4-vision-preview",
  );

  const [testing, setTesting] = useState<string | null>(null);

  useEffect(() => {
    const geminiProvider_ = providers.gemini as Record<string, unknown> | undefined;
    setGeminiKey((geminiProvider_?.apiKey as string) || "");
    setGeminiModel((geminiProvider_?.model as string) || "gemini-2.5-flash");

    const openaiCompat_ = providers.openaiCompat as Record<string, unknown> | undefined;
    const endpoints_ = (openaiCompat_?.endpoints as Array<Record<string, unknown>>) || [];

    const zenEp = endpoints_.find((e) => e.name === "zen");
    setZenKey((zenEp?.apiKey as string) || "");
    setZenModel((zenEp?.model as string) || "gpt-4-vision-preview");

    const kiloEp = endpoints_.find((e) => e.name === "kilo");
    setKiloKey((kiloEp?.apiKey as string) || "");
    setKiloModel((kiloEp?.model as string) || "gpt-4-vision-preview");
  }, [providers]);

  const handleSaveGemini = async () => {
    await window.electronAPI.setProvider("gemini", {
      apiKey: geminiKey,
      model: geminiModel,
      grounding: true,
    });
  };

  const handleSaveZen = async () => {
    const preset = OPENAI_COMPAT_PRESETS.zen;
    await window.electronAPI.setProvider("zen", {
      apiKey: zenKey,
      baseUrl: preset.baseUrl,
      model: zenModel,
    });
  };

  const handleSaveKilo = async () => {
    const preset = OPENAI_COMPAT_PRESETS.kilo;
    await window.electronAPI.setProvider("kilo", {
      apiKey: kiloKey,
      baseUrl: preset.baseUrl,
      model: kiloModel,
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
            onBlur={handleSaveGemini}
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
            onBlur={handleSaveZen}
            placeholder="Enter your Zen API key"
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label htmlFor="zen-model" className="block text-xs text-gray-400 mb-1">
            Model
          </label>
          <input
            id="zen-model"
            type="text"
            value={zenModel}
            onChange={(e) => setZenModel(e.target.value)}
            onBlur={handleSaveZen}
            placeholder="gpt-4-vision-preview"
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
            onBlur={handleSaveKilo}
            placeholder="Enter your Kilo API key"
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label htmlFor="kilo-model" className="block text-xs text-gray-400 mb-1">
            Model
          </label>
          <input
            id="kilo-model"
            type="text"
            value={kiloModel}
            onChange={(e) => setKiloModel(e.target.value)}
            onBlur={handleSaveKilo}
            placeholder="gpt-4-vision-preview"
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
