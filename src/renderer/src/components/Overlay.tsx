import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_OVERLAY,
  OVERLAY_PRESET_THEMES,
  type OverlayCustomTheme,
} from "../../../shared/constants";
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
  theme: "dark" | "light" | "game" | "hacker" | "monokai";
  clickThrough: boolean;
}

export default function Overlay() {
  const [text, setText] = useState("");
  const [visible, setVisible] = useState(false);
  const [opacity, setOpacity] = useState(0);
  const [_streaming, setStreaming] = useState(false);
  const [customCSS, setCustomCSS] = useState<string>("");
  const [providerInfo, setProviderInfo] = useState<{
    displayName: string;
    model: string;
  } | null>(null);
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
    theme: DEFAULT_OVERLAY.theme as OverlayConfig["theme"],
    clickThrough: DEFAULT_OVERLAY.clickThrough,
  });
  const [customTheme, setCustomTheme] = useState<OverlayCustomTheme>({
    backgroundColor: "#111827",
    textColor: "#ffffff",
    borderRadius: 8,
    padding: 16,
    borderColor: "#374151",
  });
  const loadedConfigRef = useRef<Record<string, unknown> | null>(null);

  const applyPresetIfNeeded = useCallback((cfg: Record<string, unknown>) => {
    const overlay = cfg.overlay as Record<string, unknown> | undefined;
    const custom = cfg.overlayCustomTheme as Record<string, unknown> | undefined;

    if (!overlay) return;

    const themeName = (overlay.theme as string) || "dark";
    const preset = OVERLAY_PRESET_THEMES[themeName];

    let theme: OverlayCustomTheme;
    if (custom && Object.keys(custom).length > 0) {
      theme = {
        backgroundColor: (custom.backgroundColor as string) || preset?.backgroundColor || "#111827",
        textColor: (custom.textColor as string) || preset?.textColor || "#ffffff",
        borderRadius: Number(custom.borderRadius) || preset?.borderRadius || 8,
        padding: Number(custom.padding) || preset?.padding || 16,
        borderColor: (custom.borderColor as string) || preset?.borderColor || "#374151",
      };
    } else if (preset) {
      theme = preset;
    } else {
      theme = {
        backgroundColor: "#111827",
        textColor: "#ffffff",
        borderRadius: 8,
        padding: 16,
        borderColor: "#374151",
      };
    }

    setOverlayConfig((prev) => ({
      duration: Number(overlay.duration) || prev.duration,
      opacity: Number(overlay.opacity) || prev.opacity,
      fontSize: Number(overlay.fontSize) || prev.fontSize,
      position: (overlay.position as OverlayConfig["position"]) || prev.position,
      theme: themeName as OverlayConfig["theme"],
      clickThrough: (overlay.clickThrough as boolean) ?? prev.clickThrough,
    }));

    setCustomCSS((overlay.customCSS as string) || "");
    setCustomTheme(theme);
  });

  const applyOverlayConfig = useCallback(
    (config: Record<string, unknown>) => {
      const overlay = config?.overlay as Record<string, unknown> | undefined;
      if (!overlay) return;
      setOverlayConfig((prev) => ({
        duration: Number(overlay.duration) || prev.duration,
        opacity: Number(overlay.opacity) || prev.opacity,
        fontSize: Number(overlay.fontSize) || prev.fontSize,
        position: (overlay.position as OverlayConfig["position"]) || prev.position,
        theme: (overlay.theme as OverlayConfig["theme"]) || prev.theme,
        clickThrough: (overlay.clickThrough as boolean) ?? prev.clickThrough,
      }));
      setCustomCSS((overlay.customCSS as string) || "");
      const customThemeConfig = config?.overlayCustomTheme as Record<string, unknown> | undefined;
      if (customThemeConfig) {
        const themeName = (overlay.theme as string) || "dark";
        const preset = OVERLAY_PRESET_THEMES[themeName];
        setCustomTheme({
          backgroundColor:
            (customThemeConfig.backgroundColor as string) || preset?.backgroundColor || "#111827",
          textColor: (customThemeConfig.textColor as string) || preset?.textColor || "#ffffff",
          borderRadius: Number(customThemeConfig.borderRadius) || preset?.borderRadius || 8,
          padding: Number(customThemeConfig.padding) || preset?.padding || 16,
          borderColor:
            (customThemeConfig.borderColor as string) || preset?.borderColor || "#374151",
        });
      }
    },
    [setOverlayConfig, setCustomCSS, setCustomTheme],
  );

  useEffect(() => {
    window.electronAPI.getConfig().then((cfg) => {
      const config = cfg as Record<string, unknown>;
      loadedConfigRef.current = config;
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
      applyPresetIfNeeded(config);
    });
  }, [applyPresetIfNeeded]);

  useEffect(() => {
    let active = true;
    window.electronAPI.onOverlayData((data) => {
      setText(data);
      setVisible(true);
      setStreaming(true);
      setTimeout(() => setOpacity(1), 50);
      if (!active) return;
      const config = loadedConfigRef.current;
      if (!config) {
        window.electronAPI.getConfig().then((cfg) => {
          if (!active) return;
          loadedConfigRef.current = cfg as Record<string, unknown>;
          applyOverlayConfig(cfg as Record<string, unknown>);
        });
        return;
      }
      applyOverlayConfig(config);
    });
    return () => {
      active = false;
      window.electronAPI.removeAllListeners("overlay:data");
    };
  }, []);

  useEffect(() => {
    window.electronAPI.onOverlayCSS(setCustomCSS);
    return () => {
      window.electronAPI.removeAllListeners("overlay:set-css");
    };
  }, []);

  useEffect(() => {
    window.electronAPI.onOverlayProvider((info) => {
      setProviderInfo(info);
    });
    return () => {
      window.electronAPI.removeAllListeners("overlay:provider");
    };
  }, []);

  useEffect(() => {
    window.electronAPI.onOverlayPosition((pos) => {
      setOverlayConfig((prev) => ({ ...prev, position: pos }));
    });
    return () => {
      window.electronAPI.removeAllListeners("overlay:set-position");
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
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpacity(0);
        stop();
        setStreaming(false);
        setProviderInfo(null);
        setTimeout(() => {
          setVisible(false);
          window.electronAPI.hideOverlay();
        }, 300);
      }
    };
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => {
      setOpacity(0);
      stop();
      setStreaming(false);
      setProviderInfo(null);
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
        return "fixed top-0 right-0";
      case "top-left":
        return "fixed top-0 left-0";
      case "bottom-left":
        return "fixed bottom-0 left-0";
      case "bottom-right":
        return "fixed bottom-0 right-0";
      default:
        return "fixed bottom-0 right-0";
    }
  };

  if (!visible) return null;

  return (
    <div
      className={getPositionClasses()}
      style={{ opacity, transition: "opacity 300ms ease-in-out" }}
    >
      {customCSS && <style>{customCSS}</style>}
      <div
        className="overlay-container max-w-xs sm:max-w-sm md:max-w-md backdrop-blur-sm shadow-2xl border"
        style={{
          backgroundColor: customTheme.backgroundColor,
          opacity: overlayConfig.opacity,
          fontSize: `${overlayConfig.fontSize}px`,
          borderRadius: `${customTheme.borderRadius}px`,
          padding: `${customTheme.padding}px`,
          borderColor: customTheme.borderColor,
        }}
      >
        {providerInfo && (
          <div
            className="overlay-provider mb-2 text-xs font-medium opacity-70"
            style={{ color: customTheme.textColor }}
          >
            via {providerInfo.displayName}
            {providerInfo.model && ` · ${providerInfo.model}`}
          </div>
        )}
        <p
          className="overlay-text leading-relaxed whitespace-pre-wrap"
          style={{ color: customTheme.textColor }}
        >
          {text}
        </p>
      </div>
    </div>
  );
}
