import { useState } from "react";
import { DEFAULT_SYSTEM_PROMPT } from "../../../shared/constants";

export default function PromptEditor({ config }: { config: Record<string, unknown> | null }) {
  const prompts = (config?.prompts as Record<string, string>) || {};
  const [systemPrompt, setSystemPrompt] = useState(prompts.system || DEFAULT_SYSTEM_PROMPT);

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
      </div>
    </div>
  );
}
