import type { Flashcard } from "../db/schema";
import { EXTRA_SEEDS, type FlashcardSeed } from "./flashcards.seed.extra";

type Seed = FlashcardSeed;

const SEEDS: Seed[] = [
  // Risk formulas (D1)
  { front: "SLE formula", back: "Single Loss Expectancy = Asset Value (AV) × Exposure Factor (EF)", domainId: 1, tags: ["risk", "formula"] },
  { front: "ALE formula", back: "Annualized Loss Expectancy = SLE × Annualized Rate of Occurrence (ARO)", domainId: 1, tags: ["risk", "formula"] },
  { front: "Total Risk formula", back: "Threats × Vulnerabilities × Asset Value", domainId: 1, tags: ["risk", "formula"] },
  { front: "Residual Risk formula", back: "Total Risk − Controls applied. What's left after mitigation.", domainId: 1, tags: ["risk", "formula"] },
  { front: "Quantitative vs qualitative risk", back: "Quantitative: dollar values, formulas, objective. Qualitative: high/med/low, subjective, faster.", domainId: 1, tags: ["risk"] },

  // Security models (D3)
  { front: "Bell-LaPadula rule", back: "Protects CONFIDENTIALITY. No read up, no write down. 'Simple' and 'star' (*).", domainId: 3, tags: ["model"] },
  { front: "Biba rule", back: "Protects INTEGRITY. No read down, no write up.", domainId: 3, tags: ["model"] },
  { front: "Clark-Wilson rule", back: "Protects INTEGRITY via well-formed transactions and Separation of Duties.", domainId: 3, tags: ["model"] },
  { front: "Brewer-Nash (Chinese Wall)", back: "Prevents CONFLICTS OF INTEREST. Access changes dynamically based on history.", domainId: 3, tags: ["model"] },

  // IR (D7)
  { front: "NIST 800-61 IR phases", back: "Preparation → Detection & Analysis → Containment/Eradication/Recovery → Post-Incident Activity", domainId: 7, tags: ["ir"] },
  { front: "Chain of custody", back: "Document who handled evidence, when, where, and why. Any break = evidence may be inadmissible.", domainId: 7, tags: ["ir", "evidence"] },

  // Recovery metrics (D7)
  { front: "RPO", back: "Recovery Point Objective — how much DATA you can afford to LOSE (time).", domainId: 7, tags: ["bcp", "metric"] },
  { front: "RTO", back: "Recovery Time Objective — how QUICKLY systems must be restored.", domainId: 7, tags: ["bcp", "metric"] },
  { front: "MTBF", back: "Mean Time Between Failures — average time between failures (reliability).", domainId: 7, tags: ["bcp", "metric"] },
  { front: "MTTR", back: "Mean Time To Repair — average time to restore after failure.", domainId: 7, tags: ["bcp", "metric"] },

  // Access control (D5)
  { front: "DAC", back: "Discretionary Access Control. Owner decides access. Most flexible, least secure.", domainId: 5, tags: ["access"] },
  { front: "MAC", back: "Mandatory Access Control. Labels + clearances. Government/military default.", domainId: 5, tags: ["access"] },
  { front: "RBAC", back: "Role-Based Access Control. Role determines access. Most common in enterprise.", domainId: 5, tags: ["access"] },
  { front: "ABAC", back: "Attribute-Based Access Control. Attributes + rules. Most granular.", domainId: 5, tags: ["access"] },

  // Crypto (D3)
  { front: "Symmetric ciphers", back: "AES (128/192/256). 3DES is LEGACY only. Fast, single key.", domainId: 3, tags: ["crypto"] },
  { front: "Asymmetric ciphers", back: "RSA, ECC, Diffie-Hellman (key exchange only — no encryption).", domainId: 3, tags: ["crypto"] },
  { front: "Secure hash algorithms", back: "SHA-256, SHA-384, SHA-512, SHA-3. NEVER MD5 or SHA-1 for security.", domainId: 3, tags: ["crypto"] },
  { front: "Digital signature process", back: "Hash message → encrypt hash with SENDER'S PRIVATE key. Verifier decrypts with sender's public key.", domainId: 3, tags: ["crypto"] },
  { front: "PKI core components", back: "CA (issues), RA (verifies), CRL/OCSP (revocation), cert (binds identity to public key).", domainId: 3, tags: ["crypto", "pki"] },

  // Auth protocols (D5)
  { front: "Kerberos facts", back: "Ticket-based SSO. KDC = AS + TGS. Port 88. Symmetric. Time-sensitive (clock skew).", domainId: 5, tags: ["auth"] },
  { front: "SAML", back: "XML-based federation. SSO for web apps. Uses assertions.", domainId: 5, tags: ["auth"] },
  { front: "OAuth 2.0", back: "AUTHORIZATION only — NOT authentication. Token-based.", domainId: 5, tags: ["auth"] },
  { front: "OpenID Connect", back: "AUTHENTICATION built on top of OAuth 2.0. ID token (JWT).", domainId: 5, tags: ["auth"] },
  { front: "RADIUS vs TACACS+", back: "RADIUS: encrypts password only, UDP. TACACS+: Cisco, encrypts FULL payload, TCP, separates AAA.", domainId: 5, tags: ["auth", "network"] },

  // BCP (D1/D7)
  { front: "BCP order of operations", back: "Project Scope → BIA → Recovery Strategy → Plan Design → Implementation → Testing → Maintenance. BIA FIRST — ALWAYS.", domainId: 1, tags: ["bcp"] },
  { front: "Why BIA first?", back: "The Business Impact Analysis drives every other decision — which systems matter, which don't.", domainId: 1, tags: ["bcp"] },

  // Data roles (D2)
  { front: "Data owner", back: "Accountable for data. Sets classification. Usually senior management.", domainId: 2, tags: ["data"] },
  { front: "Data custodian", back: "Operational responsibility. Backups, access implementation. IT/ops role.", domainId: 2, tags: ["data"] },
  { front: "Data processor", back: "Processes data on behalf of the controller (GDPR term).", domainId: 2, tags: ["data", "gdpr"] },
  { front: "Data controller", back: "Determines PURPOSE and MEANS of processing (GDPR term). Accountable.", domainId: 2, tags: ["data", "gdpr"] },
  { front: "Data remanence", back: "Residual data left after deletion. Defeated by overwrite, degaussing, or physical destruction.", domainId: 2, tags: ["data"] },

  // Network (D4)
  { front: "OSI model layers", back: "7 Application, 6 Presentation, 5 Session, 4 Transport, 3 Network, 2 Data Link, 1 Physical. 'All People Seem To Need Data Processing'.", domainId: 4, tags: ["osi"] },
  { front: "Firewall types", back: "Stateless packet filter → Stateful → Proxy/App → NGFW (deep packet + user/app ID) → WAF (layer 7 web).", domainId: 4, tags: ["firewall"] },
  { front: "IPsec vs TLS VPN", back: "IPsec: network layer, full-network access, site-to-site. TLS/SSL VPN: app layer, clientless/portal, user-friendly.", domainId: 4, tags: ["vpn"] },
  { front: "WPA3 improvements", back: "SAE (Dragonfly) replaces PSK handshake, PFS, individualized encryption on open nets.", domainId: 4, tags: ["wireless"] },
  { front: "DNSSEC", back: "Adds origin authenticity + integrity via signed records. Does NOT provide confidentiality.", domainId: 4, tags: ["dns"] },

  // SDLC (D8)
  { front: "OWASP Top 10 (high-level)", back: "Injection, broken auth, sensitive data, XXE, broken access, misconfig, XSS, insecure deserialize, known vuln comps, insufficient logging.", domainId: 8, tags: ["owasp"] },
  { front: "DevSecOps core idea", back: "Shift security LEFT — integrate testing, SAST/DAST, IaC scanning into the pipeline.", domainId: 8, tags: ["sdlc"] },
  { front: "AI/ML security risks (2024 outline)", back: "Data poisoning, model hijacking, adversarial attacks, prompt injection, model theft.", domainId: 8, tags: ["ai"] },

  // Assessment (D6)
  { front: "Vulnerability assessment vs pentest", back: "VA: broad, automated, finds known issues. Pentest: narrow, manual, exploits findings to prove impact.", domainId: 6, tags: ["assess"] },
  { front: "SOC 1 / 2 / 3", back: "SOC 1: financial controls. SOC 2: trust services (security, availability, etc). SOC 3: public-facing summary of SOC 2.", domainId: 6, tags: ["audit"] },
  { front: "KPI vs KRI", back: "KPI measures performance of a control. KRI measures the level of risk (change in threat / vulnerability).", domainId: 6, tags: ["metric"] },

  // Mindset cards (meta)
  { front: "#1 mindset rule", back: "Think like a CISO. When two answers seem right, pick governance/process/risk-reduction — NOT the most technical fix.", domainId: null, tags: ["mindset"] },
  { front: "Question keywords to watch", back: "BEST, FIRST, MOST, LEAST, EXCEPT. Miss one of these and you pick a correct-but-wrong answer.", domainId: null, tags: ["mindset"] },
  { front: "When in doubt on exam", back: "Eliminate the two obvious wrongs. Between the remaining two, ask: what would a CISO or security manager choose?", domainId: null, tags: ["mindset"] },
  { front: "CAT format — can you go back?", back: "NO. Ever. Submit and forget. Never spend more than 90s on one question.", domainId: null, tags: ["exam"] },
];

/**
 * Card ids are `seed-<index>`, so this array is APPEND ONLY. Reordering or
 * inserting would re-key existing cards and discard their SRS history.
 */
const ALL_SEEDS: Seed[] = [...SEEDS, ...EXTRA_SEEDS];

export function buildFlashcardSeed(): Flashcard[] {
  const now = new Date().toISOString();
  return ALL_SEEDS.map((s, i) => ({
    id: `seed-${i}`,
    front: s.front,
    back: s.back,
    domainId: s.domainId,
    tags: s.tags,
    ease: 2.5,
    interval: 0,
    reps: 0,
    lapses: 0,
    dueAt: now,
    lastReviewedAt: null,
    createdAt: now,
    source: "seed",
  }));
}
