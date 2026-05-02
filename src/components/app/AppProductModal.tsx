import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Minus, ShoppingBag, Check, ChevronDown } from 'lucide-react';
import { getIngredientName } from '@/data/ingredientTranslations';
import type { MenuItem } from '@/types/menu';
import type { SelectedExtra } from '@/types/menuExtra';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCart } from '@/contexts/CartContext';
import { useLiveMenuExtras } from '@/hooks/useLiveStorefrontData';
import { cn, getOptimizedImage } from '@/lib/utils';
import { haptic } from '@/lib/native';

interface Props {
  item: MenuItem | null;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Fullscreen product detail modal — used INSIDE the App (/home).
 * Replaces routing to /product/:id so the user never leaves the app shell.
 * Slides up from the bottom (iOS-style sheet).
 */
const AppProductModal = ({ item, isOpen, onClose }: Props) => {
  const { language } = useLanguage();
  const { addToCart } = useCart();
  const menuExtras = useLiveMenuExtras();
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
  }, [item?.id, availableExtras]);

  // Lock body scroll when open
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  if (!item) return null;

  const selectedExtras: SelectedExtra[] = availableExtras
    .filter((e) => checkedExtras[e.id])
    .map((e) => ({ id: e.id, name: e.name, price: e.price }));

  const extrasUnit = selectedExtras.reduce((s, e) => s + e.price, 0);
  const totalPrice = (item.price + extrasUnit) * quantity;

  const handleAdd = () => {
    const removed = Object.entries(checkedIngredients).filter(([, v]) => !v).map(([k]) => k);
    for (let i = 0; i < quantity; i++) addToCart(item, removed, selectedExtras);
    haptic('success');
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="relative w-full sm:max-w-lg bg-background rounded-t-3xl sm:rounded-3xl max-h-[92vh] overflow-hidden shadow-2xl flex flex-col"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-2 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>

            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-background/80 backdrop-blur-md flex items-center justify-center shadow-sm active:scale-90 transition-all"
              aria-label="Mbyll"
            >
              <X className="w-4 h-4" strokeWidth={2.4} />
            </button>

            <div className="flex-1 overflow-y-auto px-5 pb-5">
              <div className="aspect-square max-h-[40vh] rounded-2xl overflow-hidden bg-white mb-4 mt-2">
                <img 
                  src={getOptimizedImage(item.image)} 
                  alt={item.name[language]} 
                  className="w-full h-full object-contain mix-blend-screen bg-white p-6" 
                />
              </div>

              {/* Title + price */}
              <div className="mb-3">
                <h1 className="font-display font-bold text-xl leading-tight">{item.name[language]}</h1>
                <p className="text-lg font-bold text-primary mt-1">€{item.price.toFixed(2)}</p>
              </div>

              <p className="text-sm text-muted-foreground leading-relaxed mb-4">{item.description[language]}</p>

              {/* Ingredients */}
              <div className="mb-4">
                <h3 className="text-xs uppercase tracking-wider font-bold text-muted-foreground mb-2">
                  {language === 'sq' ? 'Përbërësit' : 'Ingredients'}
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {item.ingredients.map((ing) => {
                    const checked = checkedIngredients[ing] !== false;
                    return (
                      <button
                        key={ing}
                        onClick={() => { haptic('light'); setCheckedIngredients((p) => ({ ...p, [ing]: !p[ing] })); }}
                        className={cn(
                          'flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium border transition-all',
                          checked
                            ? 'bg-primary/10 border-primary/30 text-foreground'
                            : 'bg-secondary/50 border-border text-muted-foreground line-through opacity-60',
                        )}
                      >
                        <div className={cn(
                          'w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center',
                          checked ? 'border-primary bg-primary' : 'border-muted-foreground/40',
                        )}>
                          {checked && <Check className="w-2 h-2 text-primary-foreground" />}
                        </div>
                        {getIngredientName(ing, language)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Extras */}
              {availableExtras.length > 0 && (
                <div className="mb-4">
                  <button
                    onClick={() => setShowExtras((v) => !v)}
                    className="flex items-center gap-2 text-xs font-bold text-primary"
                  >
                    <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', showExtras && 'rotate-180')} />
                    {language === 'sq' ? 'Ekstra' : 'Extras'}
                    {selectedExtras.length > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px]">{selectedExtras.length}</span>
                    )}
                  </button>
                  {showExtras && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {availableExtras.map((extra) => {
                        const checked = checkedExtras[extra.id] === true;
                        return (
                          <button
                            key={extra.id}
                            onClick={() => { haptic('light'); setCheckedExtras((p) => ({ ...p, [extra.id]: !p[extra.id] })); }}
                            className={cn(
                              'flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium border transition-all',
                              checked ? 'bg-accent border-accent text-accent-foreground' : 'bg-secondary/50 border-dashed border-border text-muted-foreground',
                            )}
                          >
                            <div className={cn(
                              'w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center',
                              checked ? 'border-accent-foreground bg-accent-foreground' : 'border-muted-foreground/40',
                            )}>
                              {checked && <Check className="w-2 h-2 text-accent" />}
                            </div>
                            + {extra.name[language]} (€{extra.price.toFixed(2)})
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Sticky bottom bar — qty + add */}
            <div
              className="border-t border-border/40 bg-background/95 backdrop-blur-xl p-3 flex items-center gap-2 shrink-0"
            >
              <div className="flex items-center gap-1 bg-secondary rounded-full p-1">
                <button
                  onClick={() => { haptic('light'); setQuantity(Math.max(1, quantity - 1)); }}
                  className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-background active:scale-90 transition-all"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="w-7 text-center font-bold text-sm">{quantity}</span>
                <button
                  onClick={() => { haptic('light'); setQuantity(quantity + 1); }}
                  className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-background active:scale-90 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
              <button
                onClick={handleAdd}
                disabled={!item.isAvailable}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-full bg-primary text-primary-foreground font-bold text-sm shadow-lg shadow-primary/30 active:scale-[0.97] disabled:opacity-50 transition-all"
              >
                <ShoppingBag className="w-4 h-4" strokeWidth={2.4} />
                {language === 'sq' ? 'Shto' : 'Add'} · €{totalPrice.toFixed(2)}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AppProductModal;
