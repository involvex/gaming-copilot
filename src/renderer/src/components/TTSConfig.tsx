import { useEffect, useState } from "react";
import { getAvailableVoices, preview, stop } from "../tts";
import { Button, Select, Toggle } from "./ui";

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
      <h2 className="section-heading">Text-to-Speech</h2>

      <Toggle
        id="tts-enable"
        checked={enabled}
        onChange={(next) => {
          setEnabled(next);
          persist({ enabled: next });
        }}
        label="Enable TTS"
        description="Read AI responses aloud"
      />

      {enabled && (
        <>
          <div>
            <label htmlFor="tts-voice" className="field-label">
              Voice
            </label>
            <Select
              id="tts-voice"
              value={voice}
              onChange={(e) => {
                setVoice(e.target.value);
                persist({ voice: e.target.value });
              }}
            >
              <option value="">System Default</option>
              {voices.map((v) => (
                <option key={v.name} value={v.name}>
                  {v.name} ({v.lang})
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label htmlFor="tts-rate" className="field-label">
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
            <label htmlFor="tts-pitch" className="field-label">
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
            <label htmlFor="tts-volume" className="field-label">
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

          <div>
            <label className="field-label" htmlFor="tts-preview">
              Preview
            </label>
            <p className="field-label-description">
              Hear a sample of the current voice, speed, pitch, and volume settings.
            </p>
            <div className="flex gap-2">
              <Button
                id="tts-preview"
                variant="primary"
                size="md"
                onClick={() =>
                  preview({
                    enabled: true,
                    voice,
                    rate,
                    pitch,
                    volume,
                  })
                }
              >
                Preview Voice
              </Button>
              <Button variant="secondary" size="md" onClick={() => stop()}>
                Stop
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
