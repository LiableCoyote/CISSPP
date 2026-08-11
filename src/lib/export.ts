import { db } from "../db/schema";
import { getItem, setItem } from "./safeStorage";

/**
 * v2 adds the `vaultWins` store and a `settings` block.
 * v3 adds `questionReviews` — the spaced-repetition schedule for missed
 * questions. Omitting it would have silently dropped that schedule on every
 * restore, which reads as "the app forgot everything I got wrong".
 *
 * v1 and v2 files remain readable: the newer tables are simply absent, and the
 * restore treats them as empty. Rejecting old files here would strand every
 * backup a user has already downloaded.
 */
export const EXPORT_VERSION = 3;
const OLDEST_READABLE_VERSION = 1;

/** Table names carried in a backup, in the order they are restored. */
const BACKUP_TABLES = [
  "profile",
  "domains",
  "quests",
  "flashcards",
  "questions",
  "attempts",
  "answers",
  "studyLog",
  "achievements",
  "notes",
  "resources",
  "vaultWins",
  "questionReviews",
] as const;

/** localStorage keys worth carrying across devices. Slot-scoped keys are not. */
const SETTINGS_KEYS = ["cisspp-reminder-enabled", "cisspp-reminder-time"] as const;

type BackupTable = (typeof BACKUP_TABLES)[number];
type Backup = { version: number; settings?: Record<string, string> } & Record<
  BackupTable,
  unknown[]
>;

export async function exportData() {
  const tables = await Promise.all(BACKUP_TABLES.map((name) => db.table(name).toArray()));

  const settings: Record<string, string> = {};
  for (const key of SETTINGS_KEYS) {
    const value = getItem(key);
    if (value !== null) settings[key] = value;
  }

  const payload: Record<string, unknown> = {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    settings,
  };
  BACKUP_TABLES.forEach((name, i) => {
    payload[name] = tables[i];
  });
  return payload;
}

/**
 * Checks a parsed backup before anything touches the database.
 *
 * This runs first and throws on anything suspicious, because the restore that
 * follows is destructive: previously the tables were cleared before the payload
 * was inspected, so a file containing nothing but `{"version":1}` silently wiped
 * every record with no way back.
 */
export function validateBackup(data: unknown): asserts data is Backup {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new Error("Not a valid backup file — expected a JSON object.");
  }

  const obj = data as Record<string, unknown>;
  const version = obj.version;

  if (typeof version !== "number" || version < OLDEST_READABLE_VERSION || version > EXPORT_VERSION) {
    throw new Error(
      `Unsupported export version ${String(version)} — this app reads versions ` +
        `${OLDEST_READABLE_VERSION} to ${EXPORT_VERSION}.`,
    );
  }

  for (const table of BACKUP_TABLES) {
    const value = obj[table];
    if (value !== undefined && !Array.isArray(value)) {
      throw new Error(`Backup is malformed: "${table}" should be a list.`);
    }
  }

  if (
    obj.settings !== undefined &&
    (typeof obj.settings !== "object" || obj.settings === null || Array.isArray(obj.settings))
  ) {
    throw new Error(`Backup is malformed: "settings" should be an object.`);
  }

  const totalRows = BACKUP_TABLES.reduce(
    (sum, table) => sum + (Array.isArray(obj[table]) ? (obj[table] as unknown[]).length : 0),
    0,
  );
  if (totalRows === 0) {
    throw new Error("Backup is empty — refusing to replace your data with nothing.");
  }

  // A backup with no profile row imports "successfully" and then vanishes: the
  // reload finds no profile, initializeDb treats it as a fresh install, and
  // re-seeds over the top. Reject it rather than silently discarding the file.
  const profile = obj.profile;
  if (!Array.isArray(profile) || profile.length !== 1) {
    throw new Error("Backup is missing its profile — this doesn't look like a CISSPP export.");
  }
}

export async function importData(json: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("That file isn't valid JSON.");
  }

  validateBackup(parsed);
  const data = parsed;

  // One transaction over every store: if any write fails, Dexie rolls the
  // clears back too, so a failed restore leaves the existing data intact.
  await db.transaction("rw", db.tables, async () => {
    for (const table of BACKUP_TABLES) {
      await db.table(table).clear();
    }
    for (const table of BACKUP_TABLES) {
      const rows = data[table];
      if (Array.isArray(rows) && rows.length > 0) {
        await db.table(table).bulkAdd(rows);
      }
    }
  });

  // Settings live in localStorage, outside the transaction. Applied last so a
  // failed restore doesn't leave them pointing at data that was rolled back.
  if (data.settings) {
    for (const key of SETTINGS_KEYS) {
      const value = data.settings[key];
      if (typeof value === "string") setItem(key, value);
    }
  }
}
