import { format } from "date-fns";
import { db, type Snapshot } from "../db/schema";
import { exportData, importData } from "./export";
import { getItem, setItem } from "./safeStorage";

const MAX_SNAPSHOTS = 3;
const LAST_DAILY_KEY = "cisspp-last-snapshot-day";

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
export async function createSnapshot(reason: Snapshot["reason"]): Promise<Snapshot | null> {
  try {
    const payload = JSON.stringify(await exportData());
    const snapshot: Snapshot = {
      id: `snap-${Date.now()}`,
      createdAt: new Date().toISOString(),
      reason,
      payload,
      sizeBytes: payload.length,
    };
    await db.snapshots.put(snapshot);

    // Keep only the newest few — this data is a safety net, not an archive.
    const all = await db.snapshots.orderBy("createdAt").reverse().toArray();
    const stale = all.slice(MAX_SNAPSHOTS);
    if (stale.length > 0) await db.snapshots.bulkDelete(stale.map((s) => s.id));

    return snapshot;
  } catch (err) {
    // A snapshot failing must never block the action it was protecting; the
    // caller decides whether to continue without one.
    console.error("Snapshot failed:", err);
    return null;
  }
}

export async function listSnapshots(): Promise<Snapshot[]> {
  return db.snapshots.orderBy("createdAt").reverse().toArray();
}

export async function restoreSnapshot(id: string): Promise<void> {
  const snap = await db.snapshots.get(id);
  if (!snap) throw new Error("That snapshot no longer exists.");
  // Take one of the current state first, so restoring is itself undoable.
  await createSnapshot("pre-import");
  await importData(snap.payload);
}

/** Takes at most one snapshot per day, on first launch. */
export async function maybeDailySnapshot(): Promise<void> {
  const today = format(new Date(), "yyyy-MM-dd");
  if (getItem(LAST_DAILY_KEY) === today) return;
  // Nothing to protect on a fresh install.
  if ((await db.profile.count()) === 0) return;
  await createSnapshot("daily");
  setItem(LAST_DAILY_KEY, today);
}
