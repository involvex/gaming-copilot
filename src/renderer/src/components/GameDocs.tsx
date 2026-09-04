import { useEffect, useState } from "react";
import { Button, Card, Input } from "./ui";

interface GameEntry {
  id: string;
  name: string;
  exe: string;
  urls: string[];
}

export default function GameDocs({ config }: { config: Record<string, unknown> | null }) {
  const [games, setGames] = useState<GameEntry[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editExe, setEditExe] = useState("");
  const [editUrls, setEditUrls] = useState<string>("");

  useEffect(() => {
    loadGames();
  }, [config]);

  const loadGames = async () => {
    const list = await window.electronAPI.getGames();
    setGames(list as GameEntry[]);
  };

  const handleAddNew = () => {
    setEditingId(null);
    setEditName("");
    setEditExe("");
    setEditUrls("");
  };

  const handleEdit = (game: GameEntry) => {
    setEditingId(game.id);
    setEditName(game.name);
    setEditExe(game.exe);
    setEditUrls(game.urls.join("\n"));
  };

  const handleSave = async () => {
    const urls = editUrls
      .split("\n")
      .map((u) => u.trim())
      .filter((u) => u.length > 0);

    const entry: GameEntry = {
      id: editingId || crypto.randomUUID(),
      name: editName.trim(),
      exe: editExe.trim(),
      urls,
    };

    if (!entry.name || !entry.exe) return;

    if (editingId) {
      await window.electronAPI.updateGame(entry);
    } else {
      await window.electronAPI.addGame(entry);
    }

    setEditingId(null);
    setEditName("");
    setEditExe("");
    setEditUrls("");
    await loadGames();
  };

  const handleRemove = async (id: string) => {
    if (!confirm(`Remove game "${games.find((g) => g.id === id)?.name}"?`)) return;
    await window.electronAPI.removeGame(id);
    await loadGames();
  };

  const canSave = editName.trim().length > 0 && editExe.trim().length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="section-heading">Game Documentation</h2>
        <Button
          variant="primary"
          size="sm"
          onClick={handleAddNew}
          disabled={editingId === null && editName === "" && editExe === ""}
        >
          Add Game
        </Button>
      </div>

      <p className="text-sm text-[var(--color-text-secondary)]">
        Add game entries with their executable name and documentation URLs. When the game is
        running, its URLs provide context for AI analysis.
      </p>

      {(editingId !== null || editName !== "" || editExe !== "") && (
        <Card>
          <div className="space-y-4">
            <div>
              <label htmlFor="game-name" className="field-label">
                Game Name
              </label>
              <Input
                id="game-name"
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Dragon Crusade"
              />
            </div>

            <div>
              <label htmlFor="game-exe" className="field-label">
                Executable
              </label>
              <Input
                id="game-exe"
                type="text"
                value={editExe}
                onChange={(e) => setEditExe(e.target.value)}
                placeholder="Neuz.exe"
              />
            </div>

            <div>
              <label htmlFor="game-urls" className="field-label">
                Documentation URLs
              </label>
              <p className="field-label-description">
                One URL per line. These are used as context for AI analysis.
              </p>
              <textarea
                id="game-urls"
                value={editUrls}
                onChange={(e) => setEditUrls(e.target.value)}
                placeholder="https://wiki.example.com/DragonCrusade"
                className="w-full h-20 bg-[var(--color-input-bg)] border border-[var(--color-border)] rounded-md px-3 py-2 text-[var(--color-text)] resize-y"
              />
            </div>

            <div className="flex gap-2">
              <Button variant="primary" size="sm" onClick={handleSave} disabled={!canSave}>
                Save
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setEditingId(null);
                  setEditName("");
                  setEditExe("");
                  setEditUrls("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}

      {games.length === 0 && editingId === null ? (
        <div className="text-center py-8 text-[var(--color-text-secondary)]">
          <p>No games added yet. Click "Add Game" to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {games.map((game) => (
            <Card key={game.id}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-[var(--color-text)]">{game.name}</h3>
                    <span className="text-xs text-[var(--color-text-tertiary)] bg-[var(--color-surface)] px-2 py-0.5 rounded">
                      {game.exe}
                    </span>
                  </div>
                  {game.urls.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {game.urls.map((url, i) => (
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-[var(--color-accent)] hover:underline block truncate"
                          title={url}
                        >
                          {url}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <Button variant="secondary" size="sm" onClick={() => handleEdit(game)}>
                    Edit
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => handleRemove(game.id)}>
                    Remove
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
