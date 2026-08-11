/**
 * Periodic background sync handler, imported into the generated Workbox worker
 * via `workbox.importScripts` in vite.config.ts.
 *
 * Kept as a plain script in public/ rather than switching the plugin to
 * injectManifest: the generateSW + registerType "prompt" setup is load-bearing
 * (see the comment in vite.config.ts) and rewriting the worker strategy to add
 * one event listener would risk the update path for no gain.
 *
 * What this can and cannot do is worth stating where someone will find it:
 * `periodicsync` is Chromium-only, needs the PWA installed, and the browser
 * decides when — possibly not for a day, possibly never. It cannot fire at a
 * time the user picked. It is a best-effort nudge, and the UI says so.
 */

const REMINDER_TAG = "cisspp-study-reminder";
const STATE_CACHE = "cisspp-reminder-state";
const LAST_ACTIVE_URL = "/__cisspp/last-active";

function todayKey() {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

/**
 * The app writes this on every logged session. Dexie is not reachable from
 * here in any reliable way — the database name depends on the active profile
 * slot and the worker has no way to know which one is open.
 */
async function studiedToday() {
  try {
    const cache = await caches.open(STATE_CACHE);
    const hit = await cache.match(LAST_ACTIVE_URL);
    if (!hit) return false;
    return (await hit.text()) === todayKey();
  } catch {
    // Fall through to reminding. A spurious nudge is a much smaller failure
    // than silently never reminding anyone, which is what this replaced.
    return false;
  }
}

self.addEventListener("periodicsync", (event) => {
  if (event.tag !== REMINDER_TAG) return;
  event.waitUntil(
    (async () => {
      if (await studiedToday()) return;
      // If a window is already open the in-app nudge is showing, and a system
      // notification on top of it is just noise.
      const clientList = await self.clients.matchAll({ type: "window" });
      if (clientList.some((c) => c.visibilityState === "visible")) return;

      await self.registration.showNotification("Keep your streak alive", {
        body: "You haven't logged any study today. A single quiz or review counts.",
        icon: "icons/icon-192.png",
        badge: "icons/icon-192.png",
        // A fixed tag so a browser that fires several times in a day replaces
        // the notification rather than stacking duplicates.
        tag: "cisspp-daily-reminder",
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const existing = clientList[0];
      if (existing) {
        await existing.focus();
        return;
      }
      await self.clients.openWindow("./");
    })(),
  );
});
