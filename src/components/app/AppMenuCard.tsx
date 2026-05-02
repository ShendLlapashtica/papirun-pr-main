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

  const visibleIngredients = item.ingredients.slice(0, 3);

  const localizeIngredient = (raw: string) => {
    const key = raw.toLowerCase().trim();
    const entry = ingredientNames[key];
    return entry ? entry[language] : raw;
  };

  return (
    <div
      onClick={() => onCardClick?.()}
      className={cn(
        'group relative cursor-pointer flex h-full flex-col overflow-hidden rounded-[32px] transition-all duration-300 ease-out active:scale-[0.97] hover:-translate-y-1',
        !item.isAvailable && 'opacity-60 grayscale',
        'bg-gradient-to-b from-white/90 to-white/60 dark:from-white/10 dark:to-white/5',
        'border border-white/40 dark:border-white/10 backdrop-blur-xl',
        'shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)]'
      )}
    >
      {/* Dynamic glow effect behind the card */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-[32px]" />

      <div className="relative px-3 pt-3">
        <div className="relative aspect-square rounded-[28px] bg-gradient-to-br from-secondary/50 to-secondary/20 dark:from-secondary/20 dark:to-transparent overflow-hidden flex items-center justify-center">
          {!imageLoaded && <div className="absolute inset-0 animate-pulse bg-muted/50" />}

          {showFavorite && (
            <button
              onClick={handleToggleFav}
              className={cn(
                'absolute top-3 right-3 z-10 w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-md shadow-sm transition-all duration-300 hover:scale-110 active:scale-90',
                fav ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-white/50 dark:bg-black/20 text-foreground/50 border border-white/20 hover:text-red-500 hover:bg-white/80'
              )}
              aria-label={fav ? 'Hiq nga favorites' : 'Shto në favorites'}
            >
              <Heart className={cn("w-4 h-4 transition-transform", fav && "scale-110")} fill={fav ? 'currentColor' : 'none'} strokeWidth={2.5} />
            </button>
          )}

          {/* Premium image presentation with scale effect */}
          <img
            src={getOptimizedImage(item.image)}
            alt={item.name[language]}
            loading={isEager ? 'eager' : 'lazy'}
            decoding="async"
            fetchPriority={isEager ? 'high' : undefined}
            onLoad={() => setImageLoaded(true)}
            className={cn(
              'w-[85%] h-[85%] object-contain mix-blend-screen bg-white drop-shadow-2xl transition-all duration-700 cubic-bezier(0.4, 0, 0.2, 1)',
              imageLoaded ? 'opacity-100 scale-100 group-hover:scale-110 group-hover:-rotate-3' : 'opacity-0 scale-95 blur-md'
            )}
          />

          {!item.isAvailable && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm rounded-[28px]">
              <span className="px-4 py-1.5 bg-background/90 text-foreground shadow-lg rounded-full text-xs font-bold uppercase tracking-wider">
                {language === 'sq' ? 'E shitur' : 'Sold out'}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 pt-4 pb-4 flex flex-col flex-1 relative z-10">
        <h3 className="font-display font-bold text-base leading-tight line-clamp-2 text-foreground tracking-tight group-hover:text-primary transition-colors">
          {item.name[language]}
        </h3>
        
        <div className="flex items-center gap-1.5 mt-1">
          <span className="text-lg font-bold text-primary">
            €{item.price.toFixed(2)}
          </span>
          {item.likes > 0 && (
            <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-0.5 ml-auto bg-muted/50 px-1.5 py-0.5 rounded-md">
              <Heart className="w-3 h-3 text-red-400" fill="currentColor" /> {item.likes}
            </span>
          )}
        </div>

        {visibleIngredients.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {visibleIngredients.map((ing) => (
              <span
                key={ing}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] bg-secondary/60 text-secondary-foreground/80 font-medium border border-border/40 backdrop-blur-sm"
              >
                <Check className="w-2.5 h-2.5 text-primary" strokeWidth={3} />
                {localizeIngredient(ing)}
              </span>
            ))}
          </div>
        )}

        <button
          onClick={handleAddToCart}
          disabled={!item.isAvailable}
          className="mt-4 w-full flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-bold text-white shadow-md active:scale-[0.96] transition-all disabled:opacity-50 disabled:cursor-not-allowed group-hover:shadow-primary/25 relative overflow-hidden"
          style={{ 
            background: 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.8) 100%)',
            touchAction: 'manipulation' 
          }}
        >
          {/* Shine effect on hover */}
          <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover:animate-[shimmer_1.5s_infinite]" />
          <Plus className="w-4 h-4 relative z-10" strokeWidth={3} />
          <span className="relative z-10">{language === 'sq' ? 'Shto' : 'Add'}</span>
        </button>
      </div>
    </div>
  );
};

export default AppMenuCard;
