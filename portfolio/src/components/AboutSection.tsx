const STATS = [
  { value: "3", label: "Production projects" },
  { value: "3+", label: "Years building" },
  { value: "3", label: "Platforms shipped\n(web, iOS, Android)" },
];

const AboutSection = () => {
  return (
    <section id="about" className="relative py-32 bg-[#07051a]">
      {/* Faint divider orb */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-px bg-gradient-to-r from-transparent via-[rgba(168,85,247,0.3)] to-transparent" />

      <div className="max-w-6xl mx-auto px-6">
        <div className="grid md:grid-cols-2 gap-16 items-center">
          {/* Left — text */}
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[#a855f7] font-semibold mb-4">
              About Me
            </p>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
              Building real products,<br />
              <span className="text-white/40">not prototypes</span>
            </h2>
            <div className="space-y-4 text-white/50 text-base leading-relaxed">
              <p>
                I'm a software engineer based in Kosovo, focused on building
                production-ready full-stack applications. I care about the
                complete product — from database schema and API design to UI
                polish and deployment pipelines.
              </p>
              <p>
                My work spans food delivery platforms, gym management systems,
                and enterprise telecom tooling. Each project ships with real
                users, real constraints, and real trade-offs.
              </p>
              <p>
                I work primarily in React, TypeScript, and Node — with a strong
                lean toward Supabase for backend infrastructure and Capacitor
                for taking web apps native.
              </p>
            </div>

            <div className="flex flex-wrap gap-3 mt-8">
              {["React", "TypeScript", "Next.js", "Supabase", "Laravel", "Capacitor", "TanStack Query", "Tailwind CSS"].map((skill) => (
                <span
                  key={skill}
                  className="text-xs px-3 py-1.5 rounded-md border border-[rgba(168,85,247,0.2)] bg-[rgba(168,85,247,0.07)] text-white/60"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>

          {/* Right — stats + photo placeholder */}
          <div className="flex flex-col gap-6">
            {/* Photo card */}
            <div className="relative rounded-2xl overflow-hidden border border-[rgba(164,132,215,0.15)] bg-[rgba(85,80,110,0.1)]">
              {/*
                Replace the div below with an <img> once you have a professional photo:
                <img src="/photo.jpg" alt="Shend Llapashtica" className="w-full h-72 object-cover object-top" />
              */}
              <div className="w-full h-64 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#7c3aed] to-[#a855f7] mx-auto mb-3 flex items-center justify-center text-white text-2xl font-bold">
                    SL
                  </div>
                  <p className="text-white/30 text-sm">Add your photo here</p>
                </div>
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-[#07051a] via-transparent to-transparent opacity-60" />
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-4">
              {STATS.map((s) => (
                <div
                  key={s.label}
                  className="rounded-xl border border-[rgba(164,132,215,0.15)] bg-[rgba(85,80,110,0.1)] p-4 text-center"
                >
                  <p className="text-3xl font-bold text-white mb-1">{s.value}</p>
                  <p className="text-[11px] text-white/35 leading-tight whitespace-pre-line">
                    {s.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export { AboutSection };
