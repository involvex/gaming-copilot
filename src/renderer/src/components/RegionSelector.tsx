import { useEffect, useRef, useState } from "react";

interface RegionBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Props {
  onComplete: (region: RegionBounds) => void;
  onCancel: () => void;
}

function getCssColor(varName: string): string {
  if (typeof window === "undefined") return "#3b82f6";
  const val = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return val || "#3b82f6";
}

export default function RegionSelector({ onComplete, onCancel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [start, setStart] = useState<{ x: number; y: number } | null>(null);
  const [current, setCurrent] = useState<{ x: number; y: number } | null>(null);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [accentColor, setAccentColor] = useState("#3b82f6");

  useEffect(() => {
    setAccentColor(getCssColor("--color-accent"));
  }, []);

  useEffect(() => {
    window.electronAPI.captureScreenshot().then((data) => {
      setScreenshot(data);
    });

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onCancel]);

  useEffect(() => {
    if (!screenshot || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      const x = (canvas.width - w) / 2;
      const y = (canvas.height - h) / 2;

      ctx.drawImage(img, x, y, w, h);

      ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    };
    img.src = screenshot;
  }, [screenshot]);

  useEffect(() => {
    if (!start || !current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx || !screenshot) return;

    const img = new Image();
    img.onload = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      const ox = (canvas.width - w) / 2;
      const oy = (canvas.height - h) / 2;

      ctx.drawImage(img, ox, oy, w, h);
      ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const rx = Math.min(start.x, current.x);
      const ry = Math.min(start.y, current.y);
      const rw = Math.abs(current.x - start.x);
      const rh = Math.abs(current.y - start.y);

      ctx.clearRect(rx, ry, rw, rh);
      ctx.drawImage(img, ox, oy, w, h);

      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(rx, ry, rw, rh);
      ctx.setLineDash([]);

      ctx.fillStyle = accentColor;
      ctx.fillRect(rx, ry - 24, 120, 22);
      ctx.fillStyle = "#ffffff";
      ctx.font = "12px sans-serif";
      ctx.fillText(`${Math.round(rw)} \u00d7 ${Math.round(rh)}`, rx + 4, ry - 8);
    };
    img.src = screenshot;
  }, [start, current, screenshot, accentColor]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setStart({ x: e.clientX, y: e.clientY });
    setCurrent({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (start) {
      setCurrent({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => {
    if (start && current) {
      const region = {
        x: Math.min(start.x, current.x),
        y: Math.min(start.y, current.y),
        width: Math.abs(current.x - start.x),
        height: Math.abs(current.y - start.y),
      };
      if (region.width > 10 && region.height > 10) {
        onComplete(region);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 cursor-crosshair">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      />
      <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/80 text-white px-4 py-2 rounded-lg text-sm">
        Drag to select a region · <kbd className="kbd">Esc</kbd> to cancel
      </div>
    </div>
  );
}
