import { useState } from "react";
import { ExternalLink, ChevronDown, ChevronUp, Lock } from "lucide-react";

interface Feature {
  title: string;
  description: string;
}

interface Project {
  number: string;
  name: string;
  tagline: string;
  description: string;
  url: string | null;
  urlLabel: string;
  isPrivate: boolean;
  accentColor: string;
  stack: string[];
  architecture: Feature[];
  highlights: string[];
  screenshotNote: string;
}

const PROJECTS: Project[] = [
  {
    number: "01",
    name: "Papirun",
    tagline: "Full-stack food delivery platform",
    description:
      "A production-ready food delivery app covering the full order lifecycle — from customer browsing and checkout to real-time driver assignment and delivery tracking. Built with three distinct user surfaces: a customer storefront, an admin control panel, and a driver panel — all sharing a single real-time backend.",
    url: "https://papirun.net",
    urlLabel: "papirun.net",
    isPrivate: false,
    accentColor: "#a855f7",
    stack: [
      "React 18",
      "TypeScript",
      "Vite",
      "Supabase",
      "PostgreSQL",
      "Supabase Realtime",
      "TanStack Query",
      "Capacitor",
      "Tailwind CSS",
      "Framer Motion",
      "Leaflet",
      "React Hook Form",
      "Zod",
      "Vitest",
    ],
    architecture: [
      {
        title: "Layered API module pattern",
        description:
          "All database calls are isolated in typed src/lib/*Api.ts modules (ordersApi, driversApi, orderMessagesApi). React components never touch Supabase directly — they go through these modules, keeping the data layer independently testable.",
      },
      {
        title: "Real-time bidirectional chat",
        description:
          "When an admin approves an order, a Supabase Realtime subscription fires on the customer side and surfaces a floating OrderTrackingPill. Chat supports three sender roles — user, admin, driver — with message handoff between admin and driver in one click.",
      },
      {
        title: "ECT driver assignment algorithm",
        description:
          "On approval, a custom Estimated Completion Time algorithm picks the driver with the least remaining workload. Admins can override manually. Drivers authenticate with name + PIN — no Supabase Auth overhead for internal staff.",
      },
      {
        title: "PWA + Native hybrid",
        description:
          "Progressive Web App first, then wrapped with Capacitor v8 to ship iOS and Android builds. One codebase, three platforms. Push notifications and haptics are wired through Capacitor's native plugin system.",
      },
      {
        title: "Context-driven client state",
        description:
          "Four focused React Contexts — Cart, Auth, Favorites, Language — each owning one concern and persisting to localStorage where needed. TanStack Query handles all server state, so Contexts stay lean.",
      },
      {
        title: "Invoice generation",
        description:
          "Custom invoiceGenerator.ts produces printable PDF invoices. Logo is embedded as a base64 data URL to survive Vite's asset pipeline and render correctly in browser print and native share contexts.",
      },
    ],
    highlights: [
      "Multi-role system (customer / admin / driver) in a single codebase",
      "Live order status and chat without polling — pure Realtime subscriptions",
      "Cross-platform: web, iOS, and Android from one React app",
      "Row-level security on all Supabase tables",
      "CSV + JSON order history export from admin panel",
    ],
    screenshotNote:
      "Add a screenshot of papirun.net here — use browser devtools to capture a full-page screenshot.",
  },
  {
    number: "02",
    name: "Energym",
    tagline: "Full gym management platform",
    description:
      "A complete gym management platform for Energym Kosovo. Handles member onboarding, class scheduling, subscription management, and an admin dashboard for tracking attendance and revenue — all in a fast, SSR-rendered interface.",
    url: "https://energym-ks.com",
    urlLabel: "energym-ks.com",
    isPrivate: false,
    accentColor: "#22d3ee",
    stack: [
      "Next.js 14",
      "TypeScript",
      "Supabase",
      "PostgreSQL",
      "Tailwind CSS",
      "Supabase Auth",
      "TanStack Query",
      "React Hook Form",
      "Zod",
    ],
    architecture: [
      {
        title: "Server-side rendering for SEO",
        description:
          "Next.js App Router with Server Components for the public-facing pages. Class schedules, pricing, and landing content are pre-rendered at build time, giving instant load times and full search engine indexability.",
      },
      {
        title: "Role-based member access",
        description:
          "Supabase Auth gates member-only routes. Row-level security policies ensure members can only read their own subscription and attendance data. Admins get elevated access via a separate role column.",
      },
      {
        title: "Subscription lifecycle management",
        description:
          "Members can register, select a plan, and track their remaining days. Admins see an expiry dashboard and can renew or pause memberships. All state is stored in Supabase with real-time refresh.",
      },
      {
        title: "Admin dashboard",
        description:
          "Full management panel — member list, attendance tracking, class capacity management, and revenue summary. Designed for daily use by gym staff with minimal training.",
      },
    ],
    highlights: [
      "SSR + static generation for fast public pages and full SEO",
      "End-to-end typed with TypeScript from DB schema to UI components",
      "Supabase Auth with RLS for secure member data isolation",
      "Live class schedule with real-time capacity updates",
      "Mobile-responsive design built for the gym's existing brand identity",
    ],
    screenshotNote:
      "Add a screenshot of energym-ks.com here — use browser devtools full-page capture.",
  },
  {
    number: "03",
    name: "TelecomMS",
    tagline: "Telecom management system",
    description:
      "An enterprise-grade telecom management platform with a multi-role architecture — customer portal, admin panel, and reporting layer. Handles subscriber management, service provisioning, billing tracking, and operational reporting for a telecom operator.",
    url: null,
    urlLabel: "Private — not publicly deployed",
    isPrivate: true,
    accentColor: "#34d399",
    stack: [
      "React",
      "TypeScript",
      "Laravel",
      "PHP",
      "MySQL",
      "Tailwind CSS",
      "React Query",
      "React Hook Form",
      "Zod",
      "Recharts",
    ],
    architecture: [
      {
        title: "Decoupled frontend/backend",
        description:
          "React SPA communicates with a Laravel REST API over JSON. Authentication uses Laravel Sanctum with token-based sessions. The separation allows the frontend to be independently deployed and versioned.",
      },
      {
        title: "Multi-role access control",
        description:
          "Three distinct roles — subscriber, operator, and superadmin — each with scoped views and API permissions. Laravel middleware enforces role checks server-side; the frontend renders role-appropriate UI from the returned user object.",
      },
      {
        title: "Subscriber management",
        description:
          "Full CRUD for subscribers, service plans, and activations. Operators can provision new services, suspend accounts, or modify plans. All actions are logged with a timestamp and operator ID for audit purposes.",
      },
      {
        title: "Billing and reporting",
        description:
          "Invoice generation and payment status tracking per subscriber. Admin reporting layer aggregates revenue, churn, and active subscriptions over configurable date ranges, visualised with Recharts charts.",
      },
      {
        title: "Laravel API design",
        description:
          "Resources and collections pattern throughout — all API responses are shaped through Laravel API Resources, giving a consistent JSON contract between backend and frontend regardless of internal schema changes.",
      },
    ],
    highlights: [
      "Full-stack ownership: schema design, API, frontend, and deployment",
      "Multi-role system enforced at both API and UI layer",
      "Audit log for all operator actions",
      "Revenue and subscriber reporting with date-range filtering",
      "Laravel Sanctum token auth with CSRF protection",
    ],
    screenshotNote:
      "Add a local screenshot of the TelecomMS dashboard here — drag it into /public/telecomms.png.",
  },
];

