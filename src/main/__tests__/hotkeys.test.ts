import { describe, expect, it } from "vitest";
import { validateHotkey } from "../ipc/hotkeys";

describe("validateHotkey", () => {
  it("returns valid for a well-formed accelerator", () => {
    const result = validateHotkey("CommandOrControl+Shift+G");
    expect(result.valid).toBe(true);
    expect(result.conflict).toBe(false);
  });

  it("returns invalid for empty string", () => {
    const result = validateHotkey("");
    expect(result.valid).toBe(false);
    expect(result.conflict).toBe(false);
  });

  it("returns invalid for non-string input", () => {
    const result = validateHotkey(123 as unknown as string);
    expect(result.valid).toBe(false);
    expect(result.conflict).toBe(false);
  });
});
