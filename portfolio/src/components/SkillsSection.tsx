const CATEGORIES = [
  {
    title: "Frontend",
    color: "#a855f7",
    skills: [
      "React 18",
      "Next.js 14",
      "TypeScript",
      "Vite",
      "Tailwind CSS",
      "shadcn/ui",
      "Radix UI",
      "Framer Motion",
      "React Hook Form",
      "Zod",
      "TanStack Query",
      "Recharts",
    ],
  },
  {
    title: "Backend",
    color: "#22d3ee",
    skills: [
      "Supabase",
      "PostgreSQL",
      "Supabase Realtime",
      "Supabase Auth",
      "Row-level Security",
      "Laravel",
      "PHP",
      "MySQL",
      "REST API design",
      "Laravel Sanctum",
    ],
  },
  {
    title: "Native & DevOps",
    color: "#34d399",
    skills: [
      "Capacitor v8",
      "iOS build",
      "Android build",
      "PWA",
      "Vercel",
      "Git",
      "GitHub",
      "Vite build pipeline",
    ],
  },
  {
    title: "Testing & Tooling",
    color: "#fb923c",
    skills: [
      "Vitest",
      "Testing Library",
      "ESLint",
      "TypeScript strict mode",
      "React DevTools",
      "Supabase CLI",
    ],
  },
];

const SkillsSection = () => {
  return (
    <section id="skills" className="relative py-32 bg-[#07051a]">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-px bg-gradient-to-r from-transparent via-[rgba(168,85,247,0.3)] to-transparent" />

      <div className="max-w-6xl mx-auto px-6">
        <div className="mb-16">
          <p className="text-xs uppercase tracking-[0.2em] text-[#a855f7] font-semibold mb-4">
            Stack
          </p>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Skills &amp; Tools
          </h2>
          <p className="text-white/40 max-w-xl text-base">
            Technologies I use daily across frontend, backend, mobile, and
            infrastructure.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {CATEGORIES.map((cat) => (
            <div
              key={cat.title}
              className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6"
            >
              <div className="flex items-center gap-2.5 mb-5">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: cat.color }}
                />
                <h3
                  className="text-sm font-semibold"
                  style={{ color: `${cat.color}cc` }}
                >
                  {cat.title}
                </h3>
              </div>
              <ul className="space-y-2.5">
                {cat.skills.map((skill) => (
                  <li key={skill} className="flex items-center gap-2">
                    <div
                      className="w-1 h-1 rounded-full flex-shrink-0"
                      style={{ backgroundColor: `${cat.color}60` }}
                    />
                    <span className="text-sm text-white/45">{skill}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export { SkillsSection };