const TechBadge = ({ label, color }: { label: string; color: string }) => (
  <span
    className="text-xs px-2.5 py-1 rounded-md border font-medium"
    style={{
      borderColor: `${color}25`,
      backgroundColor: `${color}0d`,
      color: `${color}cc`,
    }}
  >
    {label}
  </span>
);

const ProjectCard = ({ project }: { project: Project }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="group rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] hover:border-[rgba(255,255,255,0.1)] transition-all duration-300 overflow-hidden">
      {/* Screenshot placeholder */}
      <div
        className="relative w-full h-56 md:h-72 flex items-center justify-center overflow-hidden"
        style={{ backgroundColor: `${project.accentColor}08` }}
      >
        {/*
          Replace the content below with your actual screenshot:
          <img
            src={`/screenshots/${project.name.toLowerCase()}.png`}
            alt={`${project.name} screenshot`}
            className="w-full h-full object-cover object-top"
          />
        */}
        <div className="text-center px-6">
          <p
            className="text-6xl font-black opacity-10 mb-3"
            style={{ color: project.accentColor }}
          >
            {project.number}
          </p>
          <p className="text-white/20 text-sm">{project.screenshotNote}</p>
        </div>
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(to bottom, transparent 40%, #07051a)`,
          }}
        />
      </div>

      <div className="p-6 md:p-8">
        {/* Header row */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span
                className="text-xs font-mono font-bold"
                style={{ color: `${project.accentColor}80` }}
              >
                {project.number}
              </span>
              {project.isPrivate && (
                <span className="flex items-center gap-1 text-[10px] text-white/30 border border-white/10 rounded px-2 py-0.5">
                  <Lock size={10} />
                  Private
                </span>
              )}
            </div>
            <h3 className="text-2xl font-bold text-white">{project.name}</h3>
            <p className="text-sm text-white/40 mt-0.5">{project.tagline}</p>
          </div>

          {project.url ? (
            <a
              href={project.url}
              target="_blank"
              rel="noreferrer"
              className="flex-shrink-0 flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border transition-all"
              style={{
                borderColor: `${project.accentColor}30`,
                backgroundColor: `${project.accentColor}0d`,
                color: `${project.accentColor}cc`,
              }}
            >
              <ExternalLink size={12} />
              {project.urlLabel}
            </a>
          ) : (
            <span className="flex-shrink-0 flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-white/10 text-white/25">
              <Lock size={12} />
              Private
            </span>
          )}
        </div>

        {/* Description */}
        <p className="text-white/50 text-sm leading-relaxed mb-6">
          {project.description}
        </p>

        {/* Tech stack */}
        <div className="flex flex-wrap gap-2 mb-6">
          {project.stack.map((tech) => (
            <TechBadge key={tech} label={tech} color={project.accentColor} />
          ))}
        </div>

        {/* Highlights */}
        <ul className="space-y-2 mb-6">
          {project.highlights.map((h) => (
            <li key={h} className="flex items-start gap-2.5 text-sm text-white/45">
              <span
                className="mt-1.5 flex-shrink-0 w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: project.accentColor }}
              />
              {h}
            </li>
          ))}
        </ul>

        {/* Expandable architecture deep-dive */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between py-3 px-4 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] text-white/40 hover:text-white/60 text-sm transition-all"
        >
          <span>Architecture deep-dive</span>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {expanded && (
          <div className="mt-4 grid md:grid-cols-2 gap-4">
            {project.architecture.map((item) => (
              <div
                key={item.title}
                className="p-4 rounded-xl border border-white/[0.06] bg-white/[0.02]"
              >
                <p
                  className="text-sm font-semibold mb-2"
                  style={{ color: `${project.accentColor}cc` }}
                >
                  {item.title}
                </p>
                <p className="text-xs text-white/40 leading-relaxed">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const ProjectsSection = () => {
  return (
    <section id="projects" className="relative py-32 bg-[#07051a]">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-px bg-gradient-to-r from-transparent via-[rgba(168,85,247,0.3)] to-transparent" />

      <div className="max-w-6xl mx-auto px-6">
        <div className="mb-16">
          <p className="text-xs uppercase tracking-[0.2em] text-[#a855f7] font-semibold mb-4">
            Work
          </p>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Projects
          </h2>
          <p className="text-white/40 max-w-xl text-base leading-relaxed">
            Three production applications, each with real users and real
            trade-offs. Click "Architecture deep-dive" on any card to see how
            it's built.
          </p>
        </div>

        <div className="flex flex-col gap-8">
          {PROJECTS.map((p) => (
            <ProjectCard key={p.number} project={p} />
          ))}
        </div>
      </div>
    </section>
  );
};

export { ProjectsSection };
