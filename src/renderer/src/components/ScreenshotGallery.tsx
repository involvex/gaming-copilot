import { useEffect, useRef, useState } from "react";
import { Button, Card } from "./ui";

interface ScreenshotEntry {
  filename: string;
  path: string;
  size: number;
  mtime: number;
}

const PAGE_SIZE = 20;

export default function ScreenshotGallery() {
  const [allScreenshots, setAllScreenshots] = useState<ScreenshotEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(PAGE_SIZE);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    shot: ScreenshotEntry;
  } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  const loadScreenshots = async () => {
    setLoading(true);
    setError(null);
    try {
      const entries = await window.electronAPI.listScreenshots();
      setAllScreenshots(entries);
      setPage(PAGE_SIZE);
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

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    const handleScroll = () => setContextMenu(null);
    document.addEventListener("click", handleClick);
    document.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("click", handleClick);
      document.removeEventListener("scroll", handleScroll, true);
    };
  }, []);

  const filtered = allScreenshots.filter((shot) => {
    const q = searchQuery.trim().toLowerCase();
    if (q && !shot.filename.toLowerCase().includes(q)) return false;
    const shotDate = new Date(shot.mtime);
    if (dateFrom) {
      const from = new Date(dateFrom);
      from.setHours(0, 0, 0, 0);
      if (shotDate < from) return false;
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      if (shotDate > to) return false;
    }
    return true;
  });

  const visible = filtered.slice(0, page);
  const hasMore = filtered.length > page;

  const handleDelete = async (filename: string) => {
    if (!window.confirm(`Delete ${filename}?`)) return;
    const ok = await window.electronAPI.deleteScreenshot(filename);
    if (ok) {
      setAllScreenshots((prev) => prev.filter((s) => s.filename !== filename));
      if (preview === filename) setPreview(null);
    }
  };

  const handleOpen = async (filename: string) => {
    await window.electronAPI.openScreenshot(filename);
  };

  const handleContextMenu = (e: React.MouseEvent, shot: ScreenshotEntry) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, shot });
  };

  const handleOpenContainingFolder = async () => {
    if (!contextMenu) return;
    await window.electronAPI.openContainingFolder(contextMenu.shot.filename);
    setContextMenu(null);
  };

  const handleCopyPath = async () => {
    if (!contextMenu) return;
    await window.electronAPI.copyPath(contextMenu.shot.path);
    setContextMenu(null);
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

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          type="text"
          placeholder="Search by filename..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setPage(PAGE_SIZE);
          }}
          className="input flex-1"
        />
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => {
            setDateFrom(e.target.value);
            setPage(PAGE_SIZE);
          }}
          className="input"
          aria-label="From date"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => {
            setDateTo(e.target.value);
            setPage(PAGE_SIZE);
          }}
          className="input"
          aria-label="To date"
        />
        {(searchQuery || dateFrom || dateTo) && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setSearchQuery("");
              setDateFrom("");
              setDateTo("");
              setPage(PAGE_SIZE);
            }}
          >
            Clear
          </Button>
        )}
      </div>

      {filtered.length === 0 && !loading && (
        <p className="text-sm text-[var(--color-text-tertiary)] text-center py-8">
          {allScreenshots.length === 0
            ? 'No screenshots saved yet. Enable "Save Screenshots" in Capture settings and take a capture to build your gallery.'
            : "No screenshots match your filters."}
        </p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {visible.map((shot) => (
          <div
            key={shot.filename}
            className="group relative rounded-lg overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface)]"
          >
            <button
              type="button"
              onContextMenu={(e) => handleContextMenu(e, shot)}
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

      {hasMore && (
        <div className="flex justify-center mt-4">
          <Button variant="secondary" size="sm" onClick={() => setPage((p) => p + PAGE_SIZE)}>
            Load More ({filtered.length - page} remaining)
          </Button>
        </div>
      )}

      {contextMenu && (
        <div
          ref={contextMenuRef}
          role="menu"
          aria-label="Screenshot actions"
          className="fixed bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-xl py-1 z-50 min-w-[200px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setContextMenu(null);
            }
          }}
        >
          <button
            type="button"
            className="w-full text-left px-4 py-2 text-sm hover:bg-[var(--color-surface-hover)] transition-colors"
            onClick={handleOpenContainingFolder}
          >
            Open Containing Folder
          </button>
          <button
            type="button"
            className="w-full text-left px-4 py-2 text-sm hover:bg-[var(--color-surface-hover)] transition-colors"
            onClick={handleCopyPath}
          >
            Copy Path
          </button>
          <div className="border-t border-[var(--color-border)] my-1" />
          <button
            type="button"
            className="w-full text-left px-4 py-2 text-sm hover:bg-[var(--color-surface-hover)] transition-colors"
            onClick={() => handleOpen(contextMenu.shot.filename)}
          >
            Open Image
          </button>
          <button
            type="button"
            className="w-full text-left px-4 py-2 text-sm text-[var(--color-error)] hover:bg-[var(--color-surface-hover)] transition-colors"
            onClick={() => handleDelete(contextMenu.shot.filename)}
          >
            Delete
          </button>
        </div>
      )}

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
