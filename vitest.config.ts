import { defineConfig } from "vitest/config";

// Deliberately does not extend vite.config.ts — the PWA plugin and React
// refresh add nothing here and slow the run down. Every target is a pure
// function or a Dexie call backed by fake-indexeddb.
export default defineConfig({
  test: {
    // .tsx too: the glob used to match only .test.ts, so a component
    // test would have been silently skipped with no error.
    include: ["src/**/*.test.{ts,tsx}"],
    environment: "node",
  },
});
