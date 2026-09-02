import { useEffect, useState } from "react";
import { getAvailableVoices } from "../tts";

export default function TTSConfig({ config }: { config: Record<string, unknown> | null }) {
  const tts = (config?.tts as Record<string, unknown>) || {};
  const [enabled, setEnabled] = useState((tts.enabled as boolean) || false);
  const [voice, setVoice] = useState((tts.voice as string) || "");
  const [rate, setRate] = useState((tts.rate as number) || 1);
  const [pitch, setPitch] = useState((tts.pitch as number) || 1);
  const [volume, setVolume] = useState((tts.volume as number) || 0.8);
  const [voices, setVoices] = useState<Array<{ name: string; lang: string }>>([]);

  useEffect(() => {
    const loadVoices = () => setVoices(getAvailableVoices());
    loadVoices();
    window.speechSynthesis?.addEventListener("voiceschanged", loadVoices);
    return () => {
      window.speechSynthesis?.removeEventListener("voiceschanged", loadVoices);
    };
  }, []);

  const persist = (update: Record<string, unknown>) => {
    window.electronAPI.setTTSConfig(update);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Text-to-Speech</h2>

      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium">Enable TTS</p>
          <p className="text-xs text-gray-400">Read AI responses aloud</p>
        </div>
        <button
          type="button"
          onClick={() => {
            const next = !enabled;
            setEnabled(next);
            persist({ enabled: next });
          }}
          className={`w-12 h-6 rounded-full transition-colors ${enabled ? "bg-blue-600" : "bg-gray-600"}`}
        >
          <div
            className={`w-5 h-5 bg-white rounded-full transition-transform ${enabled ? "translate-x-6" : "translate-x-0.5"}`}
          />
        </button>
      </div>

      {enabled && (
        <>
          <div>
            <label htmlFor="tts-voice" className="block text-sm font-medium text-gray-300 mb-2">
              Voice
            </label>
            <select
              id="tts-voice"
              value={voice}
              onChange={(e) => {
                setVoice(e.target.value);
                persist({ voice: e.target.value });
              }}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="">System Default</option>
              {voices.map((v) => (
                <option key={v.name} value={v.name}>
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="tts-rate" className="block text-sm font-medium text-gray-300 mb-2">
              Speed: {rate.toFixed(1)}x
            </label>
            <input
              id="tts-rate"
              type="range"
              min={0.5}
              max={2}
              step={0.1}
              value={rate}
              onChange={(e) => {
                const v = Number(e.target.value);
                setRate(v);
                persist({ rate: v });
              }}
              className="w-full"
            />
          </div>

          <div>
            <label htmlFor="tts-pitch" className="block text-sm font-medium text-gray-300 mb-2">
              Pitch: {pitch.toFixed(1)}
            </label>
            <input
              id="tts-pitch"
              type="range"
              min={0}
              max={2}
              step={0.1}
              value={pitch}
              onChange={(e) => {
                const v = Number(e.target.value);
                setPitch(v);
                persist({ pitch: v });
              }}
              className="w-full"
            />
          </div>

          <div>
            <label htmlFor="tts-volume" className="block text-sm font-medium text-gray-300 mb-2">
              Volume: {(volume * 100).toFixed(0)}%
            </label>
            <input
              id="tts-volume"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(e) => {
                const v = Number(e.target.value);
                setVolume(v);
                persist({ volume: v });
              }}
              className="w-full"
            />
          </div>
        </>
      )}
    </div>
  );
}
