import { ArrowDown } from "lucide-react";

const GitHubIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
  </svg>
);

const LinkedInIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
  </svg>
);

const HeroSection = () => {
  return (
    <section
      id="hero"
      className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[#07051a]"
    >
      {/* Ambient gradient orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[20%] left-[25%] w-[700px] h-[700px] rounded-full bg-[#4c2a8a] opacity-[0.18] blur-[140px]" />
        <div className="absolute bottom-[10%] right-[15%] w-[500px] h-[500px] rounded-full bg-[#1e0a4a] opacity-[0.25] blur-[120px]" />
        <div className="absolute top-[60%] left-[10%] w-[300px] h-[300px] rounded-full bg-[#7c3aed] opacity-[0.08] blur-[80px]" />
      </div>

      {/* Subtle dot grid */}
      <div
        className="absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.8) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* Content */}
      <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
        {/* Availability pill */}
        <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full border border-[rgba(164,132,215,0.25)] bg-[rgba(85,80,110,0.2)] backdrop-blur-md mb-10">
          <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)] animate-pulse" />
          <span className="text-xs text-white/60 font-medium tracking-wide">
            Open to new opportunities
          </span>
        </div>

        {/* Name */}
        <h1 className="text-[clamp(3.5rem,10vw,7rem)] font-bold text-white leading-[0.9] tracking-tight mb-6">
          Shend
          <br />
          <span className="bg-gradient-to-r from-[#d8b4fe] via-[#a855f7] to-[#7c3aed] bg-clip-text text-transparent">
            Llapashtica
          </span>
        </h1>

        {/* Role */}
        <p className="text-xl md:text-2xl text-white/40 font-light mb-5 tracking-wide">
          Software Engineer
        </p>

        {/* Tagline */}
        <p className="text-base md:text-lg text-white/30 max-w-xl mx-auto leading-relaxed mb-12">
          I design and ship full-stack products — from real-time web apps and
          admin systems to cross-platform native mobile builds.
        </p>

        {/* CTAs */}
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <a
            href="#projects"
            className="px-7 py-3 rounded-xl bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-sm font-semibold shadow-lg shadow-[#7c3aed]/20 transition-all hover:scale-[1.02] hover:shadow-[#7c3aed]/30"
          >
            View Projects
          </a>
          <a
            href="#contact"
            className="px-7 py-3 rounded-xl border border-[rgba(164,132,215,0.35)] bg-[rgba(85,80,110,0.2)] backdrop-blur text-white text-sm hover:bg-[rgba(85,80,110,0.35)] transition-all"
          >
            Get In Touch
          </a>
        </div>

        {/* Social links */}
        <div className="flex items-center justify-center gap-6 mt-10">
          <a
            href="https://github.com/shendllapashtica"
            target="_blank"
            rel="noreferrer"
            className="text-white/25 hover:text-white/70 transition-colors"
            aria-label="GitHub"
          >
            <GitHubIcon />
          </a>
          <a
            href="https://linkedin.com/in/shendllapashtica"
            target="_blank"
            rel="noreferrer"
            className="text-white/25 hover:text-white/70 transition-colors"
            aria-label="LinkedIn"
          >
            <LinkedInIcon />
          </a>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/20 animate-bounce">
        <ArrowDown size={18} />
      </div>
    </section>
  );
};

export { HeroSection };
