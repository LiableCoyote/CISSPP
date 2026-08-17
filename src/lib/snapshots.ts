import { format } from "date-fns";
import { db, type Snapshot } from "../db/schema";
import { exportData, importData } from "./export";
import { getActiveSlotId } from "./profiles";
import { getItem, setItem } from "./safeStorage";

const MAX_SNAPSHOTS = 3;
// Slot-scoped: each profile is its own IndexedDB database, so a global key
// meant opening profile A marked the day done and B never got a snapshot.
// Matches the pattern in components/layout/Onboarding.tsx.
const lastDailyKey = () => `cisspp-last-snapshot-day-${getActiveSlotId()}`;

/**
 * Automatic local backups.
 *
 * Import and reset both replace everything the user has, and neither is
 * recoverable if they hadn't exported first — the file picker in particular
 * takes one tap and doesn't read as dangerous. Keeping the last few snapshots
 * in the database turns both into recoverable mistakes.
 *
 * Snapshots are excluded from the export payload on purpose: a backup that
 * contained its own history would grow geometrically.
 */

/**
 * Writes a snapshot, or throws.
 *
 * Callers that are about to destroy data MUST use this and let the failure
 * propagate. `createSnapshot` swallows errors and returns null, which was the
 * shape of a real data-loss bug: the import path discarded that null, so a
 * snapshot failing under quota — exactly when it fails — meant the destructive
 * restore ran anyway, right after the UI promised a backup had been taken.
 */
export async function createSnapshotOrThrow(reason: Snapshot["reason"]): Promise<Snapshot> {
  const payload = JSON.stringify(await exportData());
  const snapshot: Snapshot = {
    id: `snap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    reason,
    // Blob size, not string length: payload.length counts UTF-16 code units and
    // this content is emoji-heavy, so it under-reported by up to half. Settings
    // renders this number to the user as KB.
    payload,
    sizeBytes: new Blob([payload]).size,
  };
  await db.snapshots.put(snapshot);

  // Keep only the newest few — this data is a safety net, not an archive.
  const all = await db.snapshots.orderBy("createdAt").reverse().toArray();
  const stale = all.slice(MAX_SNAPSHOTS);
  if (stale.length > 0) await db.snapshots.bulkDelete(stale.map((s) => s.id));

  return snapshot;
}

export async function listSnapshots(): Promise<Snapshot[]> {
  return db.snapshots.orderBy("createdAt").reverse().toArray();
}

export async function restoreSnapshot(id: string): Promise<void> {
  const snap = await db.snapshots.get(id);
  if (!snap) throw new Error("That snapshot no longer exists.");
  // Take one of the current state first, so restoring is itself undoable — and
  // abort if that fails rather than replacing data with no way back.
  await createSnapshotOrThrow("pre-import");
  await importData(snap.payload);
}

/**
 * Takes at most one snapshot per day, on first launch.
 *
 * Throws on failure, and the caller reports it. This used to go through a
 * best-effort wrapper that logged and returned null, which was wrong twice
 * over: the user was never told their automatic backups had stopped, and the
 * day was marked done regardless — so the failure was not even retried on the
 * next launch. Now a failed snapshot leaves the day unmarked and gets another
 * attempt.
 */
export async function maybeDailySnapshot(): Promise<void> {
  const today = format(new Date(), "yyyy-MM-dd");
  const key = lastDailyKey();
  if (getItem(key) === today) return;
  // Nothing to protect on a fresh install.
  if ((await db.profile.count()) === 0) return;
  await createSnapshotOrThrow("daily");
  setItem(key, today);
}
