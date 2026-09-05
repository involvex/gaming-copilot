import { describe, expect, it } from "vitest";
import {
  buildScreenshotFilename,
  isValidGameExeName,
  parseScreenshotDataUrl,
} from "../capture-utils";

describe("isValidGameExeName (pure, no Electron mock)", () => {
  it("should accept bare names with and without the .exe suffix", () => {
    expect(isValidGameExeName("Neuz.exe")).toBe(true);
    expect(isValidGameExeName("Neuz")).toBe(true);
  });

  it("should accept dots, dashes, and underscores", () => {
    expect(isValidGameExeName("my-game_v2.0.exe")).toBe(true);
  });

  it("should reject names with spaces or separators", () => {
    expect(isValidGameExeName("invalid exe name")).toBe(false);
    expect(isValidGameExeName("evil/game.exe")).toBe(false);
    expect(isValidGameExeName("..\\evil.exe")).toBe(false);
  });

  it("should reject names with path-hostile characters", () => {
    expect(isValidGameExeName("game txt")).toBe(false);
    expect(isValidGameExeName("a/b.exe")).toBe(false);
  });

  it("should reject empty names", () => {
    // "" becomes ".exe", which needs at least one char before the suffix.
    expect(isValidGameExeName("")).toBe(false);
  });
});

describe("parseScreenshotDataUrl (pure, no Electron mock)", () => {
  it("should parse a png data URL", () => {
    const parsed = parseScreenshotDataUrl("data:image/png;base64,AQID");

    expect(parsed?.mimeType).toBe("image/png");
    expect(parsed?.ext).toBe("png");
    expect(parsed?.buffer).toEqual(Buffer.from([1, 2, 3]));
  });

  it("should parse a jpeg data URL", () => {
    const parsed = parseScreenshotDataUrl("data:image/jpeg;base64,xyz");

    expect(parsed?.mimeType).toBe("image/jpeg");
    expect(parsed?.ext).toBe("jpeg");
  });

  it("should return null for malformed URLs", () => {
    expect(parseScreenshotDataUrl("not a url")).toBeNull();
    expect(parseScreenshotDataUrl("data:image/png,abc123")).toBeNull();
    expect(parseScreenshotDataUrl("data:text/plain;base64,abc")).toBeNull();
    expect(parseScreenshotDataUrl("")).toBeNull();
  });
});

describe("buildScreenshotFilename (pure, no Electron mock)", () => {
  it("should build a timestamped filename with pinned clock", () => {
    const now = new Date("2026-09-05T12:34:56.789Z");

    expect(buildScreenshotFilename("png", now)).toBe("gaming-copilot_2026-09-05T12-34-56-789Z.png");
  });

  it("should use the given extension", () => {
    const now = new Date("2026-09-05T12:34:56.789Z");

    expect(buildScreenshotFilename("jpeg", now)).toBe(
      "gaming-copilot_2026-09-05T12-34-56-789Z.jpeg",
    );
  });
});
