import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          environment: "node",
          include: ["src/main/**/*.{test,spec}.{ts,tsx}"],
        },
      },
      {
        test: {
          environment: "jsdom",
          setupFiles: ["./src/renderer/src/test-setup.ts"],
          include: ["src/renderer/**/*.{test,spec}.{ts,tsx}"],
        },
      },
    ],
  },
});
