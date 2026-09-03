import { useEffect, useState } from "react";
import { DEFAULT_SYSTEM_PROMPT } from "../../../shared/constants";

export default function PromptEditor({ config }: { config: Record<string, unknown> | null }) {
  const prompts = (config?.prompts as Record<string, unknown>) || {};
  const gameSpecific = (prompts.gameSpecific as Record<string, string>) || {};

  const [systemPrompt, setSystemPrompt] = useState<string>(
    (prompts.system as string) || DEFAULT_SYSTEM_PROMPT,
  );
  const [gamePrompts, setGamePrompts] = useState<Record<string, string>>(gameSpecific);
  const [newGameName, setNewGameName] = useState("");
  const [newGamePrompt, setNewGamePrompt] = useState("");

  useEffect(() => {
    const prompts_ = (config?.prompts as Record<string, unknown>) || {};
    setSystemPrompt(prompts_.system || DEFAULT_SYSTEM_PROMPT);
    setGamePrompts((prompts_.gameSpecific as Record<string, string>) || {});
  }, [config]);

  const handleSavePrompt = async () => {
    await window.electronAPI.setPromptsConfig({ system: systemPrompt });
  };

  const handleAddGamePrompt = async () => {
    if (!newGameName.trim() || !newGamePrompt.trim()) return;
    const updated = { ...gamePrompts, [newGameName.trim()]: newGamePrompt };
    setGamePrompts(updated);
    await window.electronAPI.setPromptsConfig({ gameSpecific: updated });
    setNewGameName("");
    setNewGamePrompt("");
  };

  const handleRemoveGamePrompt = async (name: string) => {
    if (!confirm(`Remove game-specific prompt for "${name}"?`)) return;
    const updated = { ...gamePrompts };
    delete updated[name];
    setGamePrompts(updated);
    await window.electronAPI.setPromptsConfig({ gameSpecific: updated });
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">System Prompt</h2>
      <p className="text-sm text-gray-400">
        This prompt is sent to the AI with every screenshot analysis. Customize it to get responses
        tailored to your needs.
      </p>

      <textarea
        value={systemPrompt}
        onChange={(e) => setSystemPrompt(e.target.value)}
        onBlur={handleSavePrompt}
        rows={12}
        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-sm font-mono focus:outline-none focus:border-blue-500 resize-y"
      />

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setSystemPrompt(DEFAULT_SYSTEM_PROMPT)}
          className="bg-gray-600 hover:bg-gray-500 px-4 py-2 rounded-lg text-sm transition-colors"
        >
          Reset to Default
        </button>
        <button
          type="button"
          onClick={handleSavePrompt}
          className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm transition-colors"
        >
          Save
        </button>
      </div>

      <div className="border-t border-gray-700 pt-6 space-y-4">
        <h3 className="font-medium">Per-Game System Prompts</h3>
        <p className="text-xs text-gray-400">
          Add game-specific instructions that override or extend the base system prompt when
          analyzing screenshots from that game's executable.
        </p>

        <div className="bg-gray-700/50 rounded-lg p-4 space-y-3">
          <div>
            <label htmlFor="game-prompt-name" className="block text-xs text-gray-400 mb-1">
              Game Executable
            </label>
            <input
              id="game-prompt-name"
              type="text"
              value={newGameName}
              onChange={(e) => setNewGameName(e.target.value)}
              placeholder="Neuz.exe"
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label htmlFor="game-prompt-text" className="block text-xs text-gray-400 mb-1">
              Game-Specific Prompt
            </label>
            <textarea
              id="game-prompt-text"
              value={newGamePrompt}
              onChange={(e) => setNewGamePrompt(e.target.value)}
              rows={6}
              placeholder="Focus on character stats, inventory, and quest progress..."
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-y"
            />
          </div>
          <button
            type="button"
            onClick={handleAddGamePrompt}
            disabled={!newGameName.trim() || !newGamePrompt.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-3 py-1.5 rounded text-sm font-medium transition-colors"
          >
            Add Game Prompt
          </button>
        </div>

        {Object.keys(gamePrompts).length > 0 && (
          <div className="space-y-2">
            {Object.entries(gamePrompts).map(([name, prompt]) => (
              <div key={name} className="flex items-center justify-between py-2">
                <div>
                  <span className="font-medium text-sm">{name}</span>
                  <p className="text-xs text-gray-400 truncate max-w-xs">{prompt}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveGamePrompt(name)}
                  className="bg-red-600 hover:bg-red-700 px-2 py-1 rounded text-xs transition-colors"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
