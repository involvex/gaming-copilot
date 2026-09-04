import { useEffect, useState } from "react";
import { DEFAULT_SYSTEM_PROMPT } from "../../../shared/constants";
import { Button, Input, Textarea } from "./ui";

export default function PromptEditor({ config }: { config: Record<string, unknown> | null }) {
  const prompts = (config?.prompts as Record<string, unknown>) || {};
  const gameSpecificRaw = (prompts.gameSpecific as Record<string, string> | undefined) || {};

  const [systemPrompt, setSystemPrompt] = useState<string>(
    (prompts.system as string) || DEFAULT_SYSTEM_PROMPT,
  );
  const [gamePrompts, setGamePrompts] = useState<Record<string, string>>(gameSpecificRaw);
  const [newGameName, setNewGameName] = useState("");
  const [newGamePrompt, setNewGamePrompt] = useState("");

  useEffect(() => {
    const prompts_ = (config?.prompts as Record<string, unknown>) || {};
    setSystemPrompt((prompts_.system as string) || DEFAULT_SYSTEM_PROMPT);
    setGamePrompts((prompts_.gameSpecific as Record<string, string>) || {});
  }, [config]);

  const handleSavePrompt = async () => {
    await window.electronAPI.setPromptsConfig({ system: systemPrompt });
  };

  const handleAddGamePrompt = async () => {
    if (!newGameName.trim() || !newGamePrompt.trim()) return;
    const updated: Record<string, string> = {
      ...gamePrompts,
      [newGameName.trim()]: newGamePrompt,
    };
    setGamePrompts(updated);
    await window.electronAPI.setPromptsConfig({ gameSpecific: updated });
    setNewGameName("");
    setNewGamePrompt("");
  };

  const handleRemoveGamePrompt = async (name: string) => {
    if (!confirm(`Remove game-specific prompt for "${name}"?`)) return;
    const updated: Record<string, string> = { ...gamePrompts };
    delete updated[name];
    setGamePrompts(updated);
    await window.electronAPI.setPromptsConfig({ gameSpecific: updated });
  };

  return (
    <div className="space-y-6">
      <h2 className="section-heading">System Prompt</h2>
      <p className="text-sm text-[var(--color-text-secondary)]">
        This prompt is sent to the AI with every screenshot analysis. Customize it to get responses
        tailored to your needs.
      </p>

      <Textarea
        value={systemPrompt}
        onChange={(e) => setSystemPrompt(e.target.value)}
        onBlur={handleSavePrompt}
        rows={12}
        className="font-mono"
      />

      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="md"
          onClick={() => setSystemPrompt(DEFAULT_SYSTEM_PROMPT)}
        >
          Reset to Default
        </Button>
        <Button variant="primary" size="md" onClick={handleSavePrompt}>
          Save
        </Button>
      </div>

      <div className="border-t border-divider pt-6 space-y-4">
        <h3 className="font-medium">Per-Game System Prompts</h3>
        <p className="text-xs text-[var(--color-text-secondary)]">
          Add game-specific instructions that override or extend the base system prompt when
          analyzing screenshots from that game's executable.
        </p>

        <div className="bg-[var(--color-surface)]/50 rounded-lg p-4 space-y-3">
          <div>
            <label
              htmlFor="game-prompt-name"
              className="block text-xs text-[var(--color-text-tertiary)] mb-1"
            >
              Game Executable
            </label>
            <Input
              id="game-prompt-name"
              type="text"
              value={newGameName}
              onChange={(e) => setNewGameName(e.target.value)}
              placeholder="Neuz.exe"
            />
          </div>
          <div>
            <label
              htmlFor="game-prompt-text"
              className="block text-xs text-[var(--color-text-tertiary)] mb-1"
            >
              Game-Specific Prompt
            </label>
            <Textarea
              id="game-prompt-text"
              value={newGamePrompt}
              onChange={(e) => setNewGamePrompt(e.target.value)}
              rows={6}
              placeholder="Focus on character stats, inventory, and quest progress..."
            />
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={handleAddGamePrompt}
            disabled={!newGameName.trim() || !newGamePrompt.trim()}
          >
            Add Game Prompt
          </Button>
        </div>

        {Object.keys(gamePrompts).length > 0 && (
          <div className="space-y-2">
            {Object.entries(gamePrompts).map(([name, prompt]) => (
              <div key={name} className="flex items-center justify-between py-2">
                <div>
                  <span className="font-medium text-sm">{name}</span>
                  <p className="text-xs text-[var(--color-text-tertiary)] truncate max-w-xs">
                    {prompt}
                  </p>
                </div>
                <Button variant="danger" size="sm" onClick={() => handleRemoveGamePrompt(name)}>
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
