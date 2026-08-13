import { getActiveSlotId } from "./profiles";

/**
 * Storage durability.
 *
 * Every byte of study history lives in one IndexedDB database with no server
 * copy. Until this file existed the app never once asked the browser to treat
 * that data as worth keeping, so it sat in the default "best effort" bucket —
 * evictable whenever the browser wants the space back.
 *
 * `persist()` is a request, not a guarantee, and the answer differs everywhere:
 *
 *   - Chrome decides silently from engagement heuristics; no prompt appears.
 *   - Firefox asks the user.
 *   - Safari and iOS effectively ignore it, and the roughly-seven-day eviction
 *     of unused site data still applies.
 *
 * So this reduces the risk on some platforms and not at all on others, and
 * nothing in the UI may imply the data is now safe. The only thing that
 * genuinely survives eviction is a downloaded export, which is why
 * `daysSinceBackup` exists alongside this.
 */

/**
 * Where the last-export timestamp lives.
 *
 * Slot-scoped: a backup covers one profile's data, so another slot having been
 * exported says nothing about whether this one is protected. Shared from here
 * because both the writer (Settings) and the reader (the dashboard signal)
 * need it, and two copies of a storage key drift apart silently.
 */
export const backupKey = () => `cisspp-last-backup-${getActiveSlotId()}`;

export type PersistenceState = "granted" | "denied" | "unsupported";

/**
 * Asks the browser to keep this origin's data. Safe to call on every launch —
 * once granted it stays granted, and a repeat request is a no-op.
 */
export async function requestPersistence(): Promise<PersistenceState> {
  try {
    if (typeof navigator === "undefined" || !navigator.storage?.persist) return "unsupported";
    // Already granted: don't ask again. Firefox shows a prompt, and re-prompting
    // someone who already said yes is a good way to get a no.
    if (await navigator.storage.persisted?.()) return "granted";
    return (await navigator.storage.persist()) ? "granted" : "denied";
  } catch {
    return "unsupported";
  }
}

/** Current state without requesting anything. */
export async function persistenceState(): Promise<PersistenceState> {
  try {
    if (typeof navigator === "undefined" || !navigator.storage?.persisted) return "unsupported";
    return (await navigator.storage.persisted()) ? "granted" : "denied";
  } catch {
    return "unsupported";
  }
}

export type StorageUsage = { usageBytes: number; quotaBytes: number; pct: number };

/** Bytes used and available, or null where the browser won't say. */
export async function storageEstimate(): Promise<StorageUsage | null> {
  try {
    if (typeof navigator === "undefined" || !navigator.storage?.estimate) return null;
    const { usage, quota } = await navigator.storage.estimate();
    if (usage === undefined || quota === undefined || quota === 0) return null;
    return { usageBytes: usage, quotaBytes: quota, pct: Math.round((usage / quota) * 100) };
  } catch {
    return null;
  }
}

/**
 * What the user actually gets. Never claims the data is safe, because on the
 * platform most likely to evict it, it isn't.
 */
export function describePersistence(state: PersistenceState): string {
  switch (state) {
    case "granted":
      return "Your browser has agreed to keep this data rather than clear it to free space. That is not a guarantee — export a backup anyway.";
    case "denied":
      return "Your browser is keeping this data on a best-effort basis and may clear it to free space. Export a backup regularly.";
    case "unsupported":
      return "This browser won't say whether it will keep your data. On iOS in particular, site data can be cleared after about a week of not opening the app — an export is the only thing that survives that.";
  }
}

/** Human-readable byte size. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Whole days since the last successful export, or null if there has never been
 * one. Pure and clock-injected, like the rest of the signal inputs.
 */
export function daysSinceBackup(lastBackupIso: string | null, now: Date = new Date()): number | null {
  if (!lastBackupIso) return null;
  const then = new Date(lastBackupIso);
  if (Number.isNaN(then.getTime())) return null;
  const days = Math.floor((now.getTime() - then.getTime()) / 86_400_000);
  // A clock that has moved backwards shouldn't read as a negative age.
  return Math.max(0, days);
}
