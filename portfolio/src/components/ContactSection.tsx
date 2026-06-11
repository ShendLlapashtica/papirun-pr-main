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

const LINKS = [
  {
    label: "GitHub",
    href: "https://github.com/shendllapashtica",
    icon: <GitHubIcon />,
    description: "See the code",
  },
  {
    label: "LinkedIn",
    href: "https://linkedin.com/in/shendllapashtica",
    icon: <LinkedInIcon />,
    description: "Connect professionally",
  },
];

const ContactSection = () => {
  return (
    <section id="contact" className="relative py-32 bg-[#07051a]">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-px bg-gradient-to-r from-transparent via-[rgba(168,85,247,0.3)] to-transparent" />

      {/* Ambient glow */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-[#4c2a8a] opacity-10 blur-[100px] pointer-events-none" />

      <div className="max-w-3xl mx-auto px-6 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-[#a855f7] font-semibold mb-4">
          Contact
        </p>
        <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
          Let's work together
        </h2>
        <p className="text-white/40 text-base leading-relaxed mb-12 max-w-lg mx-auto">
          I'm open to full-time roles, freelance projects, and collaborations.
          The best way to reach me is directly by email.
        </p>

        {/* Email CTA */}
        <a
          href="mailto:shendillapashtica@gmail.com"
          className="group inline-flex items-center gap-3 px-8 py-4 rounded-xl bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-semibold text-base shadow-xl shadow-[#7c3aed]/20 hover:shadow-[#7c3aed]/35 transition-all hover:scale-[1.02] mb-12"
        >
          shendillapashtica@gmail.com
          <span className="group-hover:translate-x-1 transition-transform text-white/60">
            →
          </span>
        </a>

        {/* Social links */}
        <div className="flex items-center justify-center gap-4">
          {LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2.5 px-5 py-3 rounded-xl border border-white/[0.08] bg-white/[0.03] text-white/50 hover:text-white hover:border-white/[0.15] hover:bg-white/[0.06] transition-all text-sm"
            >
              {link.icon}
              {link.label}
            </a>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-24 text-center">
        <p className="text-white/20 text-xs">
          Shend Llapashtica © {new Date().getFullYear()}
        </p>
      </div>
    </section>
  );
};

export { ContactSection };
