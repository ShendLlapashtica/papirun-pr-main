import { useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, UtensilsCrossed } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCart } from '@/contexts/CartContext';
import { useLiveMenuItems, useOfertaEnabled } from '@/hooks/useLiveStorefrontData';
import { useAuth } from '@/contexts/AuthContext';
import AppMenuCard from './AppMenuCard';
import OpenClosedBar from '@/components/OpenClosedBar';
import FavoritesCarousel from './FavoritesCarousel';
import LastOrderCard from './LastOrderCard';
import OfertaRamazani from '@/components/OfertaRamazani';

const AppHome = () => {
  const { language, t } = useLanguage();
  const { user } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { items: menuItems, isLoading } = useLiveMenuItems();
  const isOfertaEnabled = useOfertaEnabled();
  const { addToCart } = useCart();

  const search = params.get('search') ?? '';
  const [activeCategory, setActiveCategory] = useState('sandwich');
  const [visibleCount, setVisibleCount] = useState(8);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const openProduct = (id: string) => {
    navigate(`/app/product/${id}`);
  };

  useEffect(() => {
    if (search.trim()) setActiveCategory('all');
  }, [search]);

  const visibleItems = useMemo(() => menuItems.filter((i) => i.category !== 'sides'), [menuItems]);

  const filtered = useMemo(() => {
    let items = visibleItems;
    if (activeCategory !== 'all') items = items.filter((i) => i.category === activeCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(
        (i) =>
          i.name[language].toLowerCase().includes(q) ||
          i.ingredients.some((ing) => ing.toLowerCase().includes(q))
      );
    }
    return items;
  }, [visibleItems, activeCategory, search, language]);

  useEffect(() => {
    setVisibleCount(8);
  }, [activeCategory, search, language, menuItems.length]);

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + 4, filtered.length));
        }
      },
      { rootMargin: '180px 0px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [filtered.length]);

  const visibleProducts = filtered.slice(0, visibleCount);

  const categories = [
    { id: 'all', label: t.categories.all },
    { id: 'salad', label: t.categories.salads },
    { id: 'fajita', label: t.categories.fajitas },
    { id: 'sandwich', label: t.categories.sandwiches },
  ];

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return language === 'sq' ? 'Mirëmëngjes' : 'Good morning';
    if (h < 18) return language === 'sq' ? 'Mirëdita' : 'Good afternoon';
    return language === 'sq' ? 'Mirëmbrëma' : 'Good evening';
  })();
  const firstName = user?.user_metadata?.first_name || user?.email?.split('@')[0] || '';

  return (
    <div className="pb-8 will-change-transform relative min-h-screen">
      {/* Dynamic ambient background glow */}
      <div className="absolute top-0 left-0 right-0 h-96 bg-gradient-to-b from-primary/10 to-transparent pointer-events-none -z-10" />
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/20 blur-[120px] pointer-events-none -z-10 animate-pulse-soft" />

      {/* Premium greeting hero */}
      <div className="px-4 pt-5 pb-4">
        <div className="relative overflow-hidden rounded-[32px] p-6 text-white shadow-2xl"
             style={{ background: 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.8) 100%)' }}>
          
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay" />
          
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-1 opacity-90">
              <UtensilsCrossed className="w-4 h-4" />
              <p className="text-xs font-semibold tracking-wide uppercase">
                {greeting}{firstName && `, ${firstName}`}
              </p>
            </div>
            <h1 className="font-display font-extrabold text-[28px] mt-1 leading-tight tracking-tight drop-shadow-md">
              {language === 'sq' ? 'Çfarë do të shijosh sot?' : 'What are you craving?'}
            </h1>
            {search && (
              <p className="text-xs font-semibold mt-3 bg-black/20 inline-block px-3 py-1.5 rounded-full backdrop-blur-md">
                {language === 'sq' ? `Kërkimi: ` : `Searching: `}
                <span className="italic text-white/90">"{search}"</span>
              </p>
            )}
          </div>
          
          {/* Decorative shapes */}
          <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-white/20 rounded-full blur-2xl" />
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-xl translate-x-1/2 -translate-y-1/2" />
        </div>
      </div>

      {isOfertaEnabled && (
        <div className="px-4 mb-4">
          <OfertaRamazani />
        </div>
      )}

      <div className="px-1">
        <FavoritesCarousel />
      </div>
      
      <div className="px-4 mb-2">
        <LastOrderCard />
      </div>

      <div className="flex justify-center mb-4 px-4">
        <OpenClosedBar />
      </div>

      {/* Premium sticky category selector */}
      <div className="sticky top-[env(safe-area-inset-top,0)] z-40 bg-background/80 backdrop-blur-xl border-b border-border/40 mb-4 px-4 py-3 -mx-0">
        <div className="flex items-center gap-2.5 overflow-x-auto scrollbar-hide snap-x">
          {categories.map((c) => {
            const isActive = activeCategory === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setActiveCategory(c.id)}
                className={`snap-start relative px-5 py-2.5 rounded-full text-[13px] font-bold whitespace-nowrap transition-all duration-300 ease-out active:scale-95 ${
                  isActive
                    ? 'text-white shadow-lg shadow-primary/30 transform -translate-y-0.5'
                    : 'bg-secondary/80 text-secondary-foreground/70 hover:bg-secondary hover:text-foreground'
                }`}
                style={isActive ? { background: 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.8) 100%)' } : {}}
              >
                {isActive && (
                  <div className="absolute inset-0 rounded-full bg-white/20 animate-pulse-soft pointer-events-none" />
                )}
                <span className="relative z-10 tracking-wide">{c.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Dynamic Menu grid */}
      <div className="px-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="relative w-12 h-12">
              <div className="absolute inset-0 rounded-full border-[4px] border-primary/20" />
              <div className="absolute inset-0 rounded-full border-[4px] border-t-primary animate-spin" />
            </div>
            <p className="text-sm font-semibold text-muted-foreground animate-pulse">
              {language === 'sq' ? 'Po përgatisim menynë...' : 'Preparing the menu...'}
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 rounded-[32px] bg-secondary/30 border border-border/50 backdrop-blur-md shadow-inner">
            <div className="w-16 h-16 mx-auto bg-background rounded-full flex items-center justify-center mb-4 shadow-sm">
              <Sparkles className="w-8 h-8 text-primary/50" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-1">
              {language === 'sq' ? 'Asgjë nuk u gjet' : 'Nothing found'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {language === 'sq' ? 'Provo të ndryshosh kërkimin ose kategorinë.' : 'Try changing your search or category.'}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 md:gap-4 auto-rows-fr">
              {visibleProducts.map((item, i) => (
                <AppMenuCard
                  key={item.id}
                  item={item}
                  index={i}
                  onAddToCart={addToCart}
                  onCardClick={() => openProduct(item.id)}
                />
              ))}
            </div>
            {visibleCount < filtered.length && (
              <div ref={loadMoreRef} className="h-24 flex items-center justify-center mt-4">
                <div className="w-6 h-6 border-[3px] border-primary/30 border-t-primary rounded-full animate-spin" />
              </div>
            )}
            {visibleCount >= filtered.length && filtered.length > 0 && (
              <div className="py-8 text-center">
                <p className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-widest">
                  — {language === 'sq' ? 'Fundi i menysë' : 'End of menu'} —
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AppHome;
