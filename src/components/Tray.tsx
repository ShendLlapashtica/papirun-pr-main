import { useRef, useState } from 'react';
import { Eye, Minus, Plus, ShoppingBag, Trash2, X, MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { CartItem } from '@/types/menu';
import { useLanguage } from '@/contexts/LanguageContext';
import { getIngredientName } from '@/data/ingredientTranslations';
import { cn } from '@/lib/utils';
import { getCartLineTotal, getCartTotal } from '@/lib/cartPricing';
import { getCartItemKey } from '@/lib/cartItemKey';

interface TrayProps {
  items: CartItem[];
  isOpen: boolean;
  onClose: () => void;
  onUpdateQuantity: (id: string, quantity: number) => void;
  onRemove: (id: string) => void;
  onCheckout: () => void;
  onUpdateNote?: (id: string, note: string) => void;
}

const SwipeableItem = ({ children, onSwipeRight }: { children: React.ReactNode; onSwipeRight: () => void }) => {
  const startX = useRef(0);
  const currentX = useRef(0);
  const ref = useRef<HTMLDivElement>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    currentX.current = 0;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const diff = e.touches[0].clientX - startX.current;
    currentX.current = diff;
    if (ref.current && diff > 0) {
      ref.current.style.transform = `translateX(${Math.min(diff, 120)}px)`;
      ref.current.style.opacity = `${Math.max(1 - diff / 200, 0.3)}`;
    }
  };

  const handleTouchEnd = () => {
    if (currentX.current > 80) {
      if (ref.current) {
        ref.current.style.transform = 'translateX(100%)';
        ref.current.style.opacity = '0';
      }
      setTimeout(onSwipeRight, 200);
    } else if (ref.current) {
      ref.current.style.transform = 'translateX(0)';
      ref.current.style.opacity = '1';
    }
  };

  return (
    <div
      ref={ref}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="transition-[transform,opacity] duration-200"
    >
      {children}
    </div>
  );
};

const Tray = ({ items, isOpen, onClose, onUpdateQuantity, onRemove, onCheckout, onUpdateNote }: TrayProps) => {
  const { language, t } = useLanguage();
  const navigate = useNavigate();
  const total = getCartTotal(items);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const [editingNoteKey, setEditingNoteKey] = useState<string | null>(null);

  const openProduct = (productId: string) => {
    onClose();
    navigate(`/product/${productId}`);
  };

  return (
    <>
      <div
        className={cn('fixed inset-0 bg-foreground/20 backdrop-blur-sm z-40 transition-opacity', isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none')}
        onClick={onClose}
      />

      <aside
        className={cn(
          'fixed right-0 top-0 h-full w-full max-w-md bg-background border-l border-border z-50 flex flex-col transition-transform duration-300',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <ShoppingBag className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-display font-semibold text-base sm:text-lg">{t.tray.title}</h2>
              <p className="text-xs sm:text-sm text-muted-foreground">{itemCount} {t.tray.items}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-muted">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div
          className="flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4 space-y-3"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <ShoppingBag className="w-12 h-12 text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">{t.tray.empty}</p>
              <p className="text-sm text-muted-foreground/70">{t.tray.emptySubtext}</p>
            </div>
          ) : (
            items.map((item) => {
              const itemKey = getCartItemKey(item);
              const isEditingNote = editingNoteKey === itemKey;

              return (
              <SwipeableItem key={itemKey} onSwipeRight={() => onRemove(itemKey)}>
                <div className="tray-item animate-slide-up">
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => openProduct(item.id)}
                      className="rounded-xl overflow-hidden shrink-0"
                    >
                      <img src={item.image} alt={item.name[language]} className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl object-contain bg-cream" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <h4
                          className="font-medium text-xs sm:text-sm truncate cursor-pointer hover:text-primary transition-colors"
                          onClick={() => openProduct(item.id)}
                        >
                          {item.name[language]}
                        </h4>
                        <button
                          onClick={() => openProduct(item.id)}
                          className="p-0.5 rounded-full text-muted-foreground hover:text-primary transition-colors shrink-0"
                          title={language === 'sq' ? 'Shiko produktin' : 'View product'}
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {((item.removedIngredients && item.removedIngredients.length > 0) || (item.addedExtras && item.addedExtras.length > 0)) && (
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {item.removedIngredients?.map((ing) => (
                            <span key={ing} className="text-[10px] px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive">
                              Pa {getIngredientName(ing, language)}
                            </span>
                          ))}
                          {item.addedExtras?.map((ext) => (
                            <span key={ext.id} className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent text-accent-foreground">
                              Me {ext.name[language]} (+€{ext.price.toFixed(2)})
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Customer note display/edit */}
                      {isEditingNote ? (
                        <div className="mt-1">
                          <input
                            autoFocus
                            type="text"
                            defaultValue={item.customerNote || ''}
                            placeholder={language === 'sq' ? 'psh. me shume sos...' : 'e.g. extra sauce...'}
                            className="w-full text-[10px] px-2 py-1 rounded-lg bg-secondary border-0 focus:ring-1 focus:ring-primary/30"
                            onBlur={(e) => {
                              onUpdateNote?.(itemKey, e.target.value);
                              setEditingNoteKey(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                onUpdateNote?.(itemKey, (e.target as HTMLInputElement).value);
                                setEditingNoteKey(null);
                              }
                            }}
                          />
                        </div>
                      ) : (
                        <button
                          onClick={() => setEditingNoteKey(itemKey)}
                          className="flex items-center gap-1 mt-0.5 text-[10px] text-muted-foreground hover:text-primary transition-colors"
                        >
                          <MessageSquare className="w-2.5 h-2.5" />
                          {item.customerNote?.trim()
                            ? <span className="italic">📝 {item.customerNote}</span>
                            : <span>{language === 'sq' ? '+ Shto shënim' : '+ Add note'}</span>
                          }
                        </button>
                      )}

                      <p className="text-primary font-semibold text-xs sm:text-sm">€{getCartLineTotal(item).toFixed(2)}</p>

                      <div className="flex items-center justify-between mt-1">
                        <div className="flex items-center gap-1.5 sm:gap-2 bg-background rounded-full p-1">
                          <button onClick={() => onUpdateQuantity(itemKey, item.quantity - 1)} className="p-1 rounded-full hover:bg-muted transition-colors">
                            <Minus className="w-3 h-3 sm:w-4 sm:h-4" />
                          </button>
                          <span className="w-5 sm:w-6 text-center text-xs sm:text-sm font-medium">{item.quantity}</span>
                          <button onClick={() => onUpdateQuantity(itemKey, item.quantity + 1)} className="p-1 rounded-full hover:bg-muted transition-colors">
                            <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
                          </button>
                        </div>
                        <button
                          onClick={() => onRemove(itemKey)}
                          className="p-1.5 rounded-full text-destructive/60 hover:text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </SwipeableItem>
            )})
          )}
        </div>

        {items.length > 0 && (
          <div className="p-4 sm:p-6 border-t border-border space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t.tray.total}</span>
              <span className="text-xl sm:text-2xl font-display font-bold">€{total.toFixed(2)}</span>
            </div>
            <button onClick={onCheckout} className="btn-sage w-full flex items-center justify-center gap-2 text-sm sm:text-base">
              <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5" />
              {t.tray.checkout}
            </button>
          </div>
        )}
      </aside>
    </>
  );
};

export default Tray;
