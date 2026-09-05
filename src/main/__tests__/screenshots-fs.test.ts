import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { bulkRenameFiles, loadFavorites, toggleFavorite } from "../screenshot-paths";

let dir: string;

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "gaming-copilot-shots-"));
  await writeFile(join(dir, "a.png"), "fake-png-a");
  await writeFile(join(dir, "b.png"), "fake-png-b");
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("bulkRenameFiles (end-to-end on disk)", () => {
  it("renames files with a prefix", async () => {
    const { results, conflicts } = await bulkRenameFiles(dir, {
      filenames: ["a.png", "b.png"],
      mode: "prefix",
      value: "shot_",
    });
    expect(conflicts).toEqual([]);
    expect(results).toEqual([
      { old: "a.png", new: "shot_a.png" },
      { old: "b.png", new: "shot_b.png" },
    ]);
    expect(await exists(join(dir, "shot_a.png"))).toBe(true);
    expect(await exists(join(dir, "shot_b.png"))).toBe(true);
    expect(await exists(join(dir, "a.png"))).toBe(false);
    expect(await readFile(join(dir, "shot_a.png"), "utf-8")).toBe("fake-png-a");
  });

  it("renames with suffix and replace modes", async () => {
    await bulkRenameFiles(dir, {
      filenames: ["a.png"],
      mode: "suffix",
      value: "_v2",
    });
    expect(await exists(join(dir, "a_v2.png"))).toBe(true);

    await bulkRenameFiles(dir, {
      filenames: ["a_v2.png"],
      mode: "replace",
      value: "final",
      find: "v2",
    });
    expect(await exists(join(dir, "a_final.png"))).toBe(true);
  });

  it("reports conflicts without touching files", async () => {
    await writeFile(join(dir, "shot_a.png"), "existing");
    const { results, conflicts } = await bulkRenameFiles(dir, {
      filenames: ["a.png"],
      mode: "prefix",
      value: "shot_",
    });
    expect(results).toEqual([]);
    expect(conflicts).toEqual(["shot_a.png"]);
    expect(await readFile(join(dir, "a.png"), "utf-8")).toBe("fake-png-a");
    expect(await readFile(join(dir, "shot_a.png"), "utf-8")).toBe("existing");
  });

  it("fails closed on path traversal", async () => {
    await expect(
      bulkRenameFiles(dir, {
        filenames: ["../evil.png"],
        mode: "prefix",
        value: "x_",
      }),
    ).rejects.toThrow("Invalid screenshot path");
    expect(await exists(join(dir, "x_evil.png"))).toBe(false);
  });
});

describe("toggleFavorite (end-to-end on disk)", () => {
  it("flips the flag, persists it, and returns the new state", async () => {
    expect(await loadFavorites(dir)).toEqual({});

    expect(await toggleFavorite(dir, "a.png")).toBe(true);
    expect(await loadFavorites(dir)).toEqual({ "a.png": true });
    const raw = await readFile(join(dir, "screenshot-favorites.json"), "utf-8");
    expect(JSON.parse(raw)).toEqual({ "a.png": true });

    expect(await toggleFavorite(dir, "a.png")).toBe(false);
    expect(await loadFavorites(dir)).toEqual({ "a.png": false });
  });

  it("rejects traversal without writing anything outside the directory", async () => {
    await expect(toggleFavorite(dir, "../evil.png")).rejects.toThrow("Invalid screenshot path");
    expect(await loadFavorites(dir)).toEqual({});
    expect(await exists(join(tmpdir(), "screenshot-favorites.json"))).toBe(false);
  });
});
