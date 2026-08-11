/**
 * Daily study reminders — and an honest account of what a PWA can actually do.
 *
 * What this replaced: a toggle that requested notification permission, stored a
 * time, fired one immediate notification reading "You'll be reminded at 18:00
 * daily", and then never reminded anyone of anything. Nothing scheduled it.
 * There was no service-worker handler and no periodic sync.
 *
 * The honest position, because it constrains everything below:
 *
 *   - Web Push needs a server to send the push. This app has no backend, by
 *     design, so that route is closed.
 *   - `periodicsync` is Chromium-only, requires the PWA to be installed, and
 *     the *browser* decides when it fires. It is a "roughly once in a while"
 *     hint, not a scheduler. It cannot fire at 18:00.
 *   - iOS Safari supports neither.
 *
 * So a user-chosen daily time is not deliverable on any platform, and the UI
 * must not imply otherwise. What is deliverable: a reliable in-app nudge on
 * every platform, plus a best-effort OS notification where the browser allows
 * it. The preferred time is kept as a hint for the in-app nudge, which *can*
 * honour it, and is described as approximate for the OS one, which cannot.
 */

/** Cache holding the one value the service worker needs to read. */
const STATE_CACHE = "cisspp-reminder-state";
const LAST_ACTIVE_URL = "/__cisspp/last-active";
const PERIODIC_TAG = "cisspp-study-reminder";

/**
 * Twelve hours. Chromium treats this as a floor it is free to ignore upward,
 * and asking for less does not make it fire more often.
 */
const MIN_INTERVAL_MS = 12 * 60 * 60 * 1000;

export type ReminderSupport = {
  /** OS-level notifications can be shown at all. */
  notifications: boolean;
  /** The browser can wake the worker in the background. */
  background: boolean;
  /** Plain-language summary of what the user will actually get. */
  summary: string;
};

/**
 * What this browser can really do, for display rather than for branching.
 *
 * Deliberately does not promise scheduling anywhere, because nothing here
 * provides it.
 */
export function reminderSupport(): ReminderSupport {
  const notifications = typeof window !== "undefined" && "Notification" in window;
  const background =
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    "PeriodicSyncManager" in window;

  let summary: string;
  if (!notifications) {
    summary =
      "This browser can't show notifications, so reminders appear in the app when you open it.";
  } else if (!background) {
    summary =
      "This browser can't wake the app in the background — Safari and iOS included. You'll get a reminder inside the app when you open it, but not a system notification.";
  } else {
    summary =
      "Install the app to your home screen and the browser may show a system reminder — the timing is approximate and the browser decides when. The in-app reminder always works.";
  }
  return { notifications, background, summary };
}

/**
 * Publishes the last active date where a service worker can read it.
 *
 * A Cache entry rather than the database: the worker cannot easily reach Dexie
 * because the database name depends on the active profile slot, and it has no
 * way to know which slot is open. Reminders belong to the device rather than to
 * a profile, so a single device-wide value is also the more correct model.
 *
 * Never throws — a failed write means at worst a redundant nudge.
 */
export async function publishLastActive(date: string): Promise<void> {
  try {
    if (typeof caches === "undefined") return;
    const cache = await caches.open(STATE_CACHE);
    await cache.put(LAST_ACTIVE_URL, new Response(date));
  } catch {
    // Storage pressure or a private-mode restriction. Not worth surfacing.
  }
}

/** Reads back what `publishLastActive` wrote. Null when never set. */
export async function readLastActive(): Promise<string | null> {
  try {
    if (typeof caches === "undefined") return null;
    const cache = await caches.open(STATE_CACHE);
    const hit = await cache.match(LAST_ACTIVE_URL);
    return hit ? await hit.text() : null;
  } catch {
    return null;
  }
}

/**
 * Registers for background wake-ups, returning whether it actually took.
 *
 * Every failure path here is ordinary rather than exceptional — an uninstalled
 * PWA, a browser without the API, a denied permission — so this reports a
 * boolean instead of throwing, and the caller tells the user what they will get.
 */
export async function enableBackgroundReminder(): Promise<boolean> {
  try {
    if (!("serviceWorker" in navigator) || !("PeriodicSyncManager" in window)) return false;
    const registration = (await navigator.serviceWorker.ready) as ServiceWorkerRegistration & {
      periodicSync?: {
        register: (tag: string, opts: { minInterval: number }) => Promise<void>;
      };
    };
    if (!registration.periodicSync) return false;

    const status = await navigator.permissions.query({
      // Not in the standard permission-name union; the cast is the API, not a
      // shortcut around the types.
      name: "periodic-background-sync" as PermissionName,
    });
    if (status.state !== "granted") return false;

    await registration.periodicSync.register(PERIODIC_TAG, { minInterval: MIN_INTERVAL_MS });
    return true;
  } catch {
    return false;
  }
}

/** Best-effort unregister. Silent because there is nothing useful to report. */
export async function disableBackgroundReminder(): Promise<void> {
  try {
    if (!("serviceWorker" in navigator)) return;
    const registration = (await navigator.serviceWorker.ready) as ServiceWorkerRegistration & {
      periodicSync?: { unregister: (tag: string) => Promise<void> };
    };
    await registration.periodicSync?.unregister(PERIODIC_TAG);
  } catch {
    // Nothing to do.
  }
}

/**
 * Whether the in-app nudge should show: enabled, nothing logged today, and the
 * preferred time has passed.
 *
 * Pure and clock-injected so it is testable without a DOM, like everything else
 * in this directory.
 */
export function shouldNudge(opts: {
  enabled: boolean;
  lastActiveDate: string | null;
  /** "HH:MM", the user's preferred time. */
  preferredTime: string;
  now?: Date;
}): boolean {
  const { enabled, lastActiveDate, preferredTime, now = new Date() } = opts;
  if (!enabled) return false;

  const todayKey = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
  if (lastActiveDate === todayKey) return false;

  const [h, m] = preferredTime.split(":").map(Number);
  // A malformed stored value must not suppress the nudge forever.
  if (!Number.isFinite(h) || !Number.isFinite(m)) return true;

  const minutesNow = now.getHours() * 60 + now.getMinutes();
  return minutesNow >= h * 60 + m;
}
