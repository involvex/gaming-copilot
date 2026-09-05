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

  const [tags, setTags] = useState<Record<string, string[]>>({});
  const [tagInput, setTagInput] = useState<Record<string, string>>({});
  const [compareWith, setCompareWith] = useState<string | null>(null);
  const [compareSliderPos, setCompareSliderPos] = useState(50);
  const [exporting, setExporting] = useState(false);
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [renameMode, setRenameMode] = useState(false);
  const [renamePattern, setRenamePattern] = useState<"prefix" | "suffix" | "replace">("prefix");
  const [renameValue, setRenameValue] = useState("");
  const [renameFind, setRenameFind] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<{
    filename: string;
    path: string;
    sizeBytes: number;
    width: number;
    height: number;
    createdAt: number;
    modifiedAt: number;
    format: string;
  } | null>(null);
  const [loadingMetadata, setLoadingMetadata] = useState(false);
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const renameDialogRef = useRef<HTMLDivElement>(null);
  const renameFirstInputRef = useRef<HTMLInputElement>(null);

  const loadScreenshots = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const entries = await window.electronAPI.listScreenshots();
      setAllScreenshots(entries);
      setPage(PAGE_SIZE);
      setSelection(new Set());
      const loadedTags = await window.electronAPI.getTags();
      setTags(loadedTags);
      const loadedFavorites = await window.electronAPI.getFavorites();
      setFavorites(loadedFavorites);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load screenshots";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadScreenshots();
  }, [loadScreenshots]);

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
    setShowFavoritesOnly(false);
    resetPage();
  }, [resetPage]);

  useEffect(() => {
    resetPage();
  }, [showFavoritesOnly, resetPage]);

  const filtered = allScreenshots.filter((shot) => {
    if (showFavoritesOnly && !favorites[shot.filename]) return false;
    const q = searchQuery.trim().toLowerCase();
    if (q && !shot.filename.toLowerCase().includes(q)) return false;
    const shotTags = tags[shot.filename] || [];
    if (
      q &&
      !shot.filename.toLowerCase().includes(q) &&
      !shotTags.some((t) => t.toLowerCase().includes(q))
    )
      return false;
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
      setTags((prev) => {
        const next = { ...prev };
        delete next[filename];
        return next;
      });
      if (preview === filename) setPreview(null);
      if (compareWith === filename) setCompareWith(null);
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
      setTags((prev) => {
        const next = { ...prev };
        for (const filename of toDelete) delete next[filename];
        return next;
      });
      setSelection(new Set());
      setSelectMode(false);
    }
  };

  const handleExportZip = async () => {
    if (selection.size === 0) return;
    setExporting(true);
    try {
      const filenames = Array.from(selection);
      const result = await window.electronAPI.exportZip(filenames, `screenshots-${Date.now()}.zip`);
      if (result.success) {
        alert(`Exported ${filenames.length} screenshots to:\n${result.path}`);
      } else {
        alert(`Export failed: ${result.error}`);
      }
    } catch (err) {
      alert(`Export failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setExporting(false);
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

  const handleAddTag = async (filename: string) => {
    const input = tagInput[filename]?.trim();
    if (!input) return;
    const currentTags = tags[filename] || [];
    const newTags = input.includes(",")
      ? input
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : [input];
    const updated = [...new Set([...currentTags, ...newTags])];
    const ok = await window.electronAPI.setTags(filename, updated);
    if (ok) {
      setTags((prev) => ({ ...prev, [filename]: updated }));
      setTagInput((prev) => ({ ...prev, [filename]: "" }));
    }
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
      setCompareWith(null);
    }
  }, [preview, resetZoom]);

  const openCompare = (filename: string) => {
    setCompareWith(filename);
  };

  const closeCompare = () => {
    setCompareWith(null);
    setCompareSliderPos(50);
  };

  const handleToggleFavorite = async (filename: string) => {
    const ok = await window.electronAPI.toggleFavorite(filename);
    if (ok) {
      setFavorites((prev) => ({
        ...prev,
        [filename]: !prev[filename],
      }));
    }
  };

  const handleBulkRename = async () => {
    if (selection.size === 0 || !renameValue.trim()) return;
    setRenameError(null);
    const filenames = Array.from(selection);
    const result = await window.electronAPI.bulkRename(
      filenames,
      renamePattern,
      renameValue.trim(),
      renamePattern === "replace" ? renameFind : undefined,
    );
    if (result.success) {
      const renamed = result.results?.length || 0;
      const conflicts = result.conflicts?.length || 0;
      let message = `Renamed ${renamed} file${renamed !== 1 ? "s" : ""}`;
      if (conflicts > 0) {
        message += ` (${conflicts} skipped due to name conflict)`;
      }
      setMetadataError(message);
      setRenameMode(false);
      setRenameValue("");
      setRenameFind("");
      await loadScreenshots();
    } else {
      setRenameError(result.error || "Rename failed");
    }
  };

  useEffect(() => {
    if (renameMode && renameFirstInputRef.current) {
      renameFirstInputRef.current.focus();
    }
  }, [renameMode]);

  const loadMetadata = async (filename: string) => {
    setLoadingMetadata(true);
    setMetadataError(null);
    try {
      const data = await window.electronAPI.getMetadata(filename);
      setMetadata(data);
      if (!data) {
        setMetadataError("Failed to load metadata for this file");
      }
    } catch {
      setMetadata(null);
      setMetadataError("Failed to load metadata for this file");
    } finally {
      setLoadingMetadata(false);
    }
  };

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h2 className="section-heading">Screenshot Gallery</h2>
        <div className="flex gap-2">
          {selectMode && selection.size > 0 && (
            <>
              <Button variant="danger" size="sm" onClick={handleBatchDelete}>
                Delete Selected ({selection.size})
              </Button>
              <Button variant="secondary" size="sm" onClick={handleExportZip} disabled={exporting}>
                {exporting ? "Exporting..." : "Export ZIP"}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setRenameMode(true);
                  setRenameError(null);
                }}
              >
                Rename Selected ({selection.size})
              </Button>
            </>
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
          placeholder="Search by filename or tag..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            resetPage();
          }}
          className="input flex-1"
        />
        <button
          type="button"
          onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
          className={`input text-left ${showFavoritesOnly ? "ring-2 ring-yellow-400/50" : ""}`}
          aria-pressed={showFavoritesOnly}
        >
          {showFavoritesOnly ? "★ Favorites Only" : "☆ Show All"}
        </button>
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
          const shotTags = tags[shot.filename] || [];
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
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleFavorite(shot.filename);
                }}
                className="absolute top-2 right-2 p-1 rounded-full bg-black/40 hover:bg-black/60 transition-colors"
                aria-label={favorites[shot.filename] ? "Remove from favorites" : "Add to favorites"}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill={favorites[shot.filename] ? "currentColor" : "none"}
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={favorites[shot.filename] ? "text-yellow-400" : "text-white/70"}
                  aria-hidden="true"
                >
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
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
                {shotTags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {shotTags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] bg-[var(--color-accent)]/20 text-[var(--color-accent)] px-1.5 py-0.5 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                {!selectMode && (
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
                      variant="secondary"
                      size="sm"
                      className="flex-1 text-[10px] py-1"
                      onClick={() => openCompare(shot.filename)}
                    >
                      Compare
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
                )}
                {!selectMode && (
                  <div className="flex gap-1 pt-1">
                    <input
                      type="text"
                      placeholder="Add tag..."
                      value={tagInput[shot.filename] || ""}
                      onChange={(e) =>
                        setTagInput((prev) => ({
                          ...prev,
                          [shot.filename]: e.target.value,
                        }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleAddTag(shot.filename);
                        }
                      }}
                      className="input text-[10px] py-0.5 px-1.5 flex-1"
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      className="text-[10px] py-0.5 px-1.5"
                      onClick={() => handleAddTag(shot.filename)}
                    >
                      Add
                    </Button>
                  </div>
                )}
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

      {preview && !compareWith && (
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
                onClick={async () => {
                  const filename = preview.split(/[\\/]/).pop() || "";
                  await loadMetadata(filename);
                }}
              >
                {loadingMetadata ? "Loading..." : "Info"}
              </Button>
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
                variant="secondary"
                size="sm"
                onClick={() => {
                  const filename = preview.split(/[\\/]/).pop() || "";
                  openCompare(filename);
                }}
              >
                Compare
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
            {metadata && (
              <div className="absolute bottom-16 left-4 bg-black/80 text-white text-xs rounded-lg p-3 max-w-xs">
                <div className="font-semibold mb-1">{metadata.filename}</div>
                <div className="space-y-0.5 text-white/80">
                  <div>
                    Dimensions: {metadata.width} × {metadata.height}
                  </div>
                  <div>Size: {(metadata.sizeBytes / 1024).toFixed(1)} KB</div>
                  <div>Format: {metadata.format}</div>
                  <div>Created: {new Date(metadata.createdAt).toLocaleString()}</div>
                  <div>Modified: {new Date(metadata.modifiedAt).toLocaleString()}</div>
                </div>
              </div>
            )}
            {metadataError && (
              <div className="absolute bottom-16 left-4 bg-red-900/80 text-red-200 text-xs rounded-lg p-3 max-w-xs">
                {metadataError}
              </div>
            )}
          </div>
        </div>
      )}

      {preview && compareWith && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Image comparison"
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={closeCompare}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              closeCompare();
            }
          }}
        >
          <div className="relative w-full h-full max-w-6xl max-h-[90vh] flex items-center justify-center">
            <div className="relative w-full h-full flex items-center justify-center">
              <img
                src={`file:///${preview.replace(/\\/g, "/")}`}
                alt="Before"
                className="absolute inset-0 w-full h-full object-contain select-none pointer-events-none"
                style={{ clipPath: `inset(0 ${100 - compareSliderPos}% 0 0)` }}
                draggable={false}
              />
              <img
                src={`file:///${compareWith.replace(/\\/g, "/")}`}
                alt="After"
                className="absolute inset-0 w-full h-full object-contain select-none pointer-events-none"
                style={{ clipPath: `inset(0 0 0 ${compareSliderPos}%)` }}
                draggable={false}
              />
              <button
                type="button"
                aria-label="Comparison slider. Drag left and right to compare images."
                className="absolute top-0 bottom-0 w-1 bg-white cursor-ew-resize border-none p-0"
                style={{ left: `${compareSliderPos}%` }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  const handleMove = (moveEvent: MouseEvent) => {
                    const rect = e.currentTarget.parentElement?.getBoundingClientRect();
                    if (!rect) return;
                    const x = moveEvent.clientX - rect.left;
                    const pct = (x / rect.width) * 100;
                    setCompareSliderPos(Math.max(0, Math.min(100, pct)));
                  };
                  const handleUp = () => {
                    document.removeEventListener("mousemove", handleMove);
                    document.removeEventListener("mouseup", handleUp);
                  };
                  document.addEventListener("mousemove", handleMove);
                  document.addEventListener("mouseup", handleUp);
                }}
              >
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="absolute -left-3"
                    aria-hidden="true"
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              </button>
            </div>
            <div className="absolute top-2 right-2 flex gap-2">
              <Button variant="secondary" size="sm" onClick={closeCompare}>
                Close
              </Button>
            </div>
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-black/60 rounded-full px-4 py-2">
              <span className="text-white text-xs font-medium">Before</span>
              <span className="text-white/50 text-xs">|</span>
              <span className="text-white text-xs font-medium">After</span>
            </div>
          </div>
        </div>
      )}

      {renameMode && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Bulk rename"
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setRenameMode(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setRenameMode(false);
            } else if (e.key === "Tab") {
              e.preventDefault();
              renameFirstInputRef.current?.focus();
            }
          }}
        >
          <div
            ref={renameDialogRef}
            tabIndex={-1}
            className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6 max-w-md w-full mx-4 pointer-events-auto"
          >
            <h3 className="text-lg font-semibold mb-4">Bulk Rename</h3>
            <p className="text-sm text-[var(--color-text-secondary)] mb-4">
              Renaming {selection.size} selected file(s).
            </p>
            {renameError && (
              <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                {renameError}
              </div>
            )}
            <div className="space-y-3">
              <div>
                <label htmlFor="rename-mode" className="block text-sm font-medium mb-1">
                  Mode
                </label>
                <select
                  id="rename-mode"
                  value={renamePattern}
                  onChange={(e) =>
                    setRenamePattern(e.target.value as "prefix" | "suffix" | "replace")
                  }
                  className="input w-full"
                >
                  <option value="prefix">Add Prefix</option>
                  <option value="suffix">Add Suffix</option>
                  <option value="replace">Find and Replace</option>
                </select>
              </div>
              <div>
                <label htmlFor="rename-value" className="block text-sm font-medium mb-1">
                  {renamePattern === "replace" ? "Replace with" : "Value"}
                </label>
                <input
                  id="rename-value"
                  type="text"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  placeholder={renamePattern === "replace" ? "Replacement text" : "Text to add"}
                  className="input w-full"
                />
              </div>
              {renamePattern === "replace" && (
                <div>
                  <label htmlFor="rename-find" className="block text-sm font-medium mb-1">
                    Find
                  </label>
                  <input
                    id="rename-find"
                    type="text"
                    value={renameFind}
                    onChange={(e) => setRenameFind(e.target.value)}
                    placeholder="Text to find"
                    className="input w-full"
                  />
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-6">
              <Button variant="primary" size="sm" onClick={handleBulkRename} className="flex-1">
                Rename
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setRenameMode(false);
                  setRenameValue("");
                  setRenameFind("");
                }}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
