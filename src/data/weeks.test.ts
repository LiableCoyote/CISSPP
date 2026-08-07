import { describe, it, expect } from "vitest";
import { QUEST_SEEDS, WEEK_META } from "./weeks";

describe("QUEST_SEEDS", () => {
  it("has unique ids", () => {
    const ids = QUEST_SEEDS.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  /**
   * Quest ids are derived from the title, and syncSeedContent backfills by id.
   * That means renaming a quest silently mints a *new* quest for existing users
   * while orphaning their completion of the old one — and week-clear badges
   * count whatever is in the database.
   *
   * This pins the ids. If it fails because a title changed, either restore the
   * title or add an explicit migration that re-keys the existing row; do not
   * simply update the snapshot.
   */
  it("has stable ids — a failure here means a title change would orphan user progress", () => {
    expect(QUEST_SEEDS.map((q) => q.id)).toMatchSnapshot();
  });

  it("covers every week in WEEK_META", () => {
    const weeks = new Set(QUEST_SEEDS.map((q) => q.week));
    for (const meta of WEEK_META) expect(weeks.has(meta.week)).toBe(true);
  });

  it("uses weeks 1-8 and days 1-7", () => {
    for (const q of QUEST_SEEDS) {
      expect(q.week).toBeGreaterThanOrEqual(1);
      expect(q.week).toBeLessThanOrEqual(8);
      expect(q.day).toBeGreaterThanOrEqual(1);
      expect(q.day).toBeLessThanOrEqual(7);
    }
  });

  it("awards non-negative XP", () => {
    expect(QUEST_SEEDS.every((q) => q.xp >= 0)).toBe(true);
  });
});
