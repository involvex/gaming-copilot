import { useEffect, useState } from "react";
import { speak, stop } from "../tts";

export default function Overlay() {
  const [text, setText] = useState("");
  const [visible, setVisible] = useState(false);
  const [opacity, setOpacity] = useState(0);
  const [ttsConfig, setTtsConfig] = useState<{
    enabled: boolean;
    voice: string;
    rate: number;
    pitch: number;
    volume: number;
  }>({ enabled: false, voice: "", rate: 1, pitch: 1, volume: 0.8 });

  useEffect(() => {
    // Load TTS config on mount
    window.electronAPI.getConfig().then((cfg) => {
      const config = cfg as Record<string, unknown>;
      const tts = config?.tts as Record<string, unknown> | undefined;
      if (tts) {
        setTtsConfig({
          enabled: (tts.enabled as boolean) || false,
          voice: (tts.voice as string) || "",
          rate: (tts.rate as number) || 1,
          pitch: (tts.pitch as number) || 1,
          volume: (tts.volume as number) || 0.8,
        });
      }
    });
  }, []);

  useEffect(() => {
    window.electronAPI.onOverlayData((data) => {
      setText(data);
      setVisible(true);
      setTimeout(() => setOpacity(1), 50);

      // Speak the text if TTS is enabled
      if (ttsConfig.enabled && data && !data.startsWith("Error:")) {
        speak(data, ttsConfig);
      }
    });
    return () => {
      window.electronAPI.removeAllListeners("overlay:data");
    };
  }, [ttsConfig]);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => {
      setOpacity(0);
      stop();
      setTimeout(() => {
        setVisible(false);
        window.electronAPI.hideOverlay();
      }, 300);
    }, 8000);
    return () => clearTimeout(timer);
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      className="w-full h-full flex items-center justify-center p-4 select-none"
      style={{ opacity, transition: "opacity 300ms ease-in-out" }}
    >
      <div className="w-full max-w-sm bg-black/85 backdrop-blur-sm rounded-lg p-4 shadow-2xl border border-white/10">
        <p className="text-white text-sm leading-relaxed whitespace-pre-wrap">{text}</p>
      </div>
    </div>
  );
}
