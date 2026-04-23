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
    version: 1,
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

export async function importData(json: string) {
  const data = JSON.parse(json);

  if (data.version !== 1) {
    throw new Error("Unsupported export version");
  }

  // Clear existing data
  await Promise.all([
    db.profile.clear(),
    db.domains.clear(),
    db.quests.clear(),
    db.flashcards.clear(),
    db.questions.clear(),
    db.attempts.clear(),
    db.answers.clear(),
    db.studyLog.clear(),
    db.achievements.clear(),
    db.notes.clear(),
    db.resources.clear(),
  ]);

  // Import
  await Promise.all([
    db.profile.bulkAdd(data.profile || []),
    db.domains.bulkAdd(data.domains || []),
    db.quests.bulkAdd(data.quests || []),
    db.flashcards.bulkAdd(data.flashcards || []),
    db.questions.bulkAdd(data.questions || []),
    db.attempts.bulkAdd(data.attempts || []),
    db.answers.bulkAdd(data.answers || []),
    db.studyLog.bulkAdd(data.studyLog || []),
    db.achievements.bulkAdd(data.achievements || []),
    db.notes.bulkAdd(data.notes || []),
    db.resources.bulkAdd(data.resources || []),
  ]);
}
