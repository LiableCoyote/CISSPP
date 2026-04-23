import type { DomainId, Quest } from "../db/schema";

type QuestSeed = Omit<Quest, "completedAt" | "minutesLogged">;

const Q = (
  week: number,
  day: number,
  title: string,
  description: string,
  domainIds: DomainId[],
  type: Quest["type"],
  xp: number,
): QuestSeed => ({
  id: `w${week}-d${day}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}`,
  week,
  day,
  title,
  description,
  domainIds,
  xp,
  type,
});

export const WEEK_META: {
  week: number;
  title: string;
  focus: string;
  domainIds: DomainId[];
  isBossWeek: boolean;
  bossKind?: "week-quiz" | "full-exam";
  target?: string;
}[] = [
  {
    week: 1,
    title: "Foundation: Risk & Data",
    focus: "Domains 1 & 2 — set the mindset, start the flashcard deck.",
    domainIds: [1, 2],
    isBossWeek: true,
    bossKind: "week-quiz",
  },
  {
    week: 2,
    title: "Architecture & Network",
    focus: "Domains 3 & 4 — crypto gets a whole evening. OSI cold.",
    domainIds: [3, 4],
    isBossWeek: true,
    bossKind: "week-quiz",
  },
  {
    week: 3,
    title: "Sprint Through Four",
    focus: "Domains 5, 6, 7, 8 — familiarity, not mastery.",
    domainIds: [5, 6, 7, 8],
    isBossWeek: true,
    bossKind: "week-quiz",
  },
  {
    week: 4,
    title: "First Boss: Full Exam",
    focus: "150-question simulation + gap analysis.",
    domainIds: [1, 2, 3, 4, 5, 6, 7, 8],
    isBossWeek: true,
    bossKind: "full-exam",
    target: "Diagnostic — no score target.",
  },
  {
    week: 5,
    title: "Cross-Domain Thinking",
    focus: "Weak-domain remediation + inter-domain connections.",
    domainIds: [1, 2, 3, 4, 5, 6, 7, 8],
    isBossWeek: false,
  },
  {
    week: 6,
    title: "Second Boss: Surgical Fixes",
    focus: "Full exam #2. Target: 70%+ overall, no domain below 60%.",
    domainIds: [1, 2, 3, 4, 5, 6, 7, 8],
    isBossWeek: true,
    bossKind: "full-exam",
    target: "70%+ overall, no domain <60%.",
  },
  {
    week: 7,
    title: "Endurance Mode",
    focus: "Full exam #3. Target: 75%+ overall, no domain below 65%.",
    domainIds: [1, 2, 3, 4, 5, 6, 7, 8],
    isBossWeek: true,
    bossKind: "full-exam",
    target: "75%+ overall, no domain <65%.",
  },
  {
    week: 8,
    title: "Final Prep & Exam Day",
    focus: "Light review only. Rest. Execute.",
    domainIds: [1, 2, 3, 4, 5, 6, 7, 8],
    isBossWeek: false,
  },
];

