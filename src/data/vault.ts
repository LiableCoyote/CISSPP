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
];

export const IR_PHASES = [
  "Preparation",
  "Detection & Analysis",
  "Containment, Eradication & Recovery",
  "Post-Incident Activity",
];

export const BCP_STEPS = [
  "Project Scope",
  "Business Impact Analysis (BIA)",
  "Recovery Strategy",
  "Plan Design",
  "Implementation",
  "Testing",
  "Maintenance",
];

export const OSI_LAYERS = [
  "Application",
  "Presentation",
  "Session",
  "Transport",
  "Network",
  "Data Link",
  "Physical",
];
