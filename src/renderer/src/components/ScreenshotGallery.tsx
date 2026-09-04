import { useEffect, useState } from "react";
import { Button, Card } from "./ui";

interface ScreenshotEntry {
  filename: string;
  path: string;
  size: number;
  mtime: number;
}

export default function ScreenshotGallery() {
  const [screenshots, setScreenshots] = useState<ScreenshotEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadScreenshots = async () => {
    setLoading(true);
    setError(null);
    try {
      const entries = await window.electronAPI.listScreenshots();
      setScreenshots(entries);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load screenshots";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadScreenshots();
  }, []);

  const handleDelete = async (filename: string) => {
    if (!window.confirm(`Delete ${filename}?`)) return;
    const ok = await window.electronAPI.deleteScreenshot(filename);
    if (ok) {
      setScreenshots((prev) => prev.filter((s) => s.filename !== filename));
      if (preview === filename) setPreview(null);
    }
  };

  const handleOpen = async (filename: string) => {
    await window.electronAPI.openScreenshot(filename);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (ms: number) => new Date(ms).toLocaleString();

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h2 className="section-heading">Screenshot Gallery</h2>
        <Button variant="secondary" size="sm" onClick={loadScreenshots} disabled={loading}>
          {loading ? "Loading..." : "Refresh"}
        </Button>
      </div>

      {error && <p className="text-sm text-[var(--color-error)] mb-4">{error}</p>}

      {screenshots.length === 0 && !loading && (
        <p className="text-sm text-[var(--color-text-tertiary)] text-center py-8">
          No screenshots saved yet. Enable &quot;Save Screenshots&quot; in Capture settings and take
          a capture to build your gallery.
        </p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {screenshots.map((shot) => (
          <div
            key={shot.filename}
            className="group relative rounded-lg overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface)]"
          >
            <button
              type="button"
              onClick={() => setPreview(shot.path)}
              className="w-full aspect-video cursor-pointer"
            >
              <img
                src={`file:///${shot.path.replace(/\\/g, "/")}`}
                alt={shot.filename}
                className="w-full h-full object-cover group-hover:opacity-80 transition-opacity"
                loading="lazy"
              />
            </button>
            <div className="p-2 space-y-1">
              <p className="text-xs font-medium truncate" title={shot.filename}>
                {shot.filename}
              </p>
              <p className="text-[10px] text-[var(--color-text-tertiary)]">
                {formatSize(shot.size)} · {formatDate(shot.mtime)}
              </p>
              <div className="flex gap-1 pt-1">
                <Button
                  variant="secondary"
                  size="sm"
                  className="flex-1 text-[10px] py-1"
                  onClick={() => handleOpen(shot.filename)}
                >
                  Open
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  className="flex-1 text-[10px] py-1"
                  onClick={() => handleDelete(shot.filename)}
                >
                  Delete
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {preview && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Screenshot preview"
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setPreview(null)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setPreview(null);
            }
          }}
        >
          <button
            type="button"
            className="relative max-w-5xl max-h-[90vh] bg-transparent border-none p-0 cursor-default"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
              }
            }}
          >
            <img
              src={`file:///${preview.replace(/\\/g, "/")}`}
              alt="Preview"
              className="max-w-full max-h-[85vh] rounded-lg shadow-2xl"
            />
            <div className="absolute top-2 right-2 flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  const filename = preview.split(/[\\/]/).pop() || "";
                  handleOpen(filename);
                }}
              >
                Open
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  const filename = preview.split(/[\\/]/).pop() || "";
                  handleDelete(filename);
                  setPreview(null);
                }}
              >
                Delete
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setPreview(null)}>
                Close
              </Button>
            </div>
          </button>
        </div>
      )}
    </Card>
  );
}
