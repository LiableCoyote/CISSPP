import type { DomainId, QuizAnswer } from "../db/schema";
import { DOMAINS } from "../data/domains";
import type { Recommendation } from "./recommendations";

/**
 * Turns misses into a next action rather than a tally.
 *
 * The Stats page already drew a pie of mindset / knowledge / misread. A pie
 * tells you the shape of the problem and nothing about what to do next, and the
 * three categories want genuinely different responses: mindset misses mean
 * drilling sequences, knowledge misses mean reading the material, misread
 * misses mean slowing down.
 *
 * Reads the automatic flags as well as the manual category. Categorising a miss
 * is optional and most people never do it, so a rule keyed only on
 * `missCategory` would be empty for exactly the users who need it — but
 * `flaggedMindset` and `flaggedSpeed` are recorded on every answer without
 * anyone having to opt in.
 */

/** Below this a pattern is just a couple of bad questions. */
export const MIN_MISSES = 6;
/** Share of misses a category needs before it is worth naming. */
const DOMINANT_SHARE = 0.4;
/** A single domain holding this much of the knowledge misses is a hot spot. */
const DOMAIN_CONCENTRATION = 0.35;

export type MissBreakdown = {
  total: number;
  mindset: number;
  knowledge: number;
  misread: number;
  /** Domain id -> count, for misses attributable to knowledge gaps. */
  byDomain: Map<DomainId, number>;
};

/**
 * Classifies every miss exactly once.
 *
 * The manual category wins where present. Otherwise the automatic flags decide,
 * and anything left is treated as a knowledge gap — the default is deliberate:
 * an uncategorised miss with no behavioural flag is most simply explained by
 * not knowing the answer.
 */
export function breakdownMisses(
  answers: readonly QuizAnswer[],
  domainOf: (questionId: string) => DomainId | undefined,
): MissBreakdown {
  const out: MissBreakdown = {
    total: 0,
    mindset: 0,
    knowledge: 0,
    misread: 0,
    byDomain: new Map(),
  };

  for (const a of answers) {
    if (a.correct) continue;
    out.total += 1;

    let kind: "mindset" | "knowledge" | "misread";
    if (a.missCategory) {
      kind = a.missCategory;
    } else if (a.flaggedMindset) {
      kind = "mindset";
    } else if (a.flaggedSpeed) {
      kind = "misread";
    } else {
      kind = "knowledge";
    }
    out[kind] += 1;

    if (kind === "knowledge") {
      const d = domainOf(a.questionId);
      if (d !== undefined) out.byDomain.set(d, (out.byDomain.get(d) ?? 0) + 1);
    }
  }

  return out;
}

/**
 * Ranked remediation actions, in the shape the dashboard already renders.
 *
 * Returned as `Recommendation`s so these flow through `buildRecommendations`
 * into the existing Next Up card. A second competing "what to do next" surface
 * would fragment the one place the user already looks.
 */
export function buildRemediation(breakdown: MissBreakdown): Recommendation[] {
  if (breakdown.total < MIN_MISSES) return [];

  const recs: Recommendation[] = [];
  const share = (n: number) => n / breakdown.total;

  if (share(breakdown.mindset) >= DOMINANT_SHARE) {
    recs.push({
      id: "remediate-mindset",
      icon: "🧠",
      title: `${breakdown.mindset} of your ${breakdown.total} misses are mindset`,
      body: "You're reaching for the technical fix before the governance one. The Vault sequences drill the order the exam expects.",
      to: "/vault",
      actionLabel: "Drill the sequences",
      // Above the generic weak-domain drill (92): knowing the material does not
      // help if the answer picked is still the technician's.
      priority: 94,
    });
  }

  if (share(breakdown.misread) >= DOMINANT_SHARE) {
    recs.push({
      id: "remediate-misread",
      icon: "🐢",
      title: `${breakdown.misread} of your ${breakdown.total} misses are misreads`,
      body: "These aren't knowledge gaps — you're answering before you've finished the stem. Your pacing breakdown shows where.",
      to: "/stats",
      actionLabel: "See your pacing",
      priority: 90,
    });
  }

  // Knowledge misses only earn a callout when they cluster; spread evenly they
  // just mean "keep studying", which is not advice.
  const hotspot = [...breakdown.byDomain.entries()].sort((a, b) => b[1] - a[1])[0];
  if (hotspot && breakdown.knowledge > 0 && hotspot[1] / breakdown.knowledge >= DOMAIN_CONCENTRATION) {
    const [domainId, count] = hotspot;
    const name = DOMAINS.find((d) => d.id === domainId)?.name ?? `Domain ${domainId}`;
    recs.push({
      id: `remediate-knowledge-${domainId}`,
      icon: "📚",
      title: `${count} knowledge misses in D${domainId}`,
      body: `${name} is where you're losing marks to material you haven't got yet. Read it, then retest.`,
      to: `/domains/${domainId}`,
      actionLabel: "Review this domain",
      priority: 89,
    });
  }

  return recs;
}
