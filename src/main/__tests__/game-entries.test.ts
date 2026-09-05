import { describe, expect, it } from "vitest";
import type { GameEntry } from "../../shared/types";
import { addGameEntry, removeGameEntry, updateGameEntry } from "../game-entries";

const GAME_A: GameEntry = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  name: "Game A",
  exe: "A.exe",
  urls: [],
};

const GAME_B: GameEntry = {
  id: "660e8400-e29b-41d4-a716-446655440000",
  name: "Game B",
  exe: "B.exe",
  urls: ["https://example.com"],
};

describe("game-entries (pure, no Electron mock)", () => {
  it("should append entries without mutating the input", () => {
    const games: GameEntry[] = [GAME_A];

    const result = addGameEntry(games, GAME_B);

    expect(result).toEqual([GAME_A, GAME_B]);
    expect(games).toEqual([GAME_A]);
  });

  it("should replace the entry with the same id", () => {
    const updated = { ...GAME_A, name: "Game A Remastered" };

    const result = updateGameEntry([GAME_A, GAME_B], updated);

    expect(result).toEqual([updated, GAME_B]);
  });

  it("should throw when updating an unknown id", () => {
    expect(() =>
      updateGameEntry([GAME_A], {
        ...GAME_A,
        id: "00000000-0000-0000-0000-000000000000",
      }),
    ).toThrow("Game not found");
  });

  it("should remove the entry and return it", () => {
    const { games, removed } = removeGameEntry([GAME_A, GAME_B], GAME_A.id);

    expect(games).toEqual([GAME_B]);
    expect(removed).toEqual(GAME_A);
  });

  it("should throw when removing an unknown id", () => {
    expect(() => removeGameEntry([GAME_A], "00000000-0000-0000-0000-000000000000")).toThrow(
      "Game not found",
    );
  });

  it("should not mutate the input on remove", () => {
    const games: GameEntry[] = [GAME_A, GAME_B];

    removeGameEntry(games, GAME_A.id);

    expect(games).toEqual([GAME_A, GAME_B]);
  });
});
