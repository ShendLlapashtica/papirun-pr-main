import { Heart, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { useFavorites } from '@/contexts/FavoritesContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useLiveMenuItems } from '@/hooks/useLiveStorefrontData';
import { getOptimizedImage } from '@/lib/utils';

/**
 * Horizontal carousel of the user's favorite products.
 * Only shown for logged-in users with at least one favorite.
 */
const FavoritesCarousel = () => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const { favorites } = useFavorites();
  const { addToCart } = useCart();
  const { items: menuItems } = useLiveMenuItems();

  if (!user || favorites.size === 0) return null;
  const favProducts = menuItems.filter((m) => favorites.has(m.id));
  if (favProducts.length === 0) return null;

  return (
    <section className="px-4 mb-3">
      <div className="flex items-center gap-2 mb-2">
        <Heart className="w-4 h-4 text-primary fill-primary" strokeWidth={2.4} />
        <h2 className="font-display font-bold text-sm">
          {language === 'sq' ? 'Të preferuarat tuaja' : 'Your favorites'}
        </h2>
      </div>
      <div className="flex gap-2.5 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-1">
        {favProducts.map((p) => (
          <button
            key={p.id}
            onClick={() => {
              addToCart(p);
              toast.success(language === 'sq' ? 'U shtua' : 'Added');
            }}
            className="shrink-0 w-28 rounded-2xl green-glass overflow-hidden active:scale-95 transition-all"
          >
            <div className="h-20 bg-white/70 flex items-center justify-center">
              <img src={getOptimizedImage(p.image)} alt={p.name[language]} className="h-full w-full object-contain mix-blend-screen bg-white p-2" />
            </div>
            <div className="p-2 text-left">
              <p className="text-[11px] font-semibold line-clamp-1">{p.name[language]}</p>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[11px] font-bold text-primary">€{p.price.toFixed(2)}</span>
                <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                  <Plus className="w-3 h-3" strokeWidth={2.8} />
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
};

export default FavoritesCarousel;
