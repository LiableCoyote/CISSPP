export type Resource = {
  id: string;
  title: string;
  description: string;
  url: string;
  category: "video" | "reading" | "community" | "official";
  domainIds: number[];
  isRequired: boolean;
};

export const RESOURCES: Resource[] = [
  {
    id: "destcert-yt",
    title: "Destination Certification CISSP MindMaps",
    description: "Your primary learning tool — 30+ videos covering all 8 domains.",
    url: "https://www.youtube.com/@DestinationCertification",
    category: "video",
    domainIds: [1, 2, 3, 4, 5, 6, 7, 8],
    isRequired: true,
  },
  {
    id: "destcert-audio",
    title: "DestCert Free Audio + PDF MindMaps",
    description: "Download the free audio and printable PDF at destcert.com.",
    url: "https://destcert.com/cissp-mindmaps",
    category: "reading",
    domainIds: [1, 2, 3, 4, 5, 6, 7, 8],
    isRequired: true,
  },
  {
    id: "cissprep-guide",
    title: "CISSP Super Study Guide",
    description: "Free quick reference and memorization shortcuts at cissprep.net.",
    url: "https://cissprep.net/super-study-guide",
    category: "reading",
    domainIds: [1, 2, 3, 4, 5, 6, 7, 8],
    isRequired: true,
  },
  {
    id: "thorteaches-yt",
    title: "ThorTeaches YouTube",
    description: "Use when a specific concept won't click.",
    url: "https://www.youtube.com/@ThorTeaches",
    category: "video",
    domainIds: [1, 2, 3, 4, 5, 6, 7, 8],
    isRequired: false,
  },
  {
    id: "isc2-outline",
    title: "ISC2 Official Exam Outline",
    description: "Print it. Use it as your master checklist.",
    url: "https://www.isc2.org/certifications/cissp/cissp-certification-exam-outline",
    category: "official",
    domainIds: [1, 2, 3, 4, 5, 6, 7, 8],
    isRequired: true,
  },
  {
    id: "quantum-exams",
    title: "Quantum Practice Exams",
    description: "Your primary question bank. Separate product.",
    url: "https://www.quantumexams.com",
    category: "reading",
    domainIds: [1, 2, 3, 4, 5, 6, 7, 8],
    isRequired: true,
  },
  {
    id: "reddit-cissp",
    title: "r/cissp",
    description: "Community support and passed-exam strategies.",
    url: "https://www.reddit.com/r/cissp",
    category: "community",
    domainIds: [],
    isRequired: false,
  },
  {
    id: "certstation",
    title: "Certstation Discord",
    description: "Community support and passed-exam strategies.",
    url: "https://discord.gg/certstation",
    category: "community",
    domainIds: [],
    isRequired: false,
  },
];
