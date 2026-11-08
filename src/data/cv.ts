export const profile = {
  name: "Eric Camescasse",
  role: "Senior Software Development Engineer in Test",
  location: "Santo Domingo, Dominican Republic",
  coordinates: "18°28′N 69°53′W",
  email: "eric@camescas.se",
  site: "https://camescas.se",
  cvPdf: "/cv/eric-camescasse-cv.pdf",
};

export const links = [
  { key: "GitHub", label: "camescasse", href: "https://github.com/camescasse/" },
  { key: "LinkedIn", label: "eric-camescasse", href: "https://www.linkedin.com/in/eric-camescasse/" },
  { key: "CV", label: "CV", href: "/cv" },
  { key: "Blog", label: "Blog", href: "/blog" },
];

export interface Role {
  name: string;
  meta?: string;
}

export interface Job {
  company: string;
  meta: string;
  now?: boolean;
  children: Role[];
}

export const work: Job[] = [
  {
    company: "Teleperformance",
    meta: "Senior QA · 2016–2018",
    children: [],
  },
  {
    company: "FLASH",
    meta: "Support & QA · 2018–2024",
    children: [
      { name: "Support Specialist", meta: "2018–2019" },
      { name: "Tech Support Lead", meta: "2019–2021" },
      { name: "Senior QA Lead", meta: "2021–2024" },
    ],
  },
  {
    company: "AximCloud",
    meta: "Senior SDET · 2024–2025",
    children: [
      { name: "Playwright e2e", meta: "1000+ tests" },
      { name: "Maestro e2e", meta: "100+ tests" },
      { name: "Testing Infrastructure", meta: "CI/CD" },
    ],
  },
  {
    company: "Swovo",
    meta: "Senior SDET · 2025–",
    now: true,
    children: [
      { name: "Healthcare", meta: "HIPAA · PHI" },
      { name: "Internal services", meta: "Enterprise · media" },
      { name: "Agentic QA pipelines", meta: "AI-driven testing" },
    ],
  },
];

export interface Project {
  slug: string;
  name: string;
  short: string;
  note: string;
  stack: string[];
  description: string;
}

export const projects: Project[] = [
  {
    slug: "solar-crm",
    name: "All-in-one CRM for solar sales teams",
    short: "Solar sales CRM",
    note: "Personal project",
    stack: ["TypeScript", "React", "Bun", "Hono", "PostgreSQL", "PostGIS", "Drizzle", "Terraform", "AWS"],
    description:
      "[redacted] is a multi-tenant SaaS CRM for solar sales companies: field canvassing on a live map, offline door knocks, leads, booking, the deal pipeline, and payroll. An installable React PWA on a Bun and Hono API, with PostgreSQL, PostGIS, and row-level security. A separate service, [redacted], reads municipal permit files with OCR and matches each permit to a parcel. Terraform on AWS, deployed with GitHub Actions.",
  },
  {
    slug: "theme-park-map",
    name: "Theme park map application",
    short: "Theme park map app",
    note: "Personal project",
    stack: ["TypeScript", "React Native", "Expo", "expo-sqlite", "Maestro"],
    description:
      "[redacted] is a cross-platform iOS and Android app that guides visitors through a theme park: custom map layouts, ride information, and live GPS location. All park content is in SQLite, so the app works with no network connection. Maestro end-to-end flows test the main user journeys.",
  },
];

export const skills = [
  { key: "Languages", value: ["TypeScript", "Go", "Java"] },
  { key: "Testing", value: ["Playwright", "Cypress", "Selenium", "Postman", "Bruno", "Insomnia"] },
  { key: "CI", value: ["GitHub Actions", "AWS"] },
  { key: "Test docs", value: ["Xray", "Zephyr", "TestRail"] },
  { key: "Version control", value: ["Git"] },
  { key: "OS", value: ["Linux", "macOS", "Windows"] },
  { key: "Spoken", value: ["English", "Spanish"] },
];

export const education = {
  school: "Pontificia Universidad Católica Madre y Maestra",
  degree: "BS Industrial Engineering",
  dates: "2016–2021",
};
