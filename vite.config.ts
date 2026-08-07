import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// Use relative base so the app works whether deployed at "/" or "/CISSPP/" or any sub-path.
// Combined with HashRouter, this makes the build portable (GitHub Pages, Netlify, any host).
export default defineConfig({
  base: "./",
  plugins: [
    react(),
    VitePWA({
      // "prompt", not "autoUpdate". autoUpdate calls skipWaiting/clientsClaim, so a
      // deploy activated the new worker under the running app and Workbox deleted the
      // old precache — the next lazy route then failed its content-hashed import and
      // the user got the generic crash screen. With "prompt" the new worker waits, the
      // old chunks keep resolving, and the reload happens when the user agrees to it.
      registerType: "prompt",
      includeAssets: [
        "favicon.svg",
        "icons/apple-touch-icon.png",
        "icons/icon-192.png",
        "icons/icon-512.png",
        "icons/icon-maskable-512.png",
      ],
      manifest: false, // we ship our own at public/manifest.webmanifest
      workbox: {
        // HashRouter keeps all app routes under a single index.html, so
        // a navigation fallback isn't strictly required, but set it anyway
        // so deep-link reloads still hit the shell.
        navigateFallback: "index.html",
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        // No runtimeCaching: fonts are bundled now, so every asset the app
        // needs is in the precache and nothing is fetched from a third party.
      },
    }),
  ],
});