export const QUEST_SEEDS: QuestSeed[] = [
  // WEEK 1 - Domain 1 & 2
  Q(1, 1, "Watch DestCert Domain 1 MindMap (video 1)", "Core risk and governance concepts.", [1], "watch", 20),
  Q(1, 1, "Read cissprep.net Domain 1", "Glossary + quick reference.", [1], "read", 15),
  Q(1, 1, "Start flashcard deck", "Add SLE, ALE, quant vs qual risk cards.", [1], "flashcards", 10),
  Q(1, 2, "Watch DestCert Domain 1 MindMap (video 2)", "BCP/DRP lifecycle & governance.", [1], "watch", 20),
  Q(1, 2, "Memorize risk formulas", "SLE = AV × EF. ALE = SLE × ARO.", [1], "review", 10),
  Q(1, 3, "Watch DestCert Domain 1 MindMap (video 3)", "Legal/regulatory — GDPR, HIPAA, SOX.", [1], "watch", 20),
  Q(1, 3, "Flashcard review", "Cycle all Domain 1 cards.", [1], "flashcards", 10),
  Q(1, 4, "Watch DestCert Domain 2 MindMap (video 1)", "Data classification schemes.", [2], "watch", 20),
  Q(1, 4, "Read cissprep.net Domain 2", "Data lifecycle & roles.", [2], "read", 15),
  Q(1, 5, "Watch DestCert Domain 2 MindMap (video 2)", "Data remanence, destruction, PII/PHI.", [2], "watch", 20),
  Q(1, 5, "Add data-role flashcards", "Owner, custodian, processor, controller.", [2], "flashcards", 10),
  Q(1, 6, "Quantum: Domain 1 quiz (25 Q)", "First quiz. Diagnostic only.", [1], "quiz", 30),
  Q(1, 6, "Quantum: Domain 2 quiz (25 Q)", "Flag every miss into the flashcard deck.", [2], "quiz", 30),
  Q(1, 7, "Review all misses from Week 1", "Trace WHY you got each wrong.", [1, 2], "review", 25),

  // WEEK 2 - Domain 3 & 4
  Q(2, 1, "Watch DestCert Domain 3 MindMap (video 1-2)", "Security models + protection rings.", [3], "watch", 25),
  Q(2, 1, "Security models flashcards", "Bell-LaPadula, Biba, Clark-Wilson, Brewer-Nash.", [3], "flashcards", 10),
  Q(2, 2, "Watch DestCert Domain 3 MindMap (video 3-4)", "Cryptography — the hard one.", [3], "watch", 25),
  Q(2, 2, "Crypto deep dive", "Symmetric vs asymmetric, PKI, digital signatures.", [3], "read", 20),
  Q(2, 3, "Read cissprep.net Domain 3", "Zero trust + cloud shared responsibility.", [3], "read", 15),
  Q(2, 3, "Flashcard review", "All Domain 3 cards.", [3], "flashcards", 10),
  Q(2, 4, "Watch DestCert Domain 4 MindMap (video 1-2)", "OSI model — know every layer cold.", [4], "watch", 25),
  Q(2, 4, "OSI model flashcards", "All 7 layers + protocols.", [4], "flashcards", 10),
  Q(2, 5, "Watch DestCert Domain 4 MindMap (video 3-4)", "Firewalls, VPN, wireless, DNS.", [4], "watch", 25),
  Q(2, 5, "Read cissprep.net Domain 4", "IPsec vs TLS, WPA3, SDN.", [4], "read", 15),
  Q(2, 6, "Quantum: Domain 3 quiz (30 Q)", "Crypto is scored hardest.", [3], "quiz", 35),
  Q(2, 6, "Quantum: Domain 4 quiz (30 Q)", "Update flashcards on misses.", [4], "quiz", 35),
  Q(2, 7, "Crypto remediation", "If D3 was rough, spend an hour on PKI here.", [3], "review", 30),

  // WEEK 3 - Domains 5-8
  Q(3, 1, "Watch DestCert Domain 5 MindMap (all)", "Auth factors, SSO, access control models.", [5], "watch", 25),
  Q(3, 1, "SSO protocol flashcards", "SAML, OAuth, OIDC, Kerberos.", [5], "flashcards", 10),
  Q(3, 2, "Watch DestCert Domain 6 MindMap (all)", "Vuln vs pentest, SOC 1/2/3, KPIs/KRIs.", [6], "watch", 25),
  Q(3, 2, "Read cissprep.net Domains 5 & 6", "Quick reference.", [5, 6], "read", 20),
  Q(3, 3, "Watch DestCert Domain 7 MindMap (all)", "NIST 800-61 incident response lifecycle.", [7], "watch", 25),
  Q(3, 3, "IR lifecycle flashcards", "Prep → Detect → Contain/Eradicate/Recover → Post.", [7], "flashcards", 10),
  Q(3, 4, "Watch DestCert Domain 8 MindMap (all)", "SDLC, OWASP Top 10, AI/ML security.", [8], "watch", 25),
  Q(3, 4, "Read cissprep.net Domains 7 & 8", "Quick reference.", [7, 8], "read", 20),
  Q(3, 5, "Review flashcard deck end-to-end", "Every card, one pass.", [1, 2, 3, 4, 5, 6, 7, 8], "flashcards", 20),
  Q(3, 6, "Quantum: Domain 5 quiz (25 Q)", "Update flashcards on misses.", [5], "quiz", 25),
  Q(3, 6, "Quantum: Domain 6 quiz (25 Q)", "Update flashcards on misses.", [6], "quiz", 25),
  Q(3, 7, "Quantum: Domain 7 quiz (25 Q)", "Update flashcards on misses.", [7], "quiz", 25),
  Q(3, 7, "Quantum: Domain 8 quiz (25 Q)", "Flag your two weakest domains.", [8], "quiz", 25),

  // WEEK 4 - First full exam + gap analysis
  Q(4, 1, "FULL EXAM #1 (150 Q / 3 hr)", "BOSS. Timed, no breaks, no phone. Simulate the real thing.", [1, 2, 3, 4, 5, 6, 7, 8], "exam", 100),
  Q(4, 2, "Review every wrong answer", "Trace why — mindset / knowledge / misread?", [1, 2, 3, 4, 5, 6, 7, 8], "review", 40),
  Q(4, 3, "Categorize every miss", "Add concepts to flashcards. Flag mindset patterns.", [1, 2, 3, 4, 5, 6, 7, 8], "review", 30),
  Q(4, 4, "Deep dive: weakest domain #1", "Re-watch DestCert. Re-read cissprep.", [1, 2, 3, 4, 5, 6, 7, 8], "watch", 30),
  Q(4, 4, "Targeted 40 Q in weakest domain #1", "Domain drill.", [1, 2, 3, 4, 5, 6, 7, 8], "quiz", 35),
  Q(4, 5, "Deep dive: weakest domain #2", "Re-watch DestCert. Re-read cissprep.", [1, 2, 3, 4, 5, 6, 7, 8], "watch", 30),
  Q(4, 6, "Targeted 40 Q in weakest domain #2", "Domain drill.", [1, 2, 3, 4, 5, 6, 7, 8], "quiz", 35),
  Q(4, 7, "Flashcard deck — full pass", "Review every card end-to-end.", [1, 2, 3, 4, 5, 6, 7, 8], "flashcards", 25),

  // WEEK 5 - Reinforce + cross-domain
  Q(5, 1, "50 Q drill in weak domain #1", "Continue remediation.", [1, 2, 3, 4, 5, 6, 7, 8], "quiz", 35),
  Q(5, 2, "50 Q drill in weak domain #2", "Continue remediation.", [1, 2, 3, 4, 5, 6, 7, 8], "quiz", 35),
  Q(5, 3, "Cross-domain: Risk → Controls → Testing → Ops", "D1 → D3 → D6 → D7 chain.", [1, 3, 6, 7], "review", 25),
  Q(5, 4, "Cross-domain: Data → Encryption → Access → Audit", "D2 → D4 → D5 → D6 chain.", [2, 4, 5, 6], "review", 25),
  Q(5, 5, "Cross-domain: IR → Evidence → Legal", "D7 → D7 → D1 chain.", [1, 7], "review", 20),
  Q(5, 5, "Cross-domain: SDLC → Vuln testing → Change mgmt", "D8 → D6 → D7 chain.", [6, 7, 8], "review", 20),
  Q(5, 6, "75-question mixed-domain timed set", "Boss warm-up.", [1, 2, 3, 4, 5, 6, 7, 8], "quiz", 45),
  Q(5, 7, "Review all wrong answers + flashcard update", "Pre-boss deep clean.", [1, 2, 3, 4, 5, 6, 7, 8], "review", 30),

  // WEEK 6 - Second full exam + surgical fixes
  Q(6, 1, "FULL EXAM #2 (150 Q / 3 hr)", "BOSS. Target: 70%+ overall, no domain <60%.", [1, 2, 3, 4, 5, 6, 7, 8], "exam", 100),
  Q(6, 2, "Miss analysis by TYPE", "Group mistakes: mindset / knowledge / misread.", [1, 2, 3, 4, 5, 6, 7, 8], "review", 40),
  Q(6, 3, "Subtopic drill: PKI / BCP / hot subtopic", "Go sub-topic, not whole-domain.", [1, 2, 3, 4, 5, 6, 7, 8], "review", 30),
  Q(6, 4, "Targeted 30-40 Q on the specific subtopics", "Drill what's broken, nothing else.", [1, 2, 3, 4, 5, 6, 7, 8], "quiz", 30),
  Q(6, 5, "Fix subtopics day 2", "Continue surgical fixes.", [1, 2, 3, 4, 5, 6, 7, 8], "review", 25),
  Q(6, 6, "50 mixed-domain questions", "Calibration.", [1, 2, 3, 4, 5, 6, 7, 8], "quiz", 35),
  Q(6, 7, "Flashcard deck prune", "Remove cards you now know cold. Focus on stubborn ones.", [1, 2, 3, 4, 5, 6, 7, 8], "flashcards", 20),

  // WEEK 7 - Simulation mode
  Q(7, 1, "FULL EXAM #3 (150 Q / 3 hr)", "BOSS. Target: 75%+ overall, no domain <65%.", [1, 2, 3, 4, 5, 6, 7, 8], "exam", 100),
  Q(7, 2, "Review wrong answers only", "Don't touch correct ones.", [1, 2, 3, 4, 5, 6, 7, 8], "review", 30),
  Q(7, 3, "Flashcard full pass", "End-to-end.", [1, 2, 3, 4, 5, 6, 7, 8], "flashcards", 25),
  Q(7, 4, "ISC2 outline walkthrough", "Can you explain each subtopic in your own words?", [1, 2, 3, 4, 5, 6, 7, 8], "read", 30),
  Q(7, 5, "50 Q mixed timed set (60 min)", "Light.", [1, 2, 3, 4, 5, 6, 7, 8], "quiz", 30),
  Q(7, 6, "Rest day", "Do not study. Recover.", [], "rest", 10),
  Q(7, 7, "Memorization tables lock-in", "Every formula, model, protocol.", [1, 2, 3, 4, 5, 6, 7, 8], "review", 30),

  // WEEK 8 - Final prep & exam day
  Q(8, 1, "Flashcards — final pass", "Light.", [1, 2, 3, 4, 5, 6, 7, 8], "flashcards", 15),
  Q(8, 2, "cissprep.net quick ref for two weakest domains", "Last read.", [1, 2, 3, 4, 5, 6, 7, 8], "read", 20),
  Q(8, 3, "REST DAY", "Light walk. Good meal. Confirm Pearson VUE.", [], "rest", 10),
  Q(8, 4, "EXAM DAY", "Arrive 30 min early. Take your time on Q1-25.", [1, 2, 3, 4, 5, 6, 7, 8], "exam", 200),
];
