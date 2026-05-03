import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Minus, ShoppingBag, Check, ChevronDown, Sparkles } from 'lucide-react';
import { getIngredientName } from '@/data/ingredientTranslations';
import type { SelectedExtra } from '@/types/menuExtra';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCart } from '@/contexts/CartContext';
import { useLiveMenuExtras, useLiveMenuItems } from '@/hooks/useLiveStorefrontData';
import AppMenuCard from './AppMenuCard';
import { cn, getOptimizedImage } from '@/lib/utils';
import { haptic } from '@/lib/native';

/**
 * App product page — full page (not a modal) inside the AppShell.
 *
 * Mirrors the Web ProductView structure:
 *  - Big square image on top (the "buka" gets focus)
 *  - Title + sage price
 *  - Ingredients chips (toggleable)
 *  - Extras (collapsible)
 *  - Sticky add-to-cart bar at the bottom
 *
 * BottomNav stays visible (rendered by AppShell), so the user can jump back to
 * Kreu / Shporta at any moment.
 */
const AppProductView = () => {
  const { id: paramId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const id = paramId ?? '';
  const { language } = useLanguage();
  const { addToCart } = useCart();
  const { items: menuItems } = useLiveMenuItems();
  const menuExtras = useLiveMenuExtras();

  const item = menuItems.find((m) => m.id === id);

  const [quantity, setQuantity] = useState(1);
  const [showExtras, setShowExtras] = useState(false);
  const [checkedIngredients, setCheckedIngredients] = useState<Record<string, boolean>>({});
  const [checkedExtras, setCheckedExtras] = useState<Record<string, boolean>>({});

  const availableExtras = useMemo(
    () => (item?.category === 'sides' ? [] : menuExtras.filter((e) => e.isActive).sort((a, b) => a.sortOrder - b.sortOrder)),
    [item?.category, menuExtras],
  );

  useEffect(() => {
    if (!item) return;
    const ing: Record<string, boolean> = {};
    item.ingredients.forEach((i) => (ing[i] = true));
    setCheckedIngredients(ing);
    const ext: Record<string, boolean> = {};
    availableExtras.forEach((e) => (ext[e.id] = false));
    setCheckedExtras(ext);
    setQuantity(1);
    setShowExtras(false);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [item?.id, availableExtras]);

  const goBack = () => {
    // Prefer browser history so the user returns to wherever they came from
    // (Kreu, Shporta, or another product). Fallback to /home.
    if (window.history.length > 1) navigate(-1);
    else navigate('/home');
  };

  if (!item) {
    return (
      <div className="px-4 pt-6">
        <button
          onClick={goBack}
          className="app-quiet-button inline-flex items-center gap-2 px-3 h-9 rounded-full text-xs font-semibold"
        >
          <ArrowLeft className="w-4 h-4" /> {language === 'sq' ? 'Kthehu' : 'Back'}
        </button>
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-7 h-7 border-[3px] border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-sm text-foreground/70">
            {language === 'sq' ? 'Duke u ngarkuar...' : 'Loading...'}
          </p>
        </div>
      </div>
    );
  }

  const selectedExtras: SelectedExtra[] = availableExtras
    .filter((e) => checkedExtras[e.id])
    .map((e) => ({ id: e.id, name: e.name, price: e.price }));

  const extrasUnit = selectedExtras.reduce((s, e) => s + e.price, 0);
  const totalPrice = (item.price + extrasUnit) * quantity;

  const handleAdd = () => {
    const removed = Object.entries(checkedIngredients).filter(([, v]) => !v).map(([k]) => k);
    for (let i = 0; i < quantity; i++) addToCart(item, removed, selectedExtras);
    haptic('success');
    goBack();
  };

  return (
    <div className="pb-32">
      {/* Back button */}
      <div className="px-4 pt-3 pb-2">
        <button
          onClick={goBack}
          className="app-quiet-button inline-flex items-center gap-2 px-3 h-9 rounded-full text-xs font-semibold text-foreground"
          aria-label={language === 'sq' ? 'Kthehu' : 'Back'}
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={2.4} />
          {language === 'sq' ? 'Kthehu' : 'Back'}
        </button>
      </div>

      {/* Hero image — premium glass frame */}
      <div className="px-4">
        <div className="app-glass-strong rounded-[36px] overflow-hidden p-3.5">
          <div className="aspect-square rounded-[28px] overflow-hidden bg-white/35 backdrop-blur-md">
            <img
              src={getOptimizedImage(item.image)}
              alt={item.name[language]}
              className="w-full h-full object-contain bg-white p-7"
              loading="eager"
            />
          </div>
        </div>
      </div>

      {/* Title + price + description (mirror web order) */}
      <div className="px-6 pt-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="px-3 py-1 rounded-full app-glass-chip text-[10px] font-bold uppercase tracking-wider">
            {item.category}
          </span>
          {!item.isAvailable && (
            <span className="px-3 py-1 rounded-full bg-destructive/15 text-destructive text-[10px] font-bold uppercase tracking-wider">
              {language === 'sq' ? 'E shitur' : 'Sold out'}
            </span>
          )}
        </div>
        <h1 className="font-display font-semibold text-[28px] leading-[1.15] tracking-tight text-[#1A1A1A]">
          {item.name[language]}
        </h1>
        <p className="text-[22px] font-semibold text-[#1A1A1A] mt-2 tracking-tight">
          €{item.price.toFixed(2)}
        </p>
        <p
          className="text-[14px] leading-[1.55] mt-4 text-[#1A1A1A]/80"
          style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
        >
          {item.description[language]}
        </p>
      </div>

      {/* Ingredients — premium glass chips */}
      <div className="px-6 pt-7">
        <h3 className="text-[11px] uppercase tracking-[0.12em] font-bold text-[#1A1A1A]/55 mb-3">
          {language === 'sq' ? 'Përbërësit' : 'Ingredients'}
        </h3>
        <div className="flex flex-wrap gap-2">
          {item.ingredients.map((ing) => {
            const checked = checkedIngredients[ing] !== false;
            return (
              <button
                key={ing}
                onClick={() => { haptic('light'); setCheckedIngredients((p) => ({ ...p, [ing]: !p[ing] })); }}
                className={cn(
                  'flex items-center gap-2 px-3.5 py-2 rounded-full text-[13px] font-semibold transition-all active:scale-95',
                  checked ? 'app-glass-chip' : 'app-glass-chip-muted line-through'
                )}
                style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
              >
                <div className={cn(
                  'w-[18px] h-[18px] rounded-full flex items-center justify-center transition-colors',
                  checked ? 'bg-[#1A1A1A]' : 'border-2 border-[#1A1A1A]/30 bg-transparent'
                )}>
                  {checked && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                </div>
                {getIngredientName(ing, language)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Extras */}
      {availableExtras.length > 0 && (
        <div className="px-6 pt-7">
          <button
            onClick={() => setShowExtras((v) => !v)}
            className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.12em] text-[#1A1A1A]/70 active:scale-95 transition-transform"
          >
            <ChevronDown className={cn('w-4 h-4 transition-transform', showExtras && 'rotate-180')} strokeWidth={2.6} />
            {language === 'sq' ? 'Ekstra' : 'Extras'}
            {selectedExtras.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-[#1A1A1A] text-white text-[10px] font-bold">
                {selectedExtras.length}
              </span>
            )}
          </button>
          {showExtras && (
            <div className="flex flex-wrap gap-2 mt-3 animate-slide-up">
              {availableExtras.map((extra) => {
                const checked = checkedExtras[extra.id] === true;
                return (
                  <button
                    key={extra.id}
                    onClick={() => { haptic('light'); setCheckedExtras((p) => ({ ...p, [extra.id]: !p[extra.id] })); }}
                    className={cn(
                      'flex items-center gap-2 px-3.5 py-2 rounded-full text-[13px] font-semibold transition-all active:scale-95',
                      checked ? 'app-glass-chip ring-1 ring-[#1A1A1A]/15' : 'app-glass-chip-muted'
                    )}
                    style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
                  >
                    <div className={cn(
                      'w-[18px] h-[18px] rounded-full flex items-center justify-center transition-colors',
                      checked ? 'bg-[#1A1A1A]' : 'border-2 border-[#1A1A1A]/30 bg-transparent'
                    )}>
                      {checked && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                    </div>
                    + {extra.name[language]} · €{extra.price.toFixed(2)}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Sticky add-to-cart bar — sits ABOVE the related products and ABOVE the navbar */}
      <div className="px-4 pt-8">
        <div className="app-glass-strong rounded-full p-2 flex items-center gap-2">
          <div className="flex items-center gap-1 bg-white/40 backdrop-blur-md rounded-full p-1 border border-white/40">
            <button
              onClick={() => { haptic('light'); setQuantity(Math.max(1, quantity - 1)); }}
              className="w-9 h-9 rounded-full flex items-center justify-center text-[#1A1A1A] active:scale-90 transition-all"
              aria-label="-"
            >
              <Minus className="w-4 h-4" strokeWidth={2.4} />
            </button>
            <span className="w-7 text-center font-bold text-[15px] text-[#1A1A1A]">{quantity}</span>
            <button
              onClick={() => { haptic('light'); setQuantity(quantity + 1); }}
              className="w-9 h-9 rounded-full flex items-center justify-center text-[#1A1A1A] active:scale-90 transition-all"
              aria-label="+"
            >
              <Plus className="w-4 h-4" strokeWidth={2.4} />
            </button>
          </div>
          <button
            onClick={handleAdd}
            disabled={!item.isAvailable}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-full bg-[#1A1A1A] text-white font-semibold text-[14px] active:scale-[0.97] disabled:opacity-50 transition-all"
            style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
          >
            <ShoppingBag className="w-4 h-4" strokeWidth={2.4} />
            {language === 'sq' ? 'Shto' : 'Add'} · €{totalPrice.toFixed(2)}
          </button>
        </div>
      </div>

      {/* Endless scroll: more products like Kreu (placed BELOW the add-to-cart bar) */}
      <RelatedProductsScroll currentId={item.id} />
    </div>
  );
};

/**
 * Endless-scroll grid shown beneath the product detail.
 * Mirrors the Kreu (Home) layout so users can keep browsing without going back.
 */
const RelatedProductsScroll = ({ currentId }: { currentId: string }) => {
  const { language } = useLanguage();
  const { items: menuItems } = useLiveMenuItems();
  const { addToCart } = useCart();
  const navigate = useNavigate();
  const [visibleCount, setVisibleCount] = useState(6);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const list = useMemo(
    () => menuItems.filter((m) => m.category !== 'sides' && m.id !== currentId),
    [menuItems, currentId],
  );

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((p) => Math.min(p + 4, list.length));
        }
      },
      { rootMargin: '220px 0px' },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [list.length]);

  const openProduct = (id: string) => {
    navigate(`/app/product/${id}`);
  };

  if (list.length === 0) return null;

  return (
    <div className="px-4 pt-8">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-primary" />
        <h3 className="text-[13px] uppercase tracking-wider font-bold text-[hsl(var(--app-foreground))]">
          {language === 'sq' ? 'Eksploro më shumë' : 'Discover more'}
        </h3>
      </div>
      <div className="grid grid-cols-2 gap-3 auto-rows-fr">
        {list.slice(0, visibleCount).map((m, i) => (
          <AppMenuCard
            key={m.id}
            item={m}
            index={i}
            onAddToCart={addToCart}
            onCardClick={() => openProduct(m.id)}
          />
        ))}
      </div>
      <div ref={sentinelRef} className="h-12" />
    </div>
  );
};

export default AppProductView;
