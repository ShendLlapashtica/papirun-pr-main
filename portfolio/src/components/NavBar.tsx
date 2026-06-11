import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";

const LINKS = ["About", "Projects", "Skills", "Contact"];

const NavBar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? "py-3 backdrop-blur-xl bg-[rgba(7,5,26,0.8)] border-b border-[rgba(164,132,215,0.1)]"
          : "py-6"
      }`}
    >
      <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
        <a href="#hero" className="text-white font-bold text-lg tracking-tight select-none">
          SL<span className="text-[#a855f7]">.</span>
        </a>

        {/* Desktop */}
        <div className="hidden md:flex items-center gap-8">
          {LINKS.map((l) => (
            <a
              key={l}
              href={`#${l.toLowerCase()}`}
              className="text-sm text-white/50 hover:text-white transition-colors duration-200"
            >
              {l}
            </a>
          ))}
          <a
            href="mailto:shendillapashtica@gmail.com"
            className="text-sm px-4 py-2 rounded-lg border border-[rgba(168,85,247,0.4)] bg-[rgba(168,85,247,0.1)] text-white hover:bg-[rgba(168,85,247,0.2)] transition-all"
          >
            Hire Me
          </a>
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden text-white/60 hover:text-white transition-colors"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden mx-4 mt-2 rounded-xl border border-[rgba(164,132,215,0.15)] bg-[rgba(7,5,26,0.95)] backdrop-blur-xl p-5 flex flex-col gap-5">
          {LINKS.map((l) => (
            <a
              key={l}
              href={`#${l.toLowerCase()}`}
              onClick={() => setOpen(false)}
              className="text-sm text-white/60 hover:text-white transition-colors"
            >
              {l}
            </a>
          ))}
          <a
            href="mailto:shendillapashtica@gmail.com"
            className="text-sm text-center py-2 rounded-lg border border-[rgba(168,85,247,0.4)] bg-[rgba(168,85,247,0.1)] text-white"
          >
            Hire Me
          </a>
        </div>
      )}
    </nav>
  );
};

export { NavBar };
