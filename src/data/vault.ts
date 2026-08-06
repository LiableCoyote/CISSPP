export type VaultTable = {
  id: string;
  title: string;
  intro: string;
  columns: string[];
  rows: string[][];
  hint?: string;
};

export const VAULT_TABLES: VaultTable[] = [
  {
    id: "risk-formulas",
    title: "Risk Formulas",
    intro: "If you can't reproduce these cold, you're not ready.",
    columns: ["Formula", "Definition"],
    rows: [
      ["SLE = AV × EF", "Single Loss Expectancy = Asset Value × Exposure Factor"],
      ["ALE = SLE × ARO", "Annualized Loss = Single Loss × Annualized Rate of Occurrence"],
      ["Total Risk = Threats × Vulns × AV", "Pre-control exposure"],
      ["Residual Risk = Total Risk − Controls", "What's left after mitigation"],
    ],
  },
  {
    id: "security-models",
    title: "Security Models",
    intro: "Two columns carry you: what it protects, what the rule is.",
    columns: ["Model", "Protects", "Rule"],
    rows: [
      ["Bell-LaPadula", "Confidentiality", "No read up, no write down"],
      ["Biba", "Integrity", "No read down, no write up"],
      ["Clark-Wilson", "Integrity", "Well-formed transactions + SoD"],
      ["Brewer-Nash", "Confidentiality", "No conflict of interest (Chinese Wall)"],
    ],
  },
  {
    id: "recovery-metrics",
    title: "Recovery Metrics",
    intro: "RPO vs RTO gets traps. RPO = data, RTO = time.",
    columns: ["Metric", "Meaning"],
    rows: [
      ["RPO", "How much DATA you can afford to lose (time)"],
      ["RTO", "How QUICKLY systems must be restored"],
      ["MTBF", "Average time between failures"],
      ["MTTR", "Average time to repair after failure"],
    ],
  },
  {
    id: "access-models",
    title: "Access Control Models",
    intro: "Know the one-liner for each.",
    columns: ["Model", "Summary"],
    rows: [
      ["DAC", "Owner decides access — most flexible, least secure"],
      ["MAC", "Labels + clearances — government/military default"],
      ["RBAC", "Role determines access — most common in enterprise"],
      ["ABAC", "Attributes + rules — most granular"],
    ],
  },
  {
    id: "crypto",
    title: "Crypto Quick Reference",
    intro: "Use case → algorithm.",
    columns: ["Type", "Algorithms / Notes"],
    rows: [
      ["Symmetric", "AES (128/192/256). 3DES legacy only."],
      ["Asymmetric", "RSA, ECC, Diffie-Hellman (key exchange only — no encryption)"],
      ["Hashing", "SHA-256/384/512, SHA-3. Never MD5 or SHA-1 for security."],
      ["Digital Signature", "Hash the message → encrypt hash with SENDER'S private key"],
    ],
  },
  {
    id: "auth-protocols",
    title: "Authentication Protocols",
    intro: "One sentence per row. Drill the differences.",
    columns: ["Protocol", "Type", "Remember"],
    rows: [
      ["Kerberos", "Ticket-based SSO", "KDC = AS + TGS. Port 88. Symmetric."],
      ["SAML", "XML federation", "SSO for web apps. Uses assertions."],
      ["OAuth 2.0", "Authorization", "NOT authentication. Token-based."],
      ["OpenID Connect", "Authentication", "Built on top of OAuth 2.0."],
      ["RADIUS", "Network AAA", "Encrypts password only. UDP."],
      ["TACACS+", "Network AAA", "Cisco. Encrypts full payload. Separates AAA."],
    ],
  },
  {
    id: "control-types",
    title: "Control Types & Functions",
    intro: "Exams love 'which TYPE of control'. Type = how it's built. Function = what it does.",
    columns: ["Category", "Examples"],
    rows: [
      ["Administrative", "Policy, procedure, hiring, training, background checks"],
      ["Technical (Logical)", "Firewall, encryption, IDS, ACL, MFA"],
      ["Physical", "Fence, guard, mantrap, lock, CCTV, bollard"],
      ["Preventive", "Stops it before it happens — lock, firewall, training"],
      ["Detective", "Finds it after — IDS, audit log, CCTV review"],
      ["Corrective", "Fixes it — patch, restore from backup, quarantine"],
      ["Deterrent", "Discourages — warning sign, visible camera"],
      ["Compensating", "Alternative when the primary control isn't feasible"],
    ],
  },
  {
    id: "raid",
    title: "RAID Levels",
    intro: "Availability question bait. Know parity vs mirroring vs striping.",
    columns: ["Level", "Technique", "Fault tolerance"],
    rows: [
      ["RAID 0", "Striping only", "NONE — pure performance"],
      ["RAID 1", "Mirroring", "1 disk; 50% capacity cost"],
      ["RAID 5", "Striping + distributed parity", "1 disk"],
      ["RAID 6", "Striping + double parity", "2 disks"],
      ["RAID 10", "Mirror then stripe", "1 per mirrored pair; best performance + tolerance"],
    ],
  },
  {
    id: "bcp-sites",
    title: "Recovery Site Types",
    intro: "Cost and recovery time move in opposite directions.",
    columns: ["Site", "Ready in", "Cost"],
    rows: [
      ["Hot", "Minutes to hours — live data, running systems", "Highest"],
      ["Warm", "Hours to days — hardware ready, data must be restored", "Medium"],
      ["Cold", "Weeks — power and space only", "Lowest"],
      ["Mobile", "Varies — trailer/container brought on site", "Medium"],
      ["Reciprocal", "Agreement with another org — legally weak, rarely tested", "Very low"],
    ],
  },
  {
    id: "laws-regs",
    title: "Laws & Regulations",
    intro: "Match the acronym to the data it protects.",
    columns: ["Law / Reg", "Covers"],
    rows: [
      ["GDPR", "EU personal data. 72-hour breach notification. Right to erasure."],
      ["HIPAA", "US protected health information (PHI)"],
      ["PCI DSS", "Payment card data — a contract standard, not a law"],
      ["SOX", "US public company financial reporting integrity"],
      ["GLBA", "US financial institution customer privacy"],
      ["FERPA", "US student education records"],
      ["COPPA", "US children under 13 online"],
    ],
  },
  {
    id: "attack-types",
    title: "Attack Types",
    intro: "The distinguishing detail is what the question hinges on.",
    columns: ["Attack", "Tell"],
    rows: [
      ["Phishing / Spear / Whaling", "Broad → targeted → targets executives"],
      ["SQL Injection", "Unsanitized input reaches the database engine"],
      ["XSS", "Attacker script runs in ANOTHER user's browser"],
      ["CSRF", "Victim's authenticated session is used without their intent"],
      ["Race condition (TOCTOU)", "State changes between check and use"],
      ["Privilege escalation", "Low-privilege foothold becomes admin"],
      ["Pass-the-hash", "Hash reused directly — no password cracking needed"],
      ["Smurf / Fraggle", "Amplified ICMP / UDP flood via broadcast"],
    ],
  },
  {
    id: "cloud-models",
    title: "Cloud Service & Deployment Models",
    intro: "Who is responsible for what — shared responsibility is the trap.",
    columns: ["Model", "You manage"],
    rows: [
      ["IaaS", "OS, runtime, apps, data. Provider owns hardware/virtualization."],
      ["PaaS", "Apps and data only. Provider owns OS and runtime."],
      ["SaaS", "Data and access only. Provider owns everything else."],
      ["Public", "Multi-tenant, provider-owned"],
      ["Private", "Single tenant — on-prem or hosted"],
      ["Hybrid", "Mix, with orchestration between them"],
      ["Community", "Shared by orgs with common requirements"],
    ],
  },
];

