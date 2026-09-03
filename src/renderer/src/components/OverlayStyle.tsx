import { useState } from "react";

export default function OverlayStyle({ config }: { config: Record<string, unknown> | null }) {
  const overlay = (config?.overlay as Record<string, unknown>) || {};
  const customTheme = (config?.overlayCustomTheme as Record<string, unknown>) || {};
  const [position, setPosition] = useState((overlay.position as string) || "bottom-right");
  const [duration, setDuration] = useState((overlay.duration as number) || 8000);
  const [opacity, setOpacity] = useState((overlay.opacity as number) || 0.9);
  const [fontSize, setFontSize] = useState((overlay.fontSize as number) || 14);
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

  const handleThemeChange = (field: string, value: string | number) => {
    const newTheme: Record<string, unknown> = {
      backgroundColor,
      textColor,
      borderColor,
      borderRadius,
      padding,
      [field]: value,
    };
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

  const handleClickThroughToggle = async () => {
    const newValue = !clickThrough;
    setClickThrough(newValue);
    await window.electronAPI.setClickThrough(newValue);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Overlay Settings</h2>

      <div>
        <label htmlFor="overlay-position" className="block text-sm font-medium text-gray-300 mb-2">
          Position
        </label>
        <select
          id="overlay-position"
          value={position}
          onChange={(e) => {
            setPosition(e.target.value);
            persist({ position: e.target.value });
          }}
          className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="bottom-right">Bottom Right</option>
          <option value="bottom-left">Bottom Left</option>
          <option value="top-right">Top Right</option>
          <option value="top-left">Top Left</option>
        </select>
      </div>

      <div>
        <label htmlFor="overlay-duration" className="block text-sm font-medium text-gray-300 mb-2">
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
        <label htmlFor="overlay-opacity" className="block text-sm font-medium text-gray-300 mb-2">
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
        <label htmlFor="overlay-font-size" className="block text-sm font-medium text-gray-300 mb-2">
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

      <div>
        <label
          htmlFor="overlay-click-through"
          className="flex items-center justify-between cursor-pointer"
        >
          <span className="text-sm font-medium text-gray-300">Click-Through</span>
          <button
            id="overlay-click-through"
            type="button"
            onClick={handleClickThroughToggle}
            className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors ${
              clickThrough ? "bg-blue-600" : "bg-gray-600"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                clickThrough ? "translate-x-5" : "translate-x-1"
              }`}
            />
          </button>
        </label>
        <p className="text-xs text-gray-500 mt-1">
          When enabled, mouse clicks pass through the overlay to the game underneath.
        </p>
      </div>

      <div className="border-t border-gray-600 pt-4">
        <h3 className="text-sm font-medium text-gray-300 mb-3">Custom Theme</h3>

        <div>
          <label
            htmlFor="overlay-bg-color"
            className="block text-sm font-medium text-gray-300 mb-1"
          >
            Background Color
          </label>
          <div className="flex gap-2">
            <input
              id="overlay-bg-color"
              type="color"
              value={backgroundColor}
              onChange={(e) => handleThemeChange("backgroundColor", e.target.value)}
              className="w-12 h-8 p-0 border border-gray-600 rounded cursor-pointer"
            />
            <input
              type="text"
              value={backgroundColor}
              onChange={(e) => handleThemeChange("backgroundColor", e.target.value)}
              className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="overlay-text-color"
            className="block text-sm font-medium text-gray-300 mb-1"
          >
            Text Color
          </label>
          <div className="flex gap-2">
            <input
              id="overlay-text-color"
              type="color"
              value={textColor}
              onChange={(e) => handleThemeChange("textColor", e.target.value)}
              className="w-12 h-8 p-0 border border-gray-600 rounded cursor-pointer"
            />
            <input
              type="text"
              value={textColor}
              onChange={(e) => handleThemeChange("textColor", e.target.value)}
              className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="overlay-border-color"
            className="block text-sm font-medium text-gray-300 mb-1"
          >
            Border Color
          </label>
          <div className="flex gap-2">
            <input
              id="overlay-border-color"
              type="color"
              value={borderColor}
              onChange={(e) => handleThemeChange("borderColor", e.target.value)}
              className="w-12 h-8 p-0 border border-gray-600 rounded cursor-pointer"
            />
            <input
              type="text"
              value={borderColor}
              onChange={(e) => handleThemeChange("borderColor", e.target.value)}
              className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="overlay-border-radius"
            className="block text-sm font-medium text-gray-300 mb-1"
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
          <label htmlFor="overlay-padding" className="block text-sm font-medium text-gray-300 mb-1">
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

      <div className="border-t border-gray-600 pt-4">
        <h3 className="text-sm font-medium text-gray-300 mb-3">Custom CSS</h3>

        <label
          htmlFor="overlay-custom-css"
          className="block text-sm font-medium text-gray-300 mb-1"
        >
          CSS Editor
        </label>
        <p className="text-xs text-gray-500 mb-2">
          Write custom CSS to style the overlay. Use selectors like{" "}
          <code className="bg-gray-700 px-1 rounded text-xs">.overlay-container</code>,{" "}
          <code className="bg-gray-700 px-1 rounded text-xs">.overlay-text</code>,{" "}
          <code className="bg-gray-700 px-1 rounded text-xs">.overlay-provider</code>. Note: use
          valid CSS — <code className="bg-gray-700 px-1 rounded text-xs">position: absolute</code>{" "}
          or <code className="bg-gray-700 px-1 rounded text-xs">position: fixed</code>
          (not <code className="bg-gray-700 px-1 rounded text-xs">position: flex</code>
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
          className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-blue-500 resize-y"
          rows={8}
        />
      </div>

      <div className="bg-gray-700/50 rounded-lg p-4">
        <p className="text-sm text-gray-400">
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
            borderColor: borderColor,
            border: `1px solid ${borderColor}`,
          }}
        >
          Sample overlay text preview
        </div>
      </div>
    </div>
  );
}
