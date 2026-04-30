import { useState, useMemo, useRef, useEffect } from 'react';
import { reviews } from '@/data/menuData';
import type { MenuItem } from '@/types/menu';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCart } from '@/contexts/CartContext';
import { useLiveMenuItems, useOfertaEnabled, useLiveVisibleOffers } from '@/hooks/useLiveStorefrontData';
import SEO from '@/components/SEO';
import Header from '@/components/Header';
import HeroSection from '@/components/HeroSection';
import OfertaRamazani from '@/components/OfertaRamazani';
import OpenClosedBar from '@/components/OpenClosedBar';
import SearchBar from '@/components/SearchBar';
import MenuCard from '@/components/MenuCard';
import Tray from '@/components/Tray';
import CheckoutModal from '@/components/CheckoutModal';
import ReviewCard from '@/components/ReviewCard';
import LocationMap from '@/components/LocationMap';
import Footer from '@/components/Footer';
import { getCartTotal } from '@/lib/cartPricing';

const Index = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('sandwich');
  const [revealedCount, setRevealedCount] = useState(2);
  const { t, language } = useLanguage();
  const { items: menuItems, isLoading: isMenuLoading } = useLiveMenuItems();
  const isOfertaEnabled = useOfertaEnabled();
  const menuRef = useRef<HTMLElement>(null);
  const { cart, cartCount, isTrayOpen, isCheckoutOpen, setIsTrayOpen, setIsCheckoutOpen, addToCart, updateQuantity, updateNote, removeFromCart, clearCart } = useCart();

  const cartTotal = getCartTotal(cart);

  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(() => {}, () => {}, { enableHighAccuracy: false, timeout: 10000 });
    }
  }, []);

  const visibleItems = useMemo(() => menuItems.filter((item) => item.category !== 'sides'), [menuItems]);

  const filteredItems = useMemo(() => {
    let items = visibleItems;
    if (activeCategory !== 'all') {
      items = items.filter((item) => item.category === activeCategory);
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      items = items.filter(
        (item) => item.name[language].toLowerCase().includes(query) || item.ingredients.some((ing) => ing.toLowerCase().includes(query))
      );
    }
    return items;
  }, [searchQuery, activeCategory, language, visibleItems]);

  const scrollToMenu = () => menuRef.current?.scrollIntoView({ behavior: 'smooth' });

  const categories = [
    { id: 'all', label: t.categories.all },
    { id: 'salad', label: t.categories.salads },
    { id: 'fajita', label: t.categories.fajitas },
    { id: 'sandwich', label: t.categories.sandwiches },
  ];

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Papirun — Ushqim i shëndetshëm në Prishtinë | House of Crunch"
        description="Porosit sallata, fajita dhe sanduiçe krokante nga Papirun në Prishtinë & Çagllavicë. Dërgesa e shpejtë, shije autentike."
        canonical="https://papirun.net/"
      />
      <Header cartCount={cartCount} onCartClick={() => setIsTrayOpen(true)} />

      <main>
        <HeroSection onViewMenu={scrollToMenu} />
        {isOfertaEnabled && <OfertaRamazani />}

        <section ref={menuRef} className="py-8 sm:py-12 lg:py-16 relative">
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at center, rgba(157,192,160,0.12) 0%, transparent 70%)' }} />
          <div className="container mx-auto px-4 relative z-10">
            <div className="mb-4 sm:mb-6">
              <SearchBar value={searchQuery} onChange={setSearchQuery} />
            </div>

            <div className="flex justify-center mb-6 sm:mb-8">
              <OpenClosedBar />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-4 scrollbar-hide mb-6 sm:mb-8">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-4 py-2 sm:px-5 sm:py-2.5 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap transition-all ${
                    activeCategory === cat.id ? 'bg-primary text-primary-foreground shadow-glow' : 'bg-secondary hover:bg-secondary/80'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {isMenuLoading ? (
              <div className="flex flex-col items-center justify-center py-12 sm:py-16 gap-3">
                <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                <p className="text-sm text-muted-foreground">{language === 'sq' ? 'Duke u ngarkuar...' : 'Loading...'}</p>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-12 sm:py-16">
                <p className="text-muted-foreground">{language === 'sq' ? 'Nuk u gjet asnjë produkt.' : 'No products found.'}</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 overflow-x-clip">
                {filteredItems.map((item, index) => (
                  <MenuCard
                    key={item.id}
                    item={item}
                    index={index}
                    onAddToCart={addToCart}
                    revealed={index <= revealedCount}
                    onImageReady={() => {
                      setRevealedCount((prev) => Math.max(prev, index + 1));
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="py-12 sm:py-16 bg-secondary/30">
          <div className="container mx-auto px-4">
            <div className="text-center mb-8 sm:mb-10">
              <h2 className="font-display font-bold text-2xl sm:text-3xl mb-2 sm:mb-3">{t.reviews.title}</h2>
              <p className="text-sm sm:text-base text-muted-foreground">{t.reviews.subtitle}</p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 max-w-5xl mx-auto">
              {reviews.map((review) => (
                <ReviewCard key={review.id} review={review} />
              ))}
            </div>
          </div>
        </section>

        <LocationMap />
      </main>

      <Footer />

      <Tray items={cart} isOpen={isTrayOpen} onClose={() => setIsTrayOpen(false)} onUpdateQuantity={updateQuantity} onRemove={removeFromCart} onCheckout={() => setIsCheckoutOpen(true)} onUpdateNote={updateNote} />

      <CheckoutModal isOpen={isCheckoutOpen} onClose={() => setIsCheckoutOpen(false)} items={cart} total={cartTotal} onSuccess={clearCart} />
    </div>
  );
};

export default Index;