/** An ordered sequence the user drags into the right order. */
export type OrderGameDef = {
  id: string;
  title: string;
  /** Core = memorise before exam day. Advanced = know it, less frequently tested. */
  difficulty: "Core" | "Advanced";
  hint: string;
  /** Correct order, top to bottom. */
  order: string[];
  /** Shown in quick-test explanations so a miss teaches something. */
  why: string;
};

export const ORDER_GAMES: OrderGameDef[] = [
  {
    id: "bcp-steps",
    title: "BCP Order of Operations",
    difficulty: "Core",
    hint: "Drag to order. BIA FIRST — always.",
    order: [
      "Project Scope",
      "Business Impact Analysis (BIA)",
      "Recovery Strategy",
      "Plan Design",
      "Implementation",
      "Testing",
      "Maintenance",
    ],
    why: "The BIA drives every downstream decision — you cannot pick a recovery strategy before you know what the business actually depends on.",
  },
  {
    id: "ir-phases",
    title: "NIST 800-61 Incident Response Phases",
    difficulty: "Core",
    hint: "Four phases, in order.",
    order: [
      "Preparation",
      "Detection & Analysis",
      "Containment, Eradication & Recovery",
      "Post-Incident Activity",
    ],
    why: "NIST collapses containment, eradication and recovery into one phase. Lessons learned always come last.",
  },
  {
    id: "osi-layers",
    title: "OSI Model (top → bottom)",
    difficulty: "Core",
    hint: "All People Seem To Need Data Processing.",
    order: [
      "Application",
      "Presentation",
      "Session",
      "Transport",
      "Network",
      "Data Link",
      "Physical",
    ],
    why: "Top-down mnemonic: All People Seem To Need Data Processing. Bottom-up: Please Do Not Throw Sausage Pizza Away.",
  },
  {
    id: "rmf-steps",
    title: "NIST Risk Management Framework (RMF)",
    difficulty: "Advanced",
    hint: "Seven steps. Prepare was added in Rev 2.",
    order: [
      "Prepare",
      "Categorize",
      "Select",
      "Implement",
      "Assess",
      "Authorize",
      "Monitor",
    ],
    why: "You categorize the system before selecting controls, and you authorize only after assessment. Monitoring is continuous, not a one-off.",
  },
  {
    id: "forensics",
    title: "Digital Forensics Process",
    difficulty: "Advanced",
    hint: "Preserve before you touch anything.",
    order: [
      "Identification",
      "Preservation",
      "Collection",
      "Examination",
      "Analysis",
      "Presentation",
      "Decision",
    ],
    why: "Preservation comes before collection — you protect the scene and the volatile data before you acquire it, or the evidence is tainted.",
  },
  {
    id: "iaaa",
    title: "Access Control Process (IAAA)",
    difficulty: "Core",
    hint: "Four steps. Accountability is the one people forget.",
    order: ["Identification", "Authentication", "Authorization", "Accountability"],
    why: "You claim who you are, prove it, get granted rights, then your actions are logged against your identity.",
  },
  {
    id: "data-lifecycle",
    title: "Data Lifecycle",
    difficulty: "Core",
    hint: "Cradle to grave. Classification happens at creation.",
    order: ["Create", "Store", "Use", "Share", "Archive", "Destroy"],
    why: "Classify at creation — every later control (storage encryption, sharing rules, retention, destruction method) derives from that label.",
  },
  {
    id: "change-mgmt",
    title: "Change Management Process",
    difficulty: "Advanced",
    hint: "Approval before build. Always.",
    order: [
      "Request Change",
      "Impact Assessment",
      "Approval (CAB)",
      "Build & Test",
      "Implement",
      "Document",
      "Post-Implementation Review",
    ],
    why: "Nothing gets built before the Change Advisory Board approves it. Undocumented change is the classic audit finding.",
  },
  {
    id: "bcp-test-rigor",
    title: "BCP/DR Test Types (least → most disruptive)",
    difficulty: "Advanced",
    hint: "Order by how much real production risk each one carries.",
    order: [
      "Read-Through (Checklist)",
      "Structured Walk-Through (Tabletop)",
      "Simulation",
      "Parallel Test",
      "Full Interruption Test",
    ],
    why: "Full interruption actually takes production down — it proves the most and risks the most, so it is always last and needs executive sign-off.",
  },
  {
    id: "sdlc",
    title: "Secure SDLC Phases",
    difficulty: "Core",
    hint: "Security belongs in every phase — but know the canonical order.",
    order: [
      "Requirements & Planning",
      "Design",
      "Development",
      "Testing & Verification",
      "Deployment",
      "Maintenance & Disposal",
    ],
    why: "Threat modeling belongs in Design. Fixing a flaw in Requirements is orders of magnitude cheaper than fixing it in Maintenance.",
  },
  {
    id: "kerberos-flow",
    title: "Kerberos Authentication Flow",
    difficulty: "Advanced",
    hint: "AS first, then TGS, then the service.",
    order: [
      "Client requests TGT from Authentication Server (AS)",
      "AS returns TGT encrypted with client key",
      "Client presents TGT to Ticket Granting Service (TGS)",
      "TGS issues service ticket",
      "Client presents service ticket to resource server",
      "Server grants access for the session",
    ],
    why: "The TGT is obtained once and reused — that is what makes Kerberos single sign-on. Clock skew beyond ~5 minutes breaks the whole flow.",
  },
  {
    id: "evidence-lifecycle",
    title: "Evidence Lifecycle",
    difficulty: "Advanced",
    hint: "Chain of custody runs across all of it.",
    order: [
      "Collection & Identification",
      "Analysis",
      "Storage, Preservation & Transportation",
      "Presentation in Court",
      "Return to Owner",
    ],
    why: "Any gap in the documented chain of custody at any stage can make the evidence inadmissible, no matter how solid the analysis was.",
  },
];

// Kept as named exports — flashcards and quiz explanations reference these directly.
export const IR_PHASES = ORDER_GAMES.find((g) => g.id === "ir-phases")!.order;
export const BCP_STEPS = ORDER_GAMES.find((g) => g.id === "bcp-steps")!.order;
export const OSI_LAYERS = ORDER_GAMES.find((g) => g.id === "osi-layers")!.order;
