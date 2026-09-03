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
  theme: "dark" | "light" | "game";
  clickThrough: boolean;
}

interface OverlayCustomTheme {
  backgroundColor: string;
  textColor: string;
  borderRadius: number;
  padding: number;
  borderColor: string;
}

export default function Overlay() {
  const [text, setText] = useState("");
  const [visible, setVisible] = useState(false);
  const [opacity, setOpacity] = useState(0);
  const [_streaming, setStreaming] = useState(false);
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
    theme: DEFAULT_OVERLAY.theme,
    clickThrough: DEFAULT_OVERLAY.clickThrough,
  });
  const [customTheme, setCustomTheme] = useState<OverlayCustomTheme>({
    backgroundColor: "#111827",
    textColor: "#ffffff",
    borderRadius: 8,
    padding: 16,
    borderColor: "#374151",
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
        setOverlayConfig((prev) => ({
          duration: Number(overlay.duration) || prev.duration,
          opacity: Number(overlay.opacity) || prev.opacity,
          fontSize: Number(overlay.fontSize) || prev.fontSize,
          position: (overlay.position as OverlayConfig["position"]) || prev.position,
          theme: (overlay.theme as OverlayConfig["theme"]) || prev.theme,
          clickThrough: (overlay.clickThrough as boolean) ?? prev.clickThrough,
        }));
      }
      const theme = config?.overlayCustomTheme as Record<string, unknown> | undefined;
      if (theme) {
        setCustomTheme({
          backgroundColor: (theme.backgroundColor as string) || "#111827",
          textColor: (theme.textColor as string) || "#ffffff",
          borderRadius: Number(theme.borderRadius) || 8,
          padding: Number(theme.padding) || 16,
          borderColor: (theme.borderColor as string) || "#374151",
        });
      }
    });
  }, []);

  useEffect(() => {
    window.electronAPI.onOverlayData(async (data) => {
      const cfg = await window.electronAPI.getConfig();
      const config = cfg as Record<string, unknown>;
      const overlay = config?.overlay as Record<string, unknown> | undefined;
      if (overlay) {
        setOverlayConfig((prev) => ({
          duration: Number(overlay.duration) || prev.duration,
          opacity: Number(overlay.opacity) || prev.opacity,
          fontSize: Number(overlay.fontSize) || prev.fontSize,
          position: (overlay.position as OverlayConfig["position"]) || prev.position,
          theme: (overlay.theme as OverlayConfig["theme"]) || prev.theme,
          clickThrough: (overlay.clickThrough as boolean) ?? prev.clickThrough,
        }));
        const theme = config?.overlayCustomTheme as Record<string, unknown> | undefined;
        if (theme) {
          setCustomTheme({
            backgroundColor: (theme.backgroundColor as string) || "#111827",
            textColor: (theme.textColor as string) || "#ffffff",
            borderRadius: Number(theme.borderRadius) || 8,
            padding: Number(theme.padding) || 16,
            borderColor: (theme.borderColor as string) || "#374151",
          });
        }
      }
      setText(data);
      setVisible(true);
      setStreaming(true);
      setTimeout(() => setOpacity(1), 50);
    });
    return () => {
      window.electronAPI.removeAllListeners("overlay:data");
    };
  }, []);

  useEffect(() => {
    window.electronAPI.onOverlayStreamDone((finalText) => {
      setStreaming(false);
      if (ttsConfig.enabled && finalText && !finalText.startsWith("Error:")) {
        speak(finalText, ttsConfig);
      }
    });
    return () => {
      window.electronAPI.removeAllListeners("overlay:stream-done");
    };
  }, [ttsConfig]);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => {
      setOpacity(0);
      stop();
      setStreaming(false);
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

  if (!visible) return null;

  return (
    <div
      className={getPositionClasses()}
      style={{ opacity, transition: "opacity 300ms ease-in-out" }}
    >
      <div
        className="max-w-xs backdrop-blur-sm shadow-2xl border"
        style={{
          backgroundColor: customTheme.backgroundColor,
          opacity: overlayConfig.opacity,
          fontSize: `${overlayConfig.fontSize}px`,
          borderRadius: `${customTheme.borderRadius}px`,
          padding: `${customTheme.padding}px`,
          borderColor: customTheme.borderColor,
        }}
      >
        <p className="leading-relaxed whitespace-pre-wrap" style={{ color: customTheme.textColor }}>
          {text}
        </p>
      </div>
    </div>
  );
}
