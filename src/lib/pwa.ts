import { registerSW } from "virtual:pwa-register";

/**
 * Service-worker registration with a user-visible update path.
 *
 * The plugin used to inject its own registration script, which ignored the
 * returned promise entirely — a failed registration (private mode, blocked
 * storage, insecure origin) was invisible, and the app claimed to be
 * offline-capable when it wasn't.
 */
type Handlers = {
  onNeedRefresh: () => void;
  onOfflineReady: () => void;
  onRegisterError: (err: unknown) => void;
};

let applyUpdate: ((reload?: boolean) => Promise<void>) | null = null;

const UPDATE_CHECK_MS = 60 * 60 * 1000;

export function initServiceWorker(handlers: Handlers) {
  try {
    applyUpdate = registerSW({
      immediate: true,
      onNeedRefresh: handlers.onNeedRefresh,
      onOfflineReady: handlers.onOfflineReady,
      onRegisterError: handlers.onRegisterError,
      onRegisteredSW(_url, registration) {
        if (!registration) return;
        // The browser only re-checks sw.js on navigation, and this app is a
        // HashRouter SPA — it never navigates. Without an explicit check a
        // long-lived tab would never learn an update exists.
        const check = () => {
          if (document.visibilityState === "visible") void registration.update();
        };
        setInterval(check, UPDATE_CHECK_MS);
        document.addEventListener("visibilitychange", check);
        // And once shortly after load, so a tab opened right after a deploy
        // finds out without waiting an hour.
        setTimeout(check, 5_000);
      },
    });
  } catch (err) {
    // Never let a registration failure take the app down with it.
    handlers.onRegisterError(err);
  }
}

/**
 * Activates a waiting worker, then reloads.
 *
 * Driven explicitly rather than leaning on the plugin's `updateSW(true)`: that
 * resolved without the new worker ever taking control here, so the reload came
 * back on the old worker, the pending update was still pending, and any stale
 * chunk stayed stale — the prompt just reappeared.
 */
export async function reloadWithUpdate() {
  const reload = () => window.location.reload();

  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    const waiting = registration?.waiting;

    if (!waiting) {
      // Nothing staged — a plain reload is all that's available.
      if (applyUpdate) await applyUpdate(false).catch(() => {});
      reload();
      return;
    }

    // Reload as soon as the new worker takes over, with a timeout so a browser
    // that never fires controllerchange still recovers.
    const controllerChanged = new Promise<void>((resolve) => {
      navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), { once: true });
      setTimeout(resolve, 3000);
    });

    waiting.postMessage({ type: "SKIP_WAITING" });
    await controllerChanged;
    reload();
  } catch {
    reload();
  }
}
