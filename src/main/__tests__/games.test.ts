import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GameEntry } from "../../shared/types";
import { resetIpcTestState } from "./helpers";

describe("config module — games", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    resetIpcTestState();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const SAMPLE_GAME: GameEntry = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    name: "Dragon Crusade",
    exe: "Neuz.exe",
    urls: ["https://wiki.crusade.one/progression/"],
  };

  it("should default games to empty array", async () => {
    const { initConfig } = await import("../config");

    const config = initConfig();

    expect(config.games).toEqual([]);
  });

  it("should persist games via setConfigValue", async () => {
    const { initConfig, setConfigValue, getConfig } = await import("../config");

    initConfig();
    setConfigValue("games", [SAMPLE_GAME]);

    expect(getConfig().games).toEqual([SAMPLE_GAME]);
  });

  it("should round-trip games through setPartialConfig", async () => {
    const { initConfig, setPartialConfig, getConfig } = await import("../config");

    initConfig();
    setPartialConfig({ games: [SAMPLE_GAME] });

    expect(getConfig().games).toEqual([SAMPLE_GAME]);
  });

  it("should persist multiple games", async () => {
    const { initConfig, setConfigValue, getConfig } = await import("../config");

    initConfig();
    const games: GameEntry[] = [
      SAMPLE_GAME,
      {
        id: "660e8400-e29b-41d4-a716-446655440000",
        name: "Another Game",
        exe: "Other.exe",
        urls: [],
      },
    ];
    setConfigValue("games", games);

    expect(getConfig().games).toHaveLength(2);
  });
});
