import { defineConfig } from "vitest/config";

// Deliberately does not extend vite.config.ts — the PWA plugin and React
// refresh add nothing here and slow the run down. Every target is a pure
// function or a Dexie call backed by fake-indexeddb.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
