import type { Question } from "../db/schema";

// 20 scenario-style questions. Real CISSP leans heavily on these: long setup,
// one BEST/FIRST/MOST answer. Each question carries `scenario` as part of the
// prompt string so the existing quiz UI renders them without schema changes.

export const SCENARIO_QUESTIONS: Question[] = [
  {
    id: "sc-1",
    domainId: 1,
    prompt:
      "SCENARIO: Your CEO forwards you a vendor proposal for a new SaaS CRM that will store customer PII across multiple jurisdictions. Marketing wants to sign the contract this week. Legal has not reviewed it. The vendor's SOC 2 report is from three years ago. What is your FIRST action as the security leader?",
    options: [
      "Approve the contract pending a penetration test after deployment",
      "Require an updated SOC 2 Type II and a data-processing agreement before any signature",
      "Deploy the CRM in a sandbox and assess technical controls",
      "Escalate to the CIO and let them decide without further input",
    ],
    answerIndex: 1,
    explanation:
      "Management-first. Third-party risk starts with current attestations (SOC 2 Type II) and legal agreements (DPA), not with technical testing. A stale report and missing DPA are showstoppers.",
    tags: ["scenario", "third-party", "risk", "management"],
    isMindsetHeavy: true,
    technicianTrap: 2,
  },
  {
    id: "sc-2",
    domainId: 7,
    prompt:
      "SCENARIO: At 2 AM an on-call engineer sees anomalous outbound traffic from a production database server to an IP in a country your company doesn't operate in. The engineer immediately shuts down the server to stop the bleeding. You are paged at 2:15 AM. What should have been done FIRST?",
    options: [
      "Shut down the server — stopping exfiltration is always the priority",
      "Contain the host via network isolation while preserving volatile evidence and notifying the IR lead",
      "Restart the server with packet capture enabled to gather evidence",
      "Notify law enforcement before any containment decision",
    ],
    answerIndex: 1,
    explanation:
      "NIST 800-61: containment preserves evidence. Powering down destroys volatile memory, loses process/network state, and complicates root-cause analysis. Network isolation stops exfil while preserving forensics.",
    tags: ["scenario", "incident-response", "forensics", "nist-800-61"],
    isMindsetHeavy: true,
    technicianTrap: 0,
  },
  {
    id: "sc-3",
    domainId: 2,
    prompt:
      "SCENARIO: Your company is acquiring a smaller competitor. During due diligence you discover the target stores unencrypted copies of 2 million customer credit cards in a legacy database that predates PCI-DSS adoption. The deal closes in 10 days. Which action BEST balances risk and business need?",
    options: [
      "Encrypt the database immediately using your standard TDE configuration",
      "Document the finding, quantify remediation cost, and factor it into the acquisition price and a binding remediation plan",
      "Halt the acquisition until the target is fully PCI-DSS compliant",
      "Accept the risk temporarily and plan remediation post-close",
    ],
    answerIndex: 1,
    explanation:
      "CISO thinking: risk quantification drives deal structure. Findings get documented, priced, and made contractual. Unilateral technical fixes on a non-acquired asset exceed your authority; halting the deal is disproportionate.",
    tags: ["scenario", "due-diligence", "risk", "data-classification", "management"],
    isMindsetHeavy: true,
    technicianTrap: 0,
  },
  {
    id: "sc-4",
    domainId: 3,
    prompt:
      "SCENARIO: A developer proposes authenticating users to a new mobile app using a hard-coded AES-256 key embedded in the binary, plus a per-session random IV. They argue AES-256 is unbreakable. What is the BEST response?",
    options: [
      "Approve — AES-256 is indeed FIPS 140-validated and uncrackable by brute force",
      "Reject — a static symmetric key in a distributed binary makes every installed app a key holder; use a proper key exchange / per-device key derivation",
      "Require the key to be obfuscated in the binary using anti-reverse-engineering tools",
      "Allow it but rotate the embedded key monthly via app updates",
    ],
    answerIndex: 1,
    explanation:
      "Cipher strength is irrelevant if key management is broken. Embedded static keys can be extracted from any installed device; the mobile app effectively has zero authentication. Use asymmetric bootstrap or per-device KDF.",
    tags: ["scenario", "crypto", "key-management"],
    isMindsetHeavy: false,
    technicianTrap: 0,
  },
  {
    id: "sc-5",
    domainId: 4,
    prompt:
      "SCENARIO: Your SOC sees a spike of failed logins against the VPN from a botnet. Accounts are being locked out at a rate that is starting to impact business. A junior analyst suggests lowering the lockout threshold from 5 to 3 to stop the attack faster. What is the BEST response?",
    options: [
      "Approve — faster lockout reduces brute-force success",
      "Reject — this accelerates the DoS the attacker is actually achieving; implement rate-limiting and IP reputation blocking instead",
      "Disable account lockout entirely and rely on strong passwords",
      "Shorten the lockout duration to 30 seconds",
    ],
    answerIndex: 1,
    explanation:
      "A password-spray attack targeting the lockout mechanism IS the denial of service. Tightening thresholds amplifies it. Counter with adaptive rate-limiting, IP reputation, geo-blocking, and — longer term — MFA.",
    tags: ["scenario", "access-control", "dos", "brute-force"],
    isMindsetHeavy: true,
    technicianTrap: 0,
  },
  {
    id: "sc-6",
    domainId: 5,
    prompt:
      "SCENARIO: During an internal audit, a developer is found to have access to production databases containing customer data, because they occasionally troubleshoot live issues. The developer has been with the company for 8 years and has never caused an incident. What is the MOST appropriate remediation?",
    options: [
      "No change — the developer's track record justifies the access",
      "Remove the standing access; require just-in-time elevated access with approval workflow and audit logging",
      "Move the developer to the operations team so the access is legitimate",
      "Add the developer to the audit scope going forward",
    ],
    answerIndex: 1,
    explanation:
      "Least privilege is role-based, not trust-based. JIT access + approval workflow enforces the control while preserving the business need. 'They've never done anything wrong' is not a compensating control.",
    tags: ["scenario", "least-privilege", "iam", "sod"],
    isMindsetHeavy: true,
    technicianTrap: 0,
  },
  {
    id: "sc-7",
    domainId: 6,
    prompt:
      "SCENARIO: Your pen-test vendor reports a SQL injection vulnerability on the customer login page. The application is scheduled for full replacement in 6 months. The development team estimates 3 weeks to fix properly; a WAF rule can be deployed in 4 hours. Finance pushes back on the 3-week effort. What is the BEST decision?",
    options: [
      "Deploy the WAF rule only — the app is being retired anyway",
      "Deploy the WAF rule AS compensating control now AND schedule the proper code fix; document the risk acceptance if the code fix is deferred",
      "Take the app offline until the code is fixed",
      "Accept the risk with sign-off from the CFO since the app is short-lived",
    ],
    answerIndex: 1,
    explanation:
      "Compensating controls buy time, not exemption. A WAF is defense-in-depth; root-cause fix goes on the schedule. If deferred, the deferral is documented risk acceptance by an accountable owner — not just finance.",
    tags: ["scenario", "sqli", "compensating-controls", "risk-management"],
    isMindsetHeavy: true,
    technicianTrap: 0,
  },
  {
    id: "sc-8",
    domainId: 8,
    prompt:
      "SCENARIO: A product manager asks the dev team to implement 'remember me' by storing the user's password in the browser's localStorage, encrypted with a key derived from the username. They argue this is more secure than a session cookie because it's 'encrypted'. What is the BEST response?",
    options: [
      "Approve — client-side encryption of credentials is acceptable for convenience features",
      "Reject — issue a long-lived opaque refresh token bound to device and revocable server-side; never store the plaintext password",
      "Approve but require the encryption key to be derived using PBKDF2 with 100,000 iterations",
      "Approve but use sessionStorage instead of localStorage",
    ],
    answerIndex: 1,
    explanation:
      "A key derived from a known value (username) provides no secrecy. Passwords must never be recoverable client-side. The correct pattern is refresh tokens — opaque, revocable, and never the credential itself.",
    tags: ["scenario", "secure-coding", "auth", "tokens"],
    isMindsetHeavy: false,
    technicianTrap: 2,
  },
  {
    id: "sc-9",
    domainId: 1,
    prompt:
      "SCENARIO: Your BIA identifies an RTO of 4 hours for the payment processing system. Your DR plan documents a 12-hour recovery. The business owner has signed off on the DR plan. A regulator is auditing next week. What is your FIRST action?",
    options: [
      "Update the BIA to match the DR plan's 12-hour RTO",
      "Escalate the gap to executive leadership; either invest to close the gap or formally accept the residual risk with the business owner as risk owner",
      "Rewrite both documents to show a 6-hour RTO as a compromise",
      "Hide the discrepancy until after the audit, then remediate",
    ],
    answerIndex: 1,
    explanation:
      "BIA drives RTO — you don't lower requirements to match capability. The gap is a risk: fund the fix or get formal risk acceptance from the accountable owner. Option 3 is document fraud.",
    tags: ["scenario", "bcp", "bia", "risk-acceptance"],
    isMindsetHeavy: true,
    technicianTrap: 2,
  },
  {
    id: "sc-10",
    domainId: 7,
    prompt:
      "SCENARIO: A ransomware variant has encrypted 40% of your file servers. Backups are 18 hours old and verified. Attackers demand $2M, threatening to publish exfiltrated data in 72 hours. Law enforcement is engaged. The CEO wants to pay to stop the leak. What do you recommend FIRST?",
    options: [
      "Pay the ransom — data leak damage exceeds $2M",
      "Convene IR leadership + legal + privacy + comms to assess confirmed exfiltration scope, regulatory notification obligations, and insurance coverage before any payment decision",
      "Publicly announce the breach before the attackers do",
      "Negotiate the ransom down using a third-party firm",
    ],
    answerIndex: 1,
    explanation:
      "Ransom decisions require legal (sanctions risk), insurance (coverage triggers), regulator obligations (72-hour clocks), and verified exfiltration scope. 'Pay fast' is reactive. Governance first, then tactics.",
    tags: ["scenario", "ransomware", "incident-response", "legal"],
    isMindsetHeavy: true,
    technicianTrap: 0,
  },
  {
    id: "sc-11",
    domainId: 2,
    prompt:
      "SCENARIO: An HR VP emails you asking to 'just delete' a former employee's mailbox 'to clean up storage'. The employee was involved in a pending wrongful-termination lawsuit. What is the BEST response?",
    options: [
      "Delete the mailbox after verifying the user account is disabled",
      "Refuse and place the mailbox on litigation hold; explain the duty to preserve and involve Legal",
      "Archive the mailbox to tape and delete the online copy",
      "Export the mailbox to PST, give it to HR, and delete the original",
    ],
    answerIndex: 1,
    explanation:
      "Duty to preserve kicks in when litigation is reasonably anticipated. Deletion (even archival) can constitute spoliation. Legal hold is non-negotiable regardless of storage 'cleanup' asks.",
    tags: ["scenario", "legal-hold", "data-retention", "ediscovery"],
    isMindsetHeavy: true,
    technicianTrap: 3,
  },
  {
    id: "sc-12",
    domainId: 4,
    prompt:
      "SCENARIO: Your organization is deploying a new microsegmentation solution. The network team wants to define policies based on source/destination IP. The security team argues for identity-based policies. Which approach BEST aligns with zero-trust principles?",
    options: [
      "IP-based — it is faster and simpler to audit",
      "Identity-based using workload identity (e.g., service accounts, SPIFFE), because IPs are ephemeral and don't express trust",
      "A hybrid with IP policies for internal and identity policies for external",
      "Whichever is cheaper — both meet zero-trust requirements equally",
    ],
    answerIndex: 1,
    explanation:
      "Zero trust assumes network location is not a trust signal. Identity-based policies survive IP changes, scale in dynamic environments, and tie enforcement to authorization — the core ZT tenet.",
    tags: ["scenario", "zero-trust", "segmentation", "identity"],
    isMindsetHeavy: false,
    technicianTrap: 0,
  },
  {
    id: "sc-13",
    domainId: 3,
    prompt:
      "SCENARIO: A product team wants to build a feature where users can share documents with external recipients via a public link. Engineering proposes obfuscated URLs with 128 bits of entropy. Security asks about expiry and revocation. The team responds 'nobody will guess the URL, and the user can just delete the document'. What is the BEST risk position?",
    options: [
      "Accept — 128 bits of entropy is cryptographically sufficient",
      "Require expiry, revocation, and access logging; treat the URL as a bearer capability token",
      "Require the URL to be sent via encrypted email only",
      "Reject the feature entirely — public links are never safe",
    ],
    answerIndex: 1,
    explanation:
      "An unguessable URL IS a bearer token — whoever holds it gains access. That means the usual bearer-token controls apply: expiry, revocation, audit, binding to recipient where possible. Entropy alone is not enough.",
    tags: ["scenario", "tokens", "data-sharing", "least-privilege"],
    isMindsetHeavy: false,
    technicianTrap: 0,
  },
  {
    id: "sc-14",
    domainId: 5,
    prompt:
      "SCENARIO: During an access review, you find a contractor still has production access 90 days after their contract ended. The contractor never actually logged in after their end date. The hiring manager says 'no harm done'. What is the MOST appropriate response?",
    options: [
      "Close the finding — no exploitation occurred",
      "Revoke the access, document the process failure, investigate the identity-lifecycle gap that allowed the account to persist, and feed fixes into the JML workflow",
      "Disable the account but keep it for potential future contract",
      "Extend the contractor's access under a new contract",
    ],
    answerIndex: 1,
    explanation:
      "The finding is the lifecycle gap, not whether it was exploited this time. JML (Joiner-Mover-Leaver) controls need fixing at the process level. 'No harm done' is hindsight bias.",
    tags: ["scenario", "iam", "access-review", "jml"],
    isMindsetHeavy: true,
    technicianTrap: 2,
  },
  {
    id: "sc-15",
    domainId: 6,
    prompt:
      "SCENARIO: Your SAST tool is generating 300 findings per week. Developers ignore the email reports. The AppSec team wants to enforce a gate blocking deploys on any HIGH finding. DevOps says this will stall releases. What is the BEST approach?",
    options: [
      "Enforce the gate immediately — security is non-negotiable",
      "Tune the tool to reduce false positives, integrate in PRs with developer-friendly context, and phase the gate by severity and repo maturity",
      "Disable the tool and rely on quarterly pen tests",
      "Accept the findings as informational and track trend metrics only",
    ],
    answerIndex: 1,
    explanation:
      "Heavy-handed gates on noisy tools train developers to bypass or disable them. Shift-left that actually works: PR integration, signal over noise, risk-based gating, measurable adoption.",
    tags: ["scenario", "sast", "devsecops", "appsec"],
    isMindsetHeavy: true,
    technicianTrap: 0,
  },
  {
    id: "sc-16",
    domainId: 8,
    prompt:
      "SCENARIO: A developer is debugging a production issue and pastes a real customer record (including SSN) into a public Slack channel in a screenshot. The channel has 200 members and an external integration. The developer deletes the message 10 minutes later. What is your FIRST action?",
    options: [
      "Mark the incident closed once the message is deleted",
      "Treat as a confirmed data-exposure incident: preserve audit logs, identify all recipients (internal + integration retention), determine regulatory-notification obligations, and begin the IR playbook",
      "Ask Slack support to permanently wipe the message from all caches",
      "Warn the developer and require security-awareness training",
    ],
    answerIndex: 1,
    explanation:
      "Deletion does not equal containment — external integrations, mobile caches, and notifications persist. This is a reportable exposure under most privacy regimes. Start the IR process; developer coaching comes later.",
    tags: ["scenario", "data-leak", "incident-response", "privacy"],
    isMindsetHeavy: true,
    technicianTrap: 2,
  },
  {
    id: "sc-17",
    domainId: 1,
    prompt:
      "SCENARIO: Your organization is adopting an AI coding assistant that sends source code snippets to a third-party model provider. Legal asks whether this exposes you to IP or data-leak risk. Engineering loves the productivity boost. Finance sees cost savings. What is the BEST governance response?",
    options: [
      "Block the tool — any third-party code exposure is unacceptable",
      "Establish an acceptable-use policy, vendor risk assessment, data-classification boundary (no secrets/PII), and contractual protection — then enable it with monitoring",
      "Allow engineers to use it at their own discretion with a best-effort warning",
      "Approve only for non-production repositories",
    ],
    answerIndex: 1,
    explanation:
      "Business enablement with governance. Policy + vendor assessment + data-boundary + contractual terms + monitoring = risk-managed adoption. Outright bans push users to shadow IT.",
    tags: ["scenario", "ai-governance", "third-party", "shadow-it"],
    isMindsetHeavy: true,
    technicianTrap: 0,
  },
  {
    id: "sc-18",
    domainId: 4,
    prompt:
      "SCENARIO: A vendor claims their SaaS product uses 'military-grade encryption' and 'zero trust'. They can't produce a SOC 2, ISO 27001, or penetration test report. Your CTO has already told the business unit it's approved. What is the BEST next step?",
    options: [
      "Sign off since the CTO has approved it",
      "Escalate to the CISO or risk committee; the absence of independent assurance fails your third-party risk framework regardless of buzzwords",
      "Require the vendor to complete your security questionnaire before go-live",
      "Monitor vendor traffic via your CASB and accept the risk",
    ],
    answerIndex: 1,
    explanation:
      "Governance exists for exactly this case. Marketing language is not assurance. The control failure is process: a CTO 'approval' that bypasses risk framework creates an audit finding whether or not the vendor is actually insecure.",
    tags: ["scenario", "third-party", "governance", "assurance"],
    isMindsetHeavy: true,
    technicianTrap: 2,
  },
  {
    id: "sc-19",
    domainId: 7,
    prompt:
      "SCENARIO: A new colleague in the SOC has configured alerts on every failed authentication. Alert volume is now 15,000/day and the team is missing real incidents. The colleague argues 'more visibility is always better'. What is the BEST coaching response?",
    options: [
      "Agree — coverage beats noise",
      "Alert volume without signal is anti-visibility; tune alerts to high-fidelity detection use-cases and surface low-fidelity signals through aggregation/correlation, not paging",
      "Hire more SOC analysts to handle the volume",
      "Automate a response action on every failed login",
    ],
    answerIndex: 1,
    explanation:
      "Alert fatigue kills detection capability. Good SOC practice: alert on high-fidelity outcomes; send everything else to analytics/correlation tiers. The goal is time-to-detect, not lines-per-day.",
    tags: ["scenario", "soc", "detection", "alerting"],
    isMindsetHeavy: true,
    technicianTrap: 0,
  },
  {
    id: "sc-20",
    domainId: 2,
    prompt:
      "SCENARIO: Your company is expanding into the EU. A product team wants to deploy the existing US-hosted application to EU customers without changes. The team claims 'we already encrypt everything, so GDPR is covered'. What is the BEST response?",
    options: [
      "Approve — encryption at rest and in transit satisfies GDPR",
      "Encryption is one control, not a compliance strategy; GDPR requires lawful basis, data-subject rights, cross-border transfer mechanism, DPO considerations, and DPIA — engage Privacy/Legal before any EU launch",
      "Add a cookie banner and proceed",
      "Host the app in the EU region only, and GDPR does not apply",
    ],
    answerIndex: 1,
    explanation:
      "GDPR is a privacy regulation, not an encryption checkbox. Lawful basis, DSRs, transfer mechanism (SCCs/adequacy), DPO/DPIA, breach notification — all independent of crypto. Privacy-by-design is a program, not a feature.",
    tags: ["scenario", "privacy", "gdpr", "cross-border"],
    isMindsetHeavy: true,
    technicianTrap: 0,
  },
];
