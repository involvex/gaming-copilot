import { useState } from "react";

export default function OverlayStyle({ config }: { config: Record<string, unknown> | null }) {
  const overlay = (config?.overlay as Record<string, unknown>) || {};
  const [position, setPosition] = useState((overlay.position as string) || "bottom-right");
  const [duration, setDuration] = useState((overlay.duration as number) || 8000);
  const [opacity, setOpacity] = useState((overlay.opacity as number) || 0.9);
  const [fontSize, setFontSize] = useState((overlay.fontSize as number) || 14);

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
          onChange={(e) => setPosition(e.target.value)}
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
          onChange={(e) => setDuration(Number(e.target.value))}
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
          onChange={(e) => setOpacity(Number(e.target.value))}
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
          onChange={(e) => setFontSize(Number(e.target.value))}
          className="w-full"
        />
      </div>

      <div className="bg-gray-700/50 rounded-lg p-4">
        <p className="text-sm text-gray-400">
          Preview: The overlay will appear in the <strong>{position.replace("-", " ")}</strong>{" "}
          corner with <strong>{(opacity * 100).toFixed(0)}%</strong> opacity and{" "}
          <strong>{fontSize}px</strong> font size.
        </p>
      </div>
    </div>
  );
}
