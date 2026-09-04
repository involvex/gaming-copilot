import { useEffect, useState } from "react";
import { OPENAI_COMPAT_PRESETS } from "../../../shared/constants";
import { Button, Input, Select } from "./ui";

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
  const [zenModels, setZenModels] = useState<string[]>([]);
  const [zenFetching, setZenFetching] = useState(false);

  const [kiloKey, setKiloKey] = useState((kiloEndpoint?.apiKey as string) || "");
  const [kiloModel, setKiloModel] = useState(
    (kiloEndpoint?.model as string) || "gpt-4-vision-preview",
  );
  const [kiloModels, setKiloModels] = useState<string[]>([]);
  const [kiloFetching, setKiloFetching] = useState(false);

  const [testing, setTesting] = useState<string | null>(null);
  const [customProviders, setCustomProviders] = useState<Array<Record<string, unknown>>>([]);
  const [newCustomName, setNewCustomName] = useState("");
  const [newCustomBaseUrl, setNewCustomBaseUrl] = useState("");
  const [newCustomKey, setNewCustomKey] = useState("");
  const [newCustomModel, setNewCustomModel] = useState("gpt-4-vision-preview");

  const availableProviders: Array<{
    value: string;
    label: string;
    configured: boolean;
  }> = [
    {
      value: "gemini",
      label: "Google Gemini",
      configured: !!geminiProvider?.apiKey,
    },
    { value: "zen", label: "OpenCode Zen", configured: !!zenEndpoint?.apiKey },
    {
      value: "kilo",
      label: "Kilo Gateway",
      configured: !!kiloEndpoint?.apiKey,
    },
    ...customProviders.map((ep) => ({
      value: ep.name as string,
      label: ep.name as string,
      configured: !!(ep.apiKey as string),
    })),
  ];

  useEffect(() => {
    const custom = endpoints.filter((e) => !["zen", "kilo"].includes(e.name as string));
    setCustomProviders(custom);
  }, [endpoints]);

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
      baseUrl: preset?.baseUrl ?? "https://opencode.ai/zen/v1",
      model: zenModel,
    });
  };

  const handleSaveKilo = async () => {
    const preset = OPENAI_COMPAT_PRESETS.kilo;
    await window.electronAPI.setProvider("kilo", {
      apiKey: kiloKey,
      baseUrl: preset?.baseUrl ?? "https://api.kilo.ai/api/gateway",
      model: kiloModel,
    });
  };

  const handleFetchModels = async (
    name: string,
    setModels: (models: string[]) => void,
    setFetching: (b: boolean) => void,
  ) => {
    setFetching(true);
    try {
      const models = await window.electronAPI.fetchModels(name);
      setModels(models);
    } catch (error) {
      alert(`Failed to fetch models: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setFetching(false);
    }
  };

  const handleTest = async (name: string) => {
    setTesting(name);
    const ok = await window.electronAPI.testProvider(name);
    setTesting(null);
    alert(ok ? `${name} connected successfully!` : `${name} failed. Check your API key.`);
  };

  const handleActiveProviderChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const name = e.target.value;
    await window.electronAPI.setActiveProvider(name);
  };

  const handleAddCustomProvider = async () => {
    if (!newCustomName.trim() || !newCustomBaseUrl.trim()) return;
    await window.electronAPI.setProvider(newCustomName.trim(), {
      apiKey: newCustomKey,
      baseUrl: newCustomBaseUrl.trim(),
      model: newCustomModel,
    });
    setNewCustomName("");
    setNewCustomBaseUrl("");
    setNewCustomKey("");
    setNewCustomModel("gpt-4-vision-preview");
  };

  const handleRemoveCustomProvider = (name: string) => {
    if (!confirm(`Remove custom provider "${name}"?`)) return;
    window.electronAPI.removeEndpoint(name);
  };

  return (
    <div className="space-y-6">
      <h2 className="section-heading">AI Providers</h2>

      <div>
        <label htmlFor="active-provider" className="field-label">
          Primary Provider
        </label>
        <p className="field-label-description">
          The first provider tried when analyzing. Falls back to other configured providers on
          failure.
        </p>
        <Select id="active-provider" value={activeProvider} onChange={handleActiveProviderChange}>
          {availableProviders
            .filter((p) => p.configured)
            .map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
        </Select>
      </div>

      {/* Gemini */}
      <div className="bg-[var(--color-surface)]/50 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Google Gemini</h3>
          {activeProvider === "gemini" && (
            <span className="text-xs bg-[var(--color-accent)] px-2 py-1 rounded">Active</span>
          )}
        </div>
        <div>
          <label
            htmlFor="gemini-key"
            className="block text-xs text-[var(--color-text-tertiary)] mb-1"
          >
            API Key
          </label>
          <Input
            id="gemini-key"
            type="password"
            value={geminiKey}
            onChange={(e) => setGeminiKey(e.target.value)}
            onBlur={handleSaveGemini}
            placeholder="AIza..."
          />
        </div>
        <div>
          <label
            htmlFor="gemini-model"
            className="block text-xs text-[var(--color-text-tertiary)] mb-1"
          >
            Model
          </label>
          <Select
            id="gemini-model"
            value={geminiModel}
            onChange={(e) => setGeminiModel(e.target.value)}
            onBlur={handleSaveGemini}
          >
            <option value="gemini-2.5-flash">Gemini 2.5 Flash (Recommended)</option>
            <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash Lite</option>
            <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
          </Select>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => handleTest("gemini")}
          disabled={!geminiKey || testing === "gemini"}
        >
          {testing === "gemini" ? "Testing..." : "Test Connection"}
        </Button>
      </div>

      {/* OpenCode Zen */}
      <div className="bg-[var(--color-surface)]/50 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">OpenCode Zen</h3>
          {activeProvider === "zen" && (
            <span className="text-xs bg-[var(--color-accent)] px-2 py-1 rounded">Active</span>
          )}
        </div>
        <p className="text-xs text-[var(--color-text-tertiary)]">
          Base URL: https://opencode.ai/zen/v1
        </p>
        <div>
          <label htmlFor="zen-key" className="block text-xs text-[var(--color-text-tertiary)] mb-1">
            API Key
          </label>
          <Input
            id="zen-key"
            type="password"
            value={zenKey}
            onChange={(e) => setZenKey(e.target.value)}
            onBlur={handleSaveZen}
            placeholder="Enter your Zen API key"
          />
        </div>
        <div>
          <label
            htmlFor="zen-model"
            className="block text-xs text-[var(--color-text-tertiary)] mb-1"
          >
            Model
          </label>
          <div className="flex gap-2">
            <Input
              id="zen-model"
              type="text"
              list="zen-models"
              value={zenModel}
              onChange={(e) => setZenModel(e.target.value)}
              onBlur={handleSaveZen}
              placeholder="gpt-4-vision-preview"
              className="flex-1"
            />
            <datalist id="zen-models">
              {zenModels.map((model) => (
                <option key={model} value={model} />
              ))}
            </datalist>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleFetchModels("zen", setZenModels, setZenFetching)}
              disabled={!zenKey || zenFetching}
            >
              {zenFetching ? "..." : "Fetch"}
            </Button>
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => handleTest("zen")}
          disabled={!zenKey || testing === "zen"}
        >
          {testing === "zen" ? "Testing..." : "Test Connection"}
        </Button>
      </div>

      {/* Kilo Gateway */}
      <div className="bg-[var(--color-surface)]/50 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Kilo Gateway</h3>
          {activeProvider === "kilo" && (
            <span className="text-xs bg-[var(--color-accent)] px-2 py-1 rounded">Active</span>
          )}
        </div>
        <p className="text-xs text-[var(--color-text-tertiary)]">
          Base URL: https://api.kilo.ai/api/gateway
        </p>
        <div>
          <label
            htmlFor="kilo-key"
            className="block text-xs text-[var(--color-text-tertiary)] mb-1"
          >
            API Key
          </label>
          <Input
            id="kilo-key"
            type="password"
            value={kiloKey}
            onChange={(e) => setKiloKey(e.target.value)}
            onBlur={handleSaveKilo}
            placeholder="Enter your Kilo API key"
          />
        </div>
        <div>
          <label
            htmlFor="kilo-model"
            className="block text-xs text-[var(--color-text-tertiary)] mb-1"
          >
            Model
          </label>
          <div className="flex gap-2">
            <Input
              id="kilo-model"
              type="text"
              list="kilo-models"
              value={kiloModel}
              onChange={(e) => setKiloModel(e.target.value)}
              onBlur={handleSaveKilo}
              placeholder="gpt-4-vision-preview"
              className="flex-1"
            />
            <datalist id="kilo-models">
              {kiloModels.map((model) => (
                <option key={model} value={model} />
              ))}
            </datalist>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleFetchModels("kilo", setKiloModels, setKiloFetching)}
              disabled={!kiloKey || kiloFetching}
            >
              {kiloFetching ? "..." : "Fetch"}
            </Button>
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => handleTest("kilo")}
          disabled={!kiloKey || testing === "kilo"}
        >
          {testing === "kilo" ? "Testing..." : "Test Connection"}
        </Button>
      </div>

      {/* Custom OpenAI-Compatible Provider */}
      <div className="bg-[var(--color-surface)]/50 rounded-lg p-4 space-y-3">
        <h3 className="font-medium">Custom OpenAI-Compatible Provider</h3>
        <p className="text-xs text-[var(--color-text-tertiary)]">
          Add your own OpenAI-compatible API endpoint (e.g., Ollama, LMStudio, local proxies).
        </p>
        <div>
          <label
            htmlFor="custom-name"
            className="block text-xs text-[var(--color-text-tertiary)] mb-1"
          >
            Name
          </label>
          <Input
            id="custom-name"
            type="text"
            value={newCustomName}
            onChange={(e) => setNewCustomName(e.target.value)}
            placeholder="ollama"
          />
        </div>
        <div>
          <label
            htmlFor="custom-base-url"
            className="block text-xs text-[var(--color-text-tertiary)] mb-1"
          >
            Base URL
          </label>
          <Input
            id="custom-base-url"
            type="url"
            value={newCustomBaseUrl}
            onChange={(e) => setNewCustomBaseUrl(e.target.value)}
            placeholder="http://localhost:11434/v1"
          />
        </div>
        <div>
          <label
            htmlFor="custom-key"
            className="block text-xs text-[var(--color-text-tertiary)] mb-1"
          >
            API Key
          </label>
          <Input
            id="custom-key"
            type="password"
            value={newCustomKey}
            onChange={(e) => setNewCustomKey(e.target.value)}
            placeholder="Leave empty if not required"
          />
        </div>
        <div>
          <label
            htmlFor="custom-model"
            className="block text-xs text-[var(--color-text-tertiary)] mb-1"
          >
            Model
          </label>
          <Input
            id="custom-model"
            type="text"
            value={newCustomModel}
            onChange={(e) => setNewCustomModel(e.target.value)}
            placeholder="gpt-4-vision-preview"
          />
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={handleAddCustomProvider}
          disabled={!newCustomName.trim() || !newCustomBaseUrl.trim()}
        >
          Add Provider
        </Button>
      </div>

      {/* List of custom providers */}
      {customProviders.length > 0 && (
        <div className="bg-[var(--color-surface)]/50 rounded-lg p-4 space-y-3">
          <h3 className="font-medium">Configured Custom Providers</h3>
          {customProviders.map((ep) => {
            const name = ep.name as string;
            return (
              <div key={name} className="flex items-center justify-between py-2">
                <div>
                  <span className="font-medium text-sm">{name}</span>
                  <p className="text-xs text-[var(--color-text-tertiary)]">
                    {ep.baseUrl as string}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleTest(name)}
                    disabled={testing === name}
                  >
                    {testing === name ? "..." : "Test"}
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleRemoveCustomProvider(name)}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div>
        <Button
          variant="secondary"
          size="sm"
          onClick={async () => {
            await window.electronAPI.clearCache();
          }}
        >
          Clear Response Cache
        </Button>
        <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
          Cached AI responses expire after 60 seconds.
        </p>
      </div>
    </div>
  );
}
