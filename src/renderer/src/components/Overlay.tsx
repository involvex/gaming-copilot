import { useEffect, useState } from "react";
import { DEFAULT_OVERLAY } from "../../../shared/constants";
import { speak, stop } from "../tts";

interface TtsConfig {
  enabled: boolean;
  voice: string;
  rate: number;
  pitch: number;
  volume: number;
}

interface OverlayConfig {
  duration: number;
  opacity: number;
  fontSize: number;
  position: "bottom-right" | "bottom-left" | "top-right" | "top-left";
}

export default function Overlay() {
  const [text, setText] = useState("");
  const [visible, setVisible] = useState(false);
  const [opacity, setOpacity] = useState(0);
  const [ttsConfig, setTtsConfig] = useState<TtsConfig>({
    enabled: false,
    voice: "",
    rate: 1,
    pitch: 1,
    volume: 0.8,
  });
  const [overlayConfig, setOverlayConfig] = useState<OverlayConfig>({
    duration: DEFAULT_OVERLAY.duration,
    opacity: DEFAULT_OVERLAY.opacity,
    fontSize: DEFAULT_OVERLAY.fontSize,
    position: DEFAULT_OVERLAY.position,
  });

  useEffect(() => {
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
      const overlay = config?.overlay as Record<string, unknown> | undefined;
      if (overlay) {
        setOverlayConfig({
          duration: (overlay.duration as number) || DEFAULT_OVERLAY.duration,
          opacity: (overlay.opacity as number) || DEFAULT_OVERLAY.opacity,
          fontSize: (overlay.fontSize as number) || DEFAULT_OVERLAY.fontSize,
          position: (overlay.position as OverlayConfig["position"]) || DEFAULT_OVERLAY.position,
        });
      }
    });
  }, []);

  useEffect(() => {
    window.electronAPI.onOverlayData((data) => {
      setText(data);
      setVisible(true);
      setTimeout(() => setOpacity(1), 50);

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
    }, overlayConfig.duration);
    return () => clearTimeout(timer);
  }, [visible, overlayConfig.duration]);

  const getPositionClasses = () => {
    switch (overlayConfig.position) {
      case "top-right":
        return "fixed top-4 right-4";
      case "top-left":
        return "fixed top-4 left-4";
      case "bottom-left":
        return "fixed bottom-4 left-4";
      case "bottom-right":
        return "fixed bottom-4 right-4";
      default:
        return "fixed bottom-4 right-4";
    }
  };

  const getInnerStyle = {
    opacity: overlayConfig.opacity,
    fontSize: `${overlayConfig.fontSize}px`,
  };

  if (!visible) return null;

  return (
    <div
      className={getPositionClasses()}
      style={{ opacity, transition: "opacity 300ms ease-in-out" }}
    >
      <div
        className="max-w-xs bg-black/85 backdrop-blur-sm rounded-lg p-4 shadow-2xl border border-white/10"
        style={getInnerStyle}
      >
        <p className="text-white leading-relaxed whitespace-pre-wrap">{text}</p>
      </div>
    </div>
  );
}
