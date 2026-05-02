import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { MenuItem } from '@/types/menu';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn, getOptimizedImage } from '@/lib/utils';

interface MenuCardProps {
  item: MenuItem;
  index?: number;
  onAddToCart: (item: MenuItem) => void;
  revealed?: boolean;
  onImageReady?: () => void;
}

/**
 * Web-only product card. Always navigates to the WEB route /product/:id.
 * The app uses AppMenuCard instead — this component is never rendered inside
 * the AppShell. Web is an anonymous storefront, so no favorite heart.
 */
const MenuCard = ({ item, index = 0, onAddToCart, revealed = true, onImageReady }: MenuCardProps) => {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [imageLoaded, setImageLoaded] = useState(false);

  const isEager = index < 2;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAddToCart(item);
  };

  const handleImageLoad = () => {
    setImageLoaded(true);
    onImageReady?.();
  };

  if (!revealed) return null;

  return (
    <div
      onClick={() => navigate(`/product/${item.id}`)}
      className={cn(
        'menu-card group relative cursor-pointer bg-white flex flex-col',
        !item.isAvailable && 'opacity-50 grayscale'
      )}
    >
      {/* Image — fixed height, white bg */}
      <div className="relative h-40 sm:h-48 overflow-hidden bg-white pt-4">
        {!imageLoaded && (
          <div className="absolute inset-0 animate-pulse bg-muted" />
        )}

        <img
          src={getOptimizedImage(item.image)}
          alt={item.name[language]}
          loading={isEager ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={isEager ? 'high' : undefined}
          onLoad={handleImageLoad}
          className={cn(
            'w-full h-full object-contain mix-blend-screen bg-white px-4 sm:px-5 transition-all duration-500 group-hover:scale-105',
            imageLoaded ? 'opacity-100 blur-0' : 'opacity-40 blur-sm'
          )}
        />

        {/* Unavailable Overlay */}
        {!item.isAvailable && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60">
            <span className="px-3 py-1.5 sm:px-4 sm:py-2 bg-muted rounded-full text-xs sm:text-sm font-medium">
              {language === 'sq' ? 'E shitur' : 'Sold out'}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 sm:p-5 flex flex-col flex-1">
        <h3 className="font-display font-bold text-base sm:text-lg leading-tight line-clamp-2">
          {item.name[language]}
        </h3>

        <p className="text-xs text-muted-foreground mt-1 line-clamp-2 flex-grow">
          {item.description[language]}
        </p>

        <div className="flex items-center justify-between pt-2 mt-auto">
          <span className="text-lg sm:text-xl font-bold text-primary">
            €{item.price.toFixed(2)}
          </span>

          <button
            onClick={handleAddToCart}
            disabled={!item.isAvailable}
            aria-label="Shto në shportë"
            className="flex items-center gap-1 rounded-full px-3 py-2 bg-primary text-primary-foreground shadow-soft transition-all hover:bg-primary/90 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ touchAction: 'manipulation' }}
          >
            <Plus className="w-4 h-4" strokeWidth={2.6} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default MenuCard;
