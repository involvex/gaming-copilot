import { useState } from "react";
import type { OverlayCustomTheme } from "../../../shared/constants";
import { OVERLAY_PRESET_THEMES } from "../../../shared/constants";
import { Card, Input, Select, Toggle } from "./ui";

export default function OverlayStyle({ config }: { config: Record<string, unknown> | null }) {
  const overlay = (config?.overlay as Record<string, unknown>) || {};
  const customTheme = (config?.overlayCustomTheme as Record<string, unknown>) || {};

  const [position, setPosition] = useState((overlay.position as string) || "bottom-right");
  const [duration, setDuration] = useState((overlay.duration as number) || 8000);
  const [opacity, setOpacity] = useState((overlay.opacity as number) || 0.9);
  const [fontSize, setFontSize] = useState((overlay.fontSize as number) || 14);
  const [overlayTheme, setOverlayTheme] = useState<string>((overlay.theme as string) || "dark");
  const [clickThrough, setClickThrough] = useState<boolean>(
    (overlay.clickThrough as boolean) || true,
  );
  const [customCSS, setCustomCSS] = useState<string>((overlay.customCSS as string) || "");
  const [backgroundColor, setBackgroundColor] = useState<string>(
    (customTheme.backgroundColor as string) || "#111827",
  );
  const [textColor, setTextColor] = useState<string>(
    (customTheme.textColor as string) || "#ffffff",
  );
  const [borderColor, setBorderColor] = useState<string>(
    (customTheme.borderColor as string) || "#374151",
  );
  const [borderRadius, setBorderRadius] = useState<number>(
    (customTheme.borderRadius as number) || 8,
  );
  const [padding, setPadding] = useState<number>((customTheme.padding as number) || 16);

  const persist = (update: Record<string, unknown>) => {
    window.electronAPI.setOverlayConfig(update);
  };

  const persistTheme = (update: Record<string, unknown>) => {
    window.electronAPI.setSetting("overlayCustomTheme", update);
  };

  const handlePresetChange = (preset: string) => {
    const presetTheme = OVERLAY_PRESET_THEMES[preset];
    if (!presetTheme) return;
    setOverlayTheme(preset);
    setBackgroundColor(presetTheme.backgroundColor);
    setTextColor(presetTheme.textColor);
    setBorderColor(presetTheme.borderColor);
    setBorderRadius(presetTheme.borderRadius);
    setPadding(presetTheme.padding);
    persist({ theme: preset });
    persistTheme({
      backgroundColor: presetTheme.backgroundColor,
      textColor: presetTheme.textColor,
      borderColor: presetTheme.borderColor,
      borderRadius: presetTheme.borderRadius,
      padding: presetTheme.padding,
    });
  };

  const handleThemeChange = (field: keyof OverlayCustomTheme, value: string | number) => {
    const newTheme: OverlayCustomTheme = {
      backgroundColor,
      textColor,
      borderColor,
      borderRadius,
      padding,
      [field]: value,
    } as OverlayCustomTheme;
    if (typeof value === "string") {
      switch (field) {
        case "backgroundColor":
          setBackgroundColor(value);
          break;
        case "textColor":
          setTextColor(value);
          break;
        case "borderColor":
          setBorderColor(value);
          break;
      }
    } else {
      switch (field) {
        case "borderRadius":
          setBorderRadius(value);
          break;
        case "padding":
          setPadding(value);
          break;
      }
    }
    persistTheme(newTheme);
  };

  const handleClickThroughToggle = async (next: boolean) => {
    setClickThrough(next);
    await window.electronAPI.setClickThrough(next);
  };

  return (
    <div className="space-y-6">
      <h2 className="section-heading">Overlay Settings</h2>

      <div>
        <label htmlFor="overlay-position" className="field-label">
          Position
        </label>
        <Select
          id="overlay-position"
          value={position}
          onChange={(e) => {
            setPosition(e.target.value);
            persist({ position: e.target.value });
          }}
        >
          <option value="bottom-right">Bottom Right</option>
          <option value="bottom-left">Bottom Left</option>
          <option value="top-right">Top Right</option>
          <option value="top-left">Top Left</option>
        </Select>
      </div>

      <div>
        <label htmlFor="overlay-duration" className="field-label">
          Auto-dismiss Duration: {(duration / 1000).toFixed(1)}s
        </label>
        <input
          id="overlay-duration"
          type="range"
          min={2000}
          max={30000}
          step={1000}
          value={duration}
          onChange={(e) => {
            const v = Number(e.target.value);
            setDuration(v);
            persist({ duration: v });
          }}
          className="w-full"
        />
      </div>

      <div>
        <label htmlFor="overlay-opacity" className="field-label">
          Opacity: {(opacity * 100).toFixed(0)}%
        </label>
        <input
          id="overlay-opacity"
          type="range"
          min={0.1}
          max={1}
          step={0.05}
          value={opacity}
          onChange={(e) => {
            const v = Number(e.target.value);
            setOpacity(v);
            persist({ opacity: v });
          }}
          className="w-full"
        />
      </div>

      <div>
        <label htmlFor="overlay-font-size" className="field-label">
          Font Size: {fontSize}px
        </label>
        <input
          id="overlay-font-size"
          type="range"
          min={10}
          max={24}
          step={1}
          value={fontSize}
          onChange={(e) => {
            const v = Number(e.target.value);
            setFontSize(v);
            persist({ fontSize: v });
          }}
          className="w-full"
        />
      </div>

      <Toggle
        id="overlay-click-through"
        checked={clickThrough}
        onChange={handleClickThroughToggle}
        label="Click-Through"
        description="When enabled, mouse clicks pass through the overlay to the game underneath."
      />

      <div className="border-t border-divider pt-4">
        <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">
          Theme Presets
        </h3>
        <p className="text-xs text-[var(--color-text-tertiary)] mb-3">
          Select a preset theme for the overlay. You can further customize colors below.
        </p>
        <Select
          id="overlay-theme-preset"
          value={overlayTheme}
          onChange={(e) => handlePresetChange(e.target.value)}
        >
          <option value="dark">Dark</option>
          <option value="light">Light</option>
          <option value="game">Game (Green on Black)</option>
          <option value="hacker">Hacker (Matrix Green)</option>
          <option value="monokai">Monokai</option>
        </Select>
      </div>

      <div className="border-t border-divider pt-4">
        <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">
          Custom Theme Colors
        </h3>

        <div>
          <label
            htmlFor="overlay-bg-color"
            className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1"
          >
            Background Color
          </label>
          <div className="flex gap-2">
            <Input
              id="overlay-bg-color"
              type="color"
              value={backgroundColor}
              onChange={(e) => handleThemeChange("backgroundColor", e.target.value)}
              className="w-12 h-8 p-0 border border-[var(--color-border)] rounded cursor-pointer"
            />
            <Input
              type="text"
              value={backgroundColor}
              onChange={(e) => handleThemeChange("backgroundColor", e.target.value)}
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="overlay-text-color"
            className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1"
          >
            Text Color
          </label>
          <div className="flex gap-2">
            <Input
              id="overlay-text-color"
              type="color"
              value={textColor}
              onChange={(e) => handleThemeChange("textColor", e.target.value)}
              className="w-12 h-8 p-0 border border-[var(--color-border)] rounded cursor-pointer"
            />
            <Input
              type="text"
              value={textColor}
              onChange={(e) => handleThemeChange("textColor", e.target.value)}
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="overlay-border-color"
            className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1"
          >
            Border Color
          </label>
          <div className="flex gap-2">
            <Input
              id="overlay-border-color"
              type="color"
              value={borderColor}
              onChange={(e) => handleThemeChange("borderColor", e.target.value)}
              className="w-12 h-8 p-0 border border-[var(--color-border)] rounded cursor-pointer"
            />
            <Input
              type="text"
              value={borderColor}
              onChange={(e) => handleThemeChange("borderColor", e.target.value)}
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="overlay-border-radius"
            className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1"
          >
            Border Radius: {borderRadius}px
          </label>
          <input
            id="overlay-border-radius"
            type="range"
            min={0}
            max={32}
            step={1}
            value={borderRadius}
            onChange={(e) => handleThemeChange("borderRadius", Number(e.target.value))}
            className="w-full"
          />
        </div>

        <div>
          <label
            htmlFor="overlay-padding"
            className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1"
          >
            Padding: {padding}px
          </label>
          <input
            id="overlay-padding"
            type="range"
            min={4}
            max={48}
            step={2}
            value={padding}
            onChange={(e) => handleThemeChange("padding", Number(e.target.value))}
            className="w-full"
          />
        </div>
      </div>

      <div className="border-t border-divider pt-4">
        <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">Custom CSS</h3>
        <p className="text-xs text-[var(--color-text-tertiary)] mb-2">
          Write custom CSS to style the overlay. Use selectors like{" "}
          <code className="bg-[var(--color-input-bg)] px-1 rounded text-xs">
            .overlay-container
          </code>
          , <code className="bg-[var(--color-input-bg)] px-1 rounded text-xs">.overlay-text</code>,{" "}
          <code className="bg-[var(--color-input-bg)] px-1 rounded text-xs">.overlay-provider</code>
          . Note: use valid CSS —{" "}
          <code className="bg-[var(--color-input-bg)] px-1 rounded text-xs">
            position: absolute
          </code>{" "}
          or{" "}
          <code className="bg-[var(--color-input-bg)] px-1 rounded text-xs">position: fixed</code>
          (not{" "}
          <code className="bg-[var(--color-input-bg)] px-1 rounded text-xs">position: flex</code>
          ).
        </p>
        <textarea
          id="overlay-custom-css"
          value={customCSS}
          onChange={(e) => {
            const v = e.target.value;
            setCustomCSS(v);
            window.electronAPI.setOverlayCSS(v);
          }}
          placeholder={"/* e.g. */\n.overlay-text {\n  font-weight: bold;\n}"}
          className="textarea font-mono"
          rows={8}
        />
      </div>

      <Card className="bg-[var(--color-surface)]/50">
        <p className="text-sm text-[var(--color-text-secondary)]">
          Preview: The overlay will appear in the <strong>{position.replace("-", " ")}</strong>{" "}
          corner with <strong>{(opacity * 100).toFixed(0)}%</strong> opacity and{" "}
          <strong>{fontSize}px</strong> font size. Click-through is{" "}
          <strong>{clickThrough ? "enabled" : "disabled"}</strong>.
        </p>
        <div
          className="mt-2 p-2 text-xs rounded sample-overlay-preview"
          style={{
            backgroundColor,
            color: textColor,
            borderRadius: `${borderRadius}px`,
            padding: `${padding}px`,
            borderColor,
            border: `1px solid ${borderColor}`,
          }}
        >
          Sample overlay text preview
        </div>
      </Card>
    </div>
  );
}
