import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Card } from "./ui";

interface ScreenshotEntry {
  filename: string;
  path: string;
  size: number;
  mtime: number;
}

type SortField = "name" | "date" | "size";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 20;

export default function ScreenshotGallery() {
  const [allScreenshots, setAllScreenshots] = useState<ScreenshotEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(PAGE_SIZE);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    shot: ScreenshotEntry;
  } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const panStart = useRef({ x: 0, y: 0 });
  const previewContainerRef = useRef<HTMLDivElement>(null);

  const loadScreenshots = async () => {
    setLoading(true);
    setError(null);
    try {
      const entries = await window.electronAPI.listScreenshots();
      setAllScreenshots(entries);
      setPage(PAGE_SIZE);
      setSelection(new Set());
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

  const resetPage = useCallback(() => setPage(PAGE_SIZE), []);
  const resetFilters = useCallback(() => {
    setSearchQuery("");
    setDateFrom("");
    setDateTo("");
    setSortField("date");
    setSortDir("desc");
    resetPage();
  }, [resetPage]);

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

  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    if (sortField === "name") {
      cmp = a.filename.localeCompare(b.filename);
    } else if (sortField === "date") {
      cmp = a.mtime - b.mtime;
    } else if (sortField === "size") {
      cmp = a.size - b.size;
    }
    return sortDir === "asc" ? cmp : -cmp;
  });

  const visible = sorted.slice(0, page);
  const hasMore = sorted.length > page;

  const handleDelete = async (filename: string) => {
    if (!window.confirm(`Delete ${filename}?`)) return;
    const ok = await window.electronAPI.deleteScreenshot(filename);
    if (ok) {
      setAllScreenshots((prev) => prev.filter((s) => s.filename !== filename));
      setSelection((prev) => {
        const next = new Set(prev);
        next.delete(filename);
        return next;
      });
      if (preview === filename) setPreview(null);
    }
  };

  const handleBatchDelete = async () => {
    if (selection.size === 0) return;
    if (!window.confirm(`Delete ${selection.size} selected screenshot(s)?`)) return;
    const toDelete = Array.from(selection);
    let deleted = 0;
    for (const filename of toDelete) {
      const ok = await window.electronAPI.deleteScreenshot(filename);
      if (ok) deleted++;
    }
    if (deleted > 0) {
      setAllScreenshots((prev) => prev.filter((s) => !selection.has(s.filename)));
      setSelection(new Set());
      setSelectMode(false);
    }
  };

  const toggleSelection = (filename: string) => {
    setSelection((prev) => {
      const next = new Set(prev);
      if (next.has(filename)) {
        next.delete(filename);
      } else {
        next.add(filename);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selection.size === visible.length) {
      setSelection(new Set());
    } else {
      setSelection(new Set(visible.map((s) => s.filename)));
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

  const resetZoom = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom((z) => Math.min(5, Math.max(0.5, z + delta)));
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      setDragging(true);
      dragStart.current = { x: e.clientX, y: e.clientY };
      panStart.current = { ...pan };
    },
    [pan],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragging) return;
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      setPan({
        x: panStart.current.x + dx,
        y: panStart.current.y + dy,
      });
    },
    [dragging],
  );

  const handleMouseUp = useCallback(() => {
    setDragging(false);
  }, []);

  useEffect(() => {
    if (!preview) {
      resetZoom();
    }
  }, [preview, resetZoom]);

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h2 className="section-heading">Screenshot Gallery</h2>
        <div className="flex gap-2">
          {selectMode && selection.size > 0 && (
            <Button variant="danger" size="sm" onClick={handleBatchDelete}>
              Delete Selected ({selection.size})
            </Button>
          )}
          <Button
            variant={selectMode ? "primary" : "secondary"}
            size="sm"
            onClick={() => {
              setSelectMode(!selectMode);
              setSelection(new Set());
            }}
          >
            {selectMode ? "Cancel Select" : "Select"}
          </Button>
          <Button variant="secondary" size="sm" onClick={loadScreenshots} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-[var(--color-error)] mb-4">{error}</p>}

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          type="text"
          placeholder="Search by filename..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            resetPage();
          }}
          className="input flex-1"
        />
        <select
          value={`${sortField}:${sortDir}`}
          onChange={(e) => {
            const [field, dir] = e.target.value.split(":") as [SortField, SortDir];
            setSortField(field);
            setSortDir(dir);
            resetPage();
          }}
          className="input"
          aria-label="Sort by"
        >
          <option value="date:desc">Newest First</option>
          <option value="date:asc">Oldest First</option>
          <option value="name:asc">Name (A-Z)</option>
          <option value="name:desc">Name (Z-A)</option>
          <option value="size:asc">Size (Smallest)</option>
          <option value="size:desc">Size (Largest)</option>
        </select>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => {
            setDateFrom(e.target.value);
            resetPage();
          }}
          className="input"
          aria-label="From date"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => {
            setDateTo(e.target.value);
            resetPage();
          }}
          className="input"
          aria-label="To date"
        />
        {(searchQuery || dateFrom || dateTo || sortField !== "date" || sortDir !== "desc") && (
          <Button variant="secondary" size="sm" onClick={resetFilters}>
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

      {selectMode && visible.length > 0 && (
        <div className="mb-3 flex items-center gap-2">
          <input
            type="checkbox"
            id="select-all"
            checked={selection.size === visible.length && visible.length > 0}
            onChange={toggleSelectAll}
            className="rounded"
          />
          <label htmlFor="select-all" className="text-sm">
            Select all ({visible.length})
          </label>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {visible.map((shot) => {
          const isSelected = selection.has(shot.filename);
          return (
            <div
              key={shot.filename}
              className={`group relative rounded-lg overflow-hidden border ${
                isSelected
                  ? "border-[var(--color-accent)] ring-2 ring-[var(--color-accent)]/50"
                  : "border-[var(--color-border)]"
              } bg-[var(--color-surface)]`}
            >
              <button
                type="button"
                onContextMenu={(e) => handleContextMenu(e, shot)}
                onClick={() => {
                  if (selectMode) {
                    toggleSelection(shot.filename);
                  } else {
                    setPreview(shot.path);
                  }
                }}
                className="w-full aspect-video cursor-pointer"
              >
                <img
                  src={`file:///${shot.path.replace(/\\/g, "/")}`}
                  alt={shot.filename}
                  className="w-full h-full object-cover group-hover:opacity-80 transition-opacity"
                  loading="lazy"
                />
              </button>
              {selectMode && (
                <div
                  className="absolute top-2 left-2 w-5 h-5 rounded border-2 flex items-center justify-center"
                  style={{
                    backgroundColor: isSelected ? "var(--color-accent)" : "rgba(0,0,0,0.5)",
                    borderColor: isSelected ? "var(--color-accent)" : "rgba(255,255,255,0.3)",
                  }}
                >
                  {isSelected && (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="white"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
              )}
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
          );
        })}
      </div>

      {hasMore && (
        <div className="flex justify-center mt-4">
          <Button variant="secondary" size="sm" onClick={() => setPage((p) => p + PAGE_SIZE)}>
            Load More ({sorted.length - page} remaining)
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
          <div
            ref={previewContainerRef}
            role="application"
            aria-label="Image preview. Use scroll to zoom, drag to pan, Escape to close."
            className="relative max-w-full max-h-[90vh] overflow-hidden"
            style={{ cursor: dragging ? "grabbing" : "grab" }}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setPreview(null);
              } else if (e.key === "+" || e.key === "=") {
                e.preventDefault();
                setZoom((z) => Math.min(5, z + 0.25));
              } else if (e.key === "-") {
                e.preventDefault();
                setZoom((z) => Math.max(0.5, z - 0.25));
              } else if (e.key === "0") {
                e.preventDefault();
                resetZoom();
              }
            }}
          >
            <img
              src={`file:///${preview.replace(/\\/g, "/")}`}
              alt="Preview"
              className="max-w-full max-h-[85vh] object-contain select-none pointer-events-none"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transition: dragging ? "none" : "transform 150ms ease-out",
              }}
              draggable={false}
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
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/60 rounded-full px-3 py-1.5">
              <button
                type="button"
                className="text-white text-xs px-2 py-1 hover:bg-white/20 rounded-full transition-colors"
                onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
              >
                -
              </button>
              <span className="text-white text-xs font-mono min-w-[3rem] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                className="text-white text-xs px-2 py-1 hover:bg-white/20 rounded-full transition-colors"
                onClick={() => setZoom((z) => Math.min(5, z + 0.25))}
              >
                +
              </button>
              <button
                type="button"
                className="text-white text-xs px-2 py-1 hover:bg-white/20 rounded-full transition-colors"
                onClick={resetZoom}
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
