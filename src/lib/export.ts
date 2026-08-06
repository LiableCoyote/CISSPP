import { db } from "../db/schema";

export async function exportData() {
  const [profile, domains, quests, flashcards, questions, attempts, answers, studyLog, achievements, notes, resources] =
    await Promise.all([
      db.profile.toArray(),
      db.domains.toArray(),
      db.quests.toArray(),
      db.flashcards.toArray(),
      db.questions.toArray(),
      db.attempts.toArray(),
      db.answers.toArray(),
      db.studyLog.toArray(),
      db.achievements.toArray(),
      db.notes.toArray(),
      db.resources.toArray(),
    ]);

  return {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    profile,
    domains,
    quests,
    flashcards,
    questions,
    attempts,
    answers,
    studyLog,
    achievements,
    notes,
    resources,
  };
}

export const EXPORT_VERSION = 1;

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
] as const;

type BackupTable = (typeof BACKUP_TABLES)[number];
type Backup = { version: number } & Record<BackupTable, unknown[]>;

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

  if (obj.version !== EXPORT_VERSION) {
    throw new Error(
      `Unsupported export version ${String(obj.version)} — this app reads version ${EXPORT_VERSION}.`,
    );
  }

  for (const table of BACKUP_TABLES) {
    const value = obj[table];
    if (value !== undefined && !Array.isArray(value)) {
      throw new Error(`Backup is malformed: "${table}" should be a list.`);
    }
  }

  const totalRows = BACKUP_TABLES.reduce(
    (sum, table) => sum + (Array.isArray(obj[table]) ? (obj[table] as unknown[]).length : 0),
    0,
  );
  if (totalRows === 0) {
    throw new Error("Backup is empty — refusing to replace your data with nothing.");
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
}
