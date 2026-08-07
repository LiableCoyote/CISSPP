import { describe, it, expect } from "vitest";
import {
  PACE_ARCHETYPES,
  PACE_METRICS,
  paceValueAt,
  type PaceMetric,
} from "./pacing";
import { CAMPAIGN_WEEKS } from "../lib/campaign";

describe("PACE_ARCHETYPES data", () => {
  // paceValueAt indexes domainsMasteredByWeek[week - 1] with no bounds check,
  // so a short array would silently return undefined.
  it.each(PACE_ARCHETYPES.map((a) => [a.id, a] as const))(
    "%s covers every campaign week",
    (_id, a) => {
      expect(a.domainsMasteredByWeek).toHaveLength(CAMPAIGN_WEEKS);
      expect(a.domainsMasteredByWeek.every((n) => Number.isInteger(n) && n >= 0 && n <= 8)).toBe(true);
    },
  );

  it("has unique ids", () => {
    expect(new Set(PACE_ARCHETYPES.map((a) => a.id)).size).toBe(PACE_ARCHETYPES.length);
  });
});

describe("paceValueAt", () => {
  const metrics = PACE_METRICS.map((m) => m.key);
  const exemplar = PACE_ARCHETYPES[0];

  it.each(metrics.map((m) => [m] as const))("%s is a finite number for every week", (metric) => {
    for (let w = 1; w <= CAMPAIGN_WEEKS; w++) {
      for (const a of PACE_ARCHETYPES) {
        const v = paceValueAt(a, metric as PaceMetric, w);
        expect(Number.isFinite(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("never claims a longer streak than the campaign has days", () => {
    for (let w = 1; w <= CAMPAIGN_WEEKS; w++) {
      expect(paceValueAt(exemplar, "streak", w)).toBeLessThanOrEqual(w * 7);
    }
  });

  it("caps achievements at the number that exist", () => {
    expect(paceValueAt(exemplar, "achievements", CAMPAIGN_WEEKS)).toBeLessThanOrEqual(29);
  });

  it("clamps weeks outside the campaign", () => {
    expect(paceValueAt(exemplar, "xp", 0)).toBe(paceValueAt(exemplar, "xp", 1));
    expect(paceValueAt(exemplar, "xp", 99)).toBe(paceValueAt(exemplar, "xp", CAMPAIGN_WEEKS));
  });

  it("grows monotonically with the week", () => {
    for (const metric of metrics) {
      let prev = -1;
      for (let w = 1; w <= CAMPAIGN_WEEKS; w++) {
        const v = paceValueAt(exemplar, metric as PaceMetric, w);
        expect(v).toBeGreaterThanOrEqual(prev);
        prev = v;
      }
    }
  });
});
