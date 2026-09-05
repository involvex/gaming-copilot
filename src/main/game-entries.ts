import type { GameEntry } from "../shared/types";

/**
 * Pure games-list operations. The IPC handlers in `ipc/games.ts` validate
 * input at the boundary and delegate here, so this logic can be unit-tested
 * without the Electron mock (same precedent as `screenshot-paths.ts`).
 * All functions return new arrays and never mutate their input.
 */

/** Append a validated entry to the list. */
export function addGameEntry(games: GameEntry[], entry: GameEntry): GameEntry[] {
  return [...games, entry];
}

/** Replace the entry with the same id. Throws when the id is unknown. */
export function updateGameEntry(games: GameEntry[], entry: GameEntry): GameEntry[] {
  if (!games.some((g) => g.id === entry.id)) {
    throw new Error(`Game not found: ${entry.id}`);
  }
  return games.map((g) => (g.id === entry.id ? entry : g));
}

/**
 * Remove the entry with the given id. Returns the updated list plus the
 * removed entry (used for log lines). Throws when the id is unknown.
 */
export function removeGameEntry(
  games: GameEntry[],
  id: string,
): { games: GameEntry[]; removed: GameEntry } {
  const removed = games.find((g) => g.id === id);
  if (!removed) {
    throw new Error(`Game not found: ${id}`);
  }
  return { games: games.filter((g) => g.id !== id), removed };
}
