import { useCallback, useEffect, useRef, useState } from "react";

function drawArrow(
  ctx: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  color: string,
) {
  const headLength = 15;
  const angle = Math.atan2(toY - fromY, toX - fromX);
  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(toX, toY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(
    toX - headLength * Math.cos(angle - Math.PI / 6),
    toY - headLength * Math.sin(angle - Math.PI / 6),
  );
  ctx.lineTo(
    toX - headLength * Math.cos(angle + Math.PI / 6),
    toY - headLength * Math.sin(angle + Math.PI / 6),
  );
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function matchesAccelerator(e: KeyboardEvent, accelerator: string): boolean {
  const parts = accelerator.split("+").map((p) => p.trim());
  const requiredModifiers = new Set<string>();
  let keyName: string | undefined;

  for (const part of parts) {
    const lower = part.toLowerCase();
    if (lower === "control" || lower === "commandorcontrol") {
      requiredModifiers.add("control");
    } else if (lower === "alt") {
      requiredModifiers.add("alt");
    } else if (lower === "shift") {
      requiredModifiers.add("shift");
    } else {
      keyName = part;
    }
  }

  if (!keyName) return false;

  if (requiredModifiers.has("control") && !e.ctrlKey) return false;
  if (requiredModifiers.has("alt") && !e.altKey) return false;
  if (requiredModifiers.has("shift") && !e.shiftKey) return false;

  if (!requiredModifiers.has("control") && e.ctrlKey) return false;
  if (!requiredModifiers.has("alt") && e.altKey) return false;
  if (!requiredModifiers.has("shift") && e.shiftKey) return false;

  let eventKey = e.key;
  if (eventKey === " ") eventKey = "Space";

  return eventKey === keyName || eventKey.toLowerCase() === keyName.toLowerCase();
}

export type AnnotationTool = "rect" | "arrow" | "text";

export interface Annotation {
  id: string;
  type: AnnotationTool;
  x: number;
  y: number;
  width?: number;
  height?: number;
  endX?: number;
  endY?: number;
  text?: string;
  color: string;
}

export interface AnnotationCanvasProps {
  imageUrl: string;
  onAnnotated: (dataUrl: string) => void;
  onCancel: () => void;
}

const COLORS = ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ffffff"];

export default function AnnotationCanvas({
  imageUrl,
  onAnnotated,
  onCancel,
}: AnnotationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState<AnnotationTool>("rect");
  const [color, setColor] = useState("#ef4444");
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const annotationsRef = useRef<Annotation[]>([]);
  useEffect(() => {
    annotationsRef.current = annotations;
  }, [annotations]);
  const [drawing, setDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [imageSize, setImageSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [textInput, setTextInput] = useState<{ x: number; y: number } | null>(null);
  const [textValue, setTextValue] = useState("");
  const [skipShortcut, setSkipShortcut] = useState("Escape");

  useEffect(() => {
    window.electronAPI.getConfig().then((cfg) => {
      const config = cfg as Record<string, unknown>;
      const shortcut = config?.annotationSkipShortcut as string | undefined;
      if (shortcut) {
        setSkipShortcut(shortcut);
      }
    });
  }, []);

  const loadImage = useCallback((url: string) => {
    const img = new Image();
    img.onload = () => {
      setImageSize({ width: img.width, height: img.height });
    };
    img.src = url;
  }, []);

  const redrawAnnotations = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    const anns = annotationsRef.current;
    for (const ann of anns) {
      ctx.strokeStyle = ann.color;
      ctx.fillStyle = ann.color;
      if (ann.type === "rect" && ann.width && ann.height) {
        ctx.strokeRect(ann.x, ann.y, ann.width, ann.height);
      } else if (ann.type === "arrow" && ann.endX !== undefined && ann.endY !== undefined) {
        drawArrow(ctx, ann.x, ann.y, ann.endX, ann.endY, ann.color);
      } else if (ann.type === "text" && ann.text) {
        ctx.font = "bold 16px sans-serif";
        ctx.fillText(ann.text, ann.x, ann.y);
      }
    }
  }, []);

  useEffect(() => {
    loadImage(imageUrl);
  }, [imageUrl, loadImage]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageSize) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = imageSize.width;
    canvas.height = imageSize.height;

    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0);
      redrawAnnotations(ctx);
    };
    img.src = imageUrl;
  }, [imageSize, imageUrl, redrawAnnotations]);

  const getCanvasPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getCanvasPos(e);
    if (tool === "text") {
      setTextInput(pos);
      setTextValue("");
      return;
    }
    setDrawing(true);
    setStartPos(pos);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawing || !startPos) return;
    const pos = getCanvasPos(e);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      redrawAnnotations(ctx);
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      if (tool === "rect") {
        const w = pos.x - startPos.x;
        const h = pos.y - startPos.y;
        ctx.strokeRect(startPos.x, startPos.y, w, h);
      } else if (tool === "arrow") {
        drawArrow(ctx, startPos.x, startPos.y, pos.x, pos.y, color);
      }
    };
    img.src = imageUrl;
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawing || !startPos) return;
    const pos = getCanvasPos(e);
    const id = crypto.randomUUID();
    if (tool === "rect") {
      setAnnotations((prev) => [
        ...prev,
        {
          id,
          type: "rect",
          x: startPos.x,
          y: startPos.y,
          width: pos.x - startPos.x,
          height: pos.y - startPos.y,
          color,
        },
      ]);
    } else if (tool === "arrow") {
      setAnnotations((prev) => [
        ...prev,
        {
          id,
          type: "arrow",
          x: startPos.x,
          y: startPos.y,
          endX: pos.x,
          endY: pos.y,
          color,
        },
      ]);
    }
    setDrawing(false);
    setStartPos(null);
  };

  const handleTextSubmit = () => {
    if (!textInput || !textValue.trim()) return;
    setAnnotations((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        type: "text",
        x: textInput.x,
        y: textInput.y,
        text: textValue.trim(),
        color,
      },
    ]);
    setTextInput(null);
    setTextValue("");
  };

  const handleUndo = () => {
    setAnnotations((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setAnnotations([]);
  };

  const handleDone = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onAnnotated(canvas.toDataURL("image/png"));
  };

  const handleSkip = useCallback(() => {
    onAnnotated(imageUrl);
  }, [imageUrl, onAnnotated]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (matchesAccelerator(e, skipShortcut) && !textInput) {
        const target = e.target as HTMLElement;
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
        e.preventDefault();
        e.stopPropagation();
        handleSkip();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [textInput, handleSkip, skipShortcut]);

  const handleSave = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    try {
      const result = await window.electronAPI.saveAnnotatedScreenshot(dataUrl);
      if (result.success) {
        alert(`Saved: ${result.path}`);
      } else {
        alert(`Save failed: ${result.error}`);
      }
    } catch {
      alert("Save failed");
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-[var(--color-surface)] rounded-lg shadow-xl border border-[var(--color-border)] max-w-5xl w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
          <h3 className="text-lg font-semibold">Annotate Screenshot</h3>
          <div className="flex gap-2">
            <button type="button" onClick={handleUndo} className="btn btn-secondary text-sm">
              Undo
            </button>
            <button type="button" onClick={handleClear} className="btn btn-secondary text-sm">
              Clear
            </button>
            <button type="button" onClick={handleSave} className="btn btn-secondary text-sm">
              Save
            </button>
            <button type="button" onClick={onCancel} className="btn btn-secondary text-sm">
              Cancel
            </button>
            <button type="button" onClick={handleSkip} className="btn btn-secondary text-sm">
              Skip
            </button>
            <button type="button" onClick={handleDone} className="btn btn-primary text-sm">
              Analyze
            </button>
          </div>
        </div>
        <div className="flex gap-4 p-4">
          <div className="flex flex-col gap-2">
            <div className="flex gap-1">
              {(["rect", "arrow", "text"] as AnnotationTool[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTool(t)}
                  className={`px-3 py-1 rounded text-sm border ${
                    tool === t
                      ? "bg-[var(--color-accent)] text-white border-[var(--color-accent)]"
                      : "bg-transparent text-[var(--color-text)] border-[var(--color-border)]"
                  }`}
                >
                  {t === "rect" ? "▢ Rect" : t === "arrow" ? "➜ Arrow" : "T Text"}
                </button>
              ))}
            </div>
            <div className="flex gap-1 flex-wrap">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-6 h-6 rounded border-2 ${color === c ? "border-white" : "border-transparent"}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <div
            ref={containerRef}
            className="flex-1 overflow-auto flex items-center justify-center bg-black/50 rounded"
          >
            {imageSize && (
              <canvas
                ref={canvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                className="max-w-full max-h-[60vh] cursor-crosshair"
                style={{ imageRendering: "auto" }}
              />
            )}
            {textInput && (
              <div
                className="absolute bg-black/80 p-2 rounded"
                style={{
                  left: textInput.x,
                  top: textInput.y,
                }}
              >
                <input
                  type="text"
                  value={textValue}
                  onChange={(e) => setTextValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleTextSubmit();
                    if (e.key === "Escape") setTextInput(null);
                  }}
                  className="bg-transparent text-white text-sm outline-none"
                  placeholder="Type label..."
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
