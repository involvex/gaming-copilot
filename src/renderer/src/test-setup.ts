import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});

if (
  !(
    navigator as unknown as {
      clipboard?: {
        writeText: () => Promise<void>;
        readText: () => Promise<string>;
      };
    }
  ).clipboard
) {
  Object.defineProperty(navigator, "clipboard", {
    value: {
      writeText: () => Promise.resolve(),
      readText: () => Promise.resolve(""),
    },
    writable: true,
    configurable: true,
  });
}
