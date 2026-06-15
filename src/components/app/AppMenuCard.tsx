import { useState } from 'react';
import { Plus, Heart, Check } from 'lucide-react';
import type { MenuItem } from '@/types/menu';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useFavorites } from '@/contexts/FavoritesContext';
import { ingredientNames } from '@/data/ingredientTranslations';
import { cn, getOptimizedImage } from '@/lib/utils';

interface AppMenuCardProps {
  item: MenuItem;
  index?: number;
  onAddToCart: (item: MenuItem) => void;
  onCardClick?: () => void;
}

const AppMenuCard = ({ item, index = 0, onAddToCart, onCardClick }: AppMenuCardProps) => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const { isFavorite, toggleFavorite } = useFavorites();
  const [imageLoaded, setImageLoaded] = useState(false);

  const isEager = index < 2;
  const fav = isFavorite(item.id);
  const showFavorite = !!user;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAddToCart(item);
  };

  const handleToggleFav = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFavorite(item.id);
  };

  const visibleIngredients = item.ingredients.slice(0, 2);

  const localizeIngredient = (raw: string) => {
    const key = raw.toLowerCase().trim();
    const entry = ingredientNames[key];
    return entry ? entry[language] : raw;
  };

  return (
    <div
      onClick={() => onCardClick?.()}
      className={cn(
        'group relative cursor-pointer flex h-full flex-col overflow-hidden rounded-[28px] transition-all duration-300 ease-out active:scale-[0.97]',
        'app-glass',
        !item.isAvailable && 'opacity-60 grayscale',
      )}
    >
      {/* Image frame — white panel matching product view */}
      <div className="relative px-3 pt-3">
        <div className="relative aspect-square rounded-[22px] bg-white/60 overflow-hidden flex items-center justify-center">
          {!imageLoaded && <div className="absolute inset-0 animate-pulse bg-white/40 rounded-[22px]" />}

          {showFavorite && (
            <button
              onClick={handleToggleFav}
              className={cn(
                'absolute top-2.5 right-2.5 z-10 w-7 h-7 rounded-full flex items-center justify-center shadow-sm transition-all duration-300 active:scale-90',
                fav
                  ? 'bg-red-500/10 text-red-500'
                  : 'bg-white/70 text-[#1A1A1A]/40 hover:text-red-500'
              )}
              aria-label={fav ? 'Hiq nga favorites' : 'Shto në favorites'}
            >
              <Heart className={cn('w-3.5 h-3.5', fav && 'scale-110')} fill={fav ? 'currentColor' : 'none'} strokeWidth={2.5} />
            </button>
          )}

          <img
            src={getOptimizedImage(item.image)}
            alt={item.name[language]}
            loading={isEager ? 'eager' : 'lazy'}
            decoding="async"
            fetchPriority={isEager ? 'high' : undefined}
            onLoad={() => setImageLoaded(true)}
            className={cn(
              'w-[80%] h-[80%] object-contain transition-all duration-500',
              imageLoaded
                ? 'opacity-100 scale-100 group-hover:scale-108 group-hover:-rotate-2'
                : 'opacity-0 scale-95 blur-sm'
            )}
          />

          {!item.isAvailable && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-sm rounded-[22px]">
              <span className="px-3 py-1 bg-white/90 text-[#1A1A1A] shadow-sm rounded-full text-[10px] font-bold uppercase tracking-wider">
                {language === 'sq' ? 'E shitur' : 'Sold out'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Text + actions */}
      <div className="px-3.5 pt-3 pb-3.5 flex flex-col flex-1">
        <h3 className="font-display font-bold text-[14px] leading-tight line-clamp-2 text-[#1A1A1A] tracking-tight">
          {item.name[language]}
        </h3>

        <div className="flex items-center gap-1.5 mt-1.5">
          <span className="text-[15px] font-bold text-[#1A1A1A]">
            €{item.price.toFixed(2)}
          </span>
          {item.likes > 0 && (
            <span className="ml-auto flex items-center gap-0.5 text-[10px] text-[#1A1A1A]/40 font-medium">
              <Heart className="w-2.5 h-2.5 text-red-400" fill="currentColor" /> {item.likes}
            </span>
          )}
        </div>

        {visibleIngredients.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {visibleIngredients.map((ing) => (
              <span
                key={ing}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold text-[#1A1A1A]/70 app-glass-chip"
              >
                <Check className="w-2.5 h-2.5 text-[#1A1A1A]/60" strokeWidth={3} />
                {localizeIngredient(ing)}
              </span>
            ))}
          </div>
        )}

        <button
          onClick={handleAddToCart}
          disabled={!item.isAvailable}
          className="mt-auto pt-3 w-full flex items-center justify-center gap-1.5 py-2.5 rounded-2xl text-[13px] font-bold text-white active:scale-[0.96] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: '#1A1A1A', touchAction: 'manipulation' }}
        >
          <Plus className="w-3.5 h-3.5" strokeWidth={3} />
          {language === 'sq' ? 'Shto' : 'Add'}
        </button>
      </div>
    </div>
  );
};

export default AppMenuCard;
