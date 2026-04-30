import { useEffect, useState, type ReactNode, type FormEvent } from 'react';
import { Settings as SettingsIcon, Search, Globe, X } from 'lucide-react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import logo from '@/assets/logo.png';
import { useLanguage } from '@/contexts/LanguageContext';
import BottomNav from './BottomNav';
import SplashScreen, { shouldShowSplash } from './SplashScreen';
import PullToRefresh from './PullToRefresh';

/**
 * AppShell — the phone-frame wrapper for the App experience (/home).
 *
 * Header parity with Web (per user feedback):
 *  - Logo + Papirun® brand + slogan (left)
 *  - Search button (expands inline, navigates to /home with ?search=...)
 *  - Language toggle (SQ/EN) — same pill style as Web
 *  - Settings button (replaces the burger; opens Profile/Settings tab)
 *
 * Bug fix: tapping the brand/Settings/etc. previously could leak ?tab params
 * across navigations. We now write the search-params atomically.
 */
const AppShell = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const { language, setLanguage, t } = useLanguage();
  const [splashed, setSplashed] = useState(() => !shouldShowSplash());
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState(() => params.get('search') ?? '');

  // Mark <html> as "in-app shell" so child components (MenuCard, etc.) can
  // gate features that should ONLY appear for app users.
  useEffect(() => {
    document.documentElement.dataset.appShell = 'true';
    return () => { delete document.documentElement.dataset.appShell; };
  }, []);

  const handleRefresh = async () => {
    window.dispatchEvent(new Event('papirun:refresh'));
    await new Promise((r) => setTimeout(r, 600));
  };

  const onHome = location.pathname === '/home';

  const goSettings = () => {
    if (onHome) {
      const next = new URLSearchParams(params);
      next.set('tab', 'profile');
      setParams(next, { replace: true });
    } else {
      navigate('/home?tab=profile');
    }
  };

  const goHomeBrand = () => {
    // Brand click ALWAYS goes to the actual Home (clears tab param).
    if (onHome) {
      const next = new URLSearchParams(params);
      next.delete('tab');
      setParams(next, { replace: true });
    } else {
      navigate('/home');
    }
  };

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    const next = new URLSearchParams(params);
    if (q) next.set('search', q); else next.delete('search');
    next.delete('tab'); // jump back to Kreu so results are visible
    if (onHome) setParams(next, { replace: true });
    else navigate(`/home?${next.toString()}`);
    setSearchOpen(false);
  };

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchQuery('');
    if (params.get('search')) {
      const next = new URLSearchParams(params);
      next.delete('search');
      setParams(next, { replace: true });
    }
  };

  const toggleLanguage = () => setLanguage(language === 'sq' ? 'en' : 'sq');

  return (
    <>
      {!splashed && <SplashScreen onDone={() => setSplashed(true)} />}
      {/* Phone-shaped frame */}
      <div
        className="app-shell-sage mx-auto h-[100dvh] overflow-y-auto overflow-x-hidden scrollbar-hide pb-32 relative scroll-touch"
        style={{
          maxWidth: '430px',
          paddingTop: 'env(safe-area-inset-top)',
          background: 'hsl(var(--app-background))',
          boxShadow: '0 0 0 1px hsl(var(--app-border))',
        }}
      >
        {/* Glassmorphic header — Web parity */}
        <header className="sticky top-0 z-40 px-3.5 pt-2 pb-2">
          <div className="app-glass rounded-[28px] px-3.5 py-2.5 flex items-center justify-between gap-3">
            {/* Brand */}
            <button
              onClick={goHomeBrand}
              className="flex items-center gap-2.5 min-w-0 active:scale-95 transition-all"
              aria-label="Papirun"
            >
              <div
                className="w-10 h-10 rounded-xl overflow-hidden bg-primary flex items-center justify-center shrink-0"
              >
                <img src={logo} alt="Papirun" className="w-full h-full object-cover" />
              </div>
                <div className="text-left min-w-0">
                  <h1 className="font-display font-bold text-[17px] leading-none tracking-tight text-foreground">
                  Papirun<span className="text-primary">®</span>
                </h1>
                  <p className="text-[10px] text-foreground/70 mt-0.5 truncate">{t.header.slogan}</p>
              </div>
            </button>

            {/* Right actions: Search · Lang · Settings */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setSearchOpen((v) => !v)}
                className="app-quiet-button w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition-all"
                aria-label="Kërko"
              >
                <Search className="w-4 h-4 text-foreground/80" strokeWidth={2.2} />
              </button>

              <button
                onClick={toggleLanguage}
                className="app-quiet-button flex items-center gap-1 px-2.5 h-9 rounded-full active:scale-95 transition-all text-xs font-semibold"
                aria-label="Ndrysho gjuhën"
              >
                <Globe className="w-3.5 h-3.5" />
                <span>{language.toUpperCase()}</span>
              </button>

              <button
                onClick={goSettings}
                className="app-quiet-button w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition-all"
                aria-label="Cilësimet"
                title="Cilësimet"
              >
                <SettingsIcon className="w-4 h-4 text-primary" strokeWidth={2.2} />
              </button>
            </div>
          </div>

          {/* Expandable search */}
          {searchOpen && (
            <form onSubmit={handleSearchSubmit} className="px-1.5 pt-2 animate-slide-up">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/60 pointer-events-none" />
                <input
                  type="search"
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t.hero.searchPlaceholder}
                  className="app-glass w-full pl-10 pr-10 py-2.5 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <button
                  type="button"
                  onClick={closeSearch}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-secondary/40"
                  aria-label="Mbyll kërkimin"
                >
                  <X className="w-4 h-4 text-foreground/60" />
                </button>
              </div>
            </form>
          )}
        </header>

        <PullToRefresh onRefresh={handleRefresh}>{children}</PullToRefresh>
      </div>
      <BottomNav />
    </>
  );
};

export default AppShell;
