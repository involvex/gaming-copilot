import { resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertBareFilename,
  DEFAULT_EXPORT_ZIP_NAME,
  resolveScreenshotPath,
  sanitizeZipName,
} from "../screenshot-paths";

const DIR = resolve("screenshots-test-dir");

describe("resolveScreenshotPath", () => {
  it("resolves bare filenames inside the directory", () => {
    expect(resolveScreenshotPath(DIR, "shot.png")).toBe(resolve(DIR, "shot.png"));
  });

  it("allows nested paths that stay inside the directory", () => {
    const nested = resolveScreenshotPath(DIR, `sub${sep}shot.png`);
    expect(nested.startsWith(DIR + sep)).toBe(true);
  });

  it("rejects parent-directory escapes", () => {
    expect(() => resolveScreenshotPath(DIR, "..")).toThrow("Invalid screenshot path");
    expect(() => resolveScreenshotPath(DIR, "../evil.png")).toThrow("Invalid screenshot path");
    expect(() => resolveScreenshotPath(DIR, `sub${sep}..${sep}..${sep}evil.png`)).toThrow(
      "Invalid screenshot path",
    );
  });

  it("rejects absolute paths outside the directory", () => {
    const outside = resolve(DIR, "..", "evil.png");
    expect(() => resolveScreenshotPath(DIR, outside)).toThrow("Invalid screenshot path");
  });
});

describe("assertBareFilename", () => {
  it("accepts plain filenames", () => {
    expect(() => assertBareFilename("shot.png")).not.toThrow();
    expect(() => assertBareFilename("my shot (1).jpeg")).not.toThrow();
  });

  it("rejects empty, dot, and overlong names", () => {
    expect(() => assertBareFilename("")).toThrow();
    expect(() => assertBareFilename(".")).toThrow();
    expect(() => assertBareFilename("..")).toThrow();
    expect(() => assertBareFilename("a".repeat(256))).toThrow();
  });

  it("rejects names with directory components", () => {
    expect(() => assertBareFilename("sub/shot.png")).toThrow();
    expect(() => assertBareFilename("../evil.png")).toThrow();
    expect(() => assertBareFilename(resolve(DIR, "shot.png"))).toThrow();
  });
});

describe("sanitizeZipName", () => {
  it("keeps clean names and ensures a .zip suffix", () => {
    expect(sanitizeZipName("screenshots-export.zip")).toBe("screenshots-export.zip");
    expect(sanitizeZipName("my shots")).toBe("my_shots.zip");
  });

  it("strips directory components", () => {
    expect(sanitizeZipName("../../evil.zip")).toBe("evil.zip");
    expect(sanitizeZipName("/abs/path.zip")).toBe("path.zip");
  });

  it("replaces unsafe characters and never emits separators", () => {
    const out = sanitizeZipName('a|b<c>d"e*f?.zip');
    expect(out).not.toMatch(/[/\\]/);
    expect(out.endsWith(".zip")).toBe(true);
  });

  it("falls back to the default when nothing usable remains", () => {
    expect(sanitizeZipName("")).toBe(DEFAULT_EXPORT_ZIP_NAME);
    expect(sanitizeZipName("...")).toBe(DEFAULT_EXPORT_ZIP_NAME);
  });

  it("truncates overlong names", () => {
    const out = sanitizeZipName(`${"a".repeat(200)}.zip`);
    expect(out.length).toBeLessThanOrEqual(64);
    expect(out.endsWith(".zip")).toBe(true);
  });
});
