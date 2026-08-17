import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    css: false,
    exclude: ["tests/rendered-html.test.mjs", "**/node_modules/**"],
  },
});
