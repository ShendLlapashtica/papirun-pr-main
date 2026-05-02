import { useState } from 'react';
import { Minus, Plus, ShoppingBag, Trash2, MessageSquare, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '@/contexts/CartContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { getIngredientName } from '@/data/ingredientTranslations';
import { getCartLineTotal, getCartTotal } from '@/lib/cartPricing';
import { getCartItemKey } from '@/lib/cartItemKey';
import CheckoutModal from '@/components/CheckoutModal';
import { getOptimizedImage } from '@/lib/utils';

const SLATE = '#0F1311';
const SAGE = '#749D79';

/**
 * CartView — Premium glass cart at /home?tab=cart.
 * Slate-black typography, 24px backdrop blur, layered soft shadow,
 * sage stepper, sticky total bar above the BottomNav.
 */
const CartView = () => {
  const { language, t } = useLanguage();
  const navigate = useNavigate();
  const { cart, updateQuantity, updateNote, removeFromCart, clearCart, isCheckoutOpen, setIsCheckoutOpen } = useCart();
  const [editingNoteKey, setEditingNoteKey] = useState<string | null>(null);

  const total = getCartTotal(cart);
  const itemCount = cart.reduce((s, i) => s + i.quantity, 0);

  return (
    <div className="px-4 pt-3 pb-40" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Header card */}
      <div
        className="rounded-[28px] px-4 py-3.5 mb-3 flex items-center gap-3 border border-white/50"
        style={{
          background: 'rgba(255,255,255,0.55)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          boxShadow: '0 8px 24px -12px rgba(0,0,0,0.10)',
        }}
      >
        <div
          className="w-11 h-11 rounded-2xl flex items-center justify-center"
          style={{ background: `${SAGE}26` }}
        >
          <ShoppingBag className="w-5 h-5" strokeWidth={2.4} style={{ color: SLATE }} />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-display font-bold text-[18px] leading-tight" style={{ color: SLATE }}>
            {t.tray.title}
          </h1>
          <p className="text-[11px] font-semibold mt-0.5" style={{ color: '#0F1311B3' }}>
            {itemCount} {t.tray.items}
          </p>
        </div>
        {cart.length > 0 && (
          <button
            onClick={clearCart}
            className="text-[11px] font-bold text-destructive/85 hover:text-destructive px-2.5 py-1 rounded-full"
          >
            {language === 'sq' ? 'Pastro' : 'Clear'}
          </button>
        )}
      </div>

      {cart.length === 0 ? (
        <div
          className="rounded-[28px] px-6 py-14 flex flex-col items-center text-center border border-white/50"
          style={{
            background: 'rgba(255,255,255,0.55)',
            backdropFilter: 'blur(24px) saturate(180%)',
            WebkitBackdropFilter: 'blur(24px) saturate(180%)',
            boxShadow: '0 8px 24px -12px rgba(0,0,0,0.08)',
          }}
        >
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center mb-4"
            style={{ background: `${SAGE}1A` }}
          >
            <ShoppingBag className="w-10 h-10" strokeWidth={1.8} style={{ color: SAGE }} />
          </div>
          <p className="font-display font-bold text-[17px]" style={{ color: SLATE }}>
            {t.tray.empty}
          </p>
          <p className="text-[12px] mt-1.5 max-w-[260px]" style={{ color: '#0F131199' }}>
            {t.tray.emptySubtext}
          </p>
          <button
            onClick={() => navigate('/home')}
            className="mt-6 px-6 py-3 rounded-full text-[13px] font-bold text-white active:scale-[0.97] transition-all"
            style={{ background: SAGE, boxShadow: '0 6px 16px -6px rgba(116,157,121,0.55)' }}
          >
            {language === 'sq' ? 'Shfleto menynë' : 'Browse menu'}
          </button>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {cart.map((item) => {
              const itemKey = getCartItemKey(item);
              const isEditingNote = editingNoteKey === itemKey;
              return (
                <div
                  key={itemKey}
                  className="rounded-[28px] p-3.5 animate-slide-up border border-white/50"
                  style={{
                    background: 'rgba(255,255,255,0.55)',
                    backdropFilter: 'blur(24px) saturate(180%)',
                    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
                    boxShadow: '0 8px 24px -12px rgba(0,0,0,0.12)',
                  }}
                >
                  <div className="flex gap-3.5">
                    <button
                      type="button"
                      onClick={() => navigate(`/app/product/${item.id}`)}
                      className="rounded-2xl overflow-hidden shrink-0 ring-1 ring-white/60"
                      style={{ background: 'rgba(255,255,255,0.55)' }}
                    >
                      <img
                        src={getOptimizedImage(item.image)}
                        alt={item.name[language]}
                        className="w-16 h-16 object-contain mix-blend-screen bg-white p-1.5"
                      />
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <button
                          onClick={() => navigate(`/app/product/${item.id}`)}
                          className="text-left flex items-center gap-1 min-w-0"
                        >
                          <h4 className="font-bold text-[14px] truncate tracking-tight" style={{ color: SLATE }}>
                            {item.name[language]}
                          </h4>
                          <Eye className="w-3 h-3 shrink-0" style={{ color: '#0F131180' }} />
                        </button>
                        <button
                          onClick={() => removeFromCart(itemKey)}
                          className="p-1.5 rounded-full text-destructive/80 hover:bg-destructive/10 shrink-0"
                          aria-label="Hiq"
                        >
                          <Trash2 className="w-3.5 h-3.5" strokeWidth={2.4} />
                        </button>
                      </div>

                      {((item.removedIngredients?.length ?? 0) > 0 || (item.addedExtras?.length ?? 0) > 0) && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {item.removedIngredients?.map((ing) => (
                            <span
                              key={ing}
                              className="text-[10px] px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-semibold"
                            >
                              Pa {getIngredientName(ing, language)}
                            </span>
                          ))}
                          {item.addedExtras?.map((ext) => (
                            <span
                              key={ext.id}
                              className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                              style={{ background: `${SAGE}22`, color: SLATE }}
                            >
                              + {ext.name[language]}
                            </span>
                          ))}
                        </div>
                      )}

                      {isEditingNote ? (
                        <input
                          autoFocus
                          type="text"
                          defaultValue={item.customerNote || ''}
                          placeholder={language === 'sq' ? 'psh. me shumë sos…' : 'e.g. extra sauce…'}
                          className="w-full mt-1.5 text-[11px] px-2.5 py-1.5 rounded-lg bg-white/70 border border-white/60 focus:outline-none focus:ring-1 focus:ring-primary/30"
                          onBlur={(e) => { updateNote(itemKey, e.target.value); setEditingNoteKey(null); }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              updateNote(itemKey, (e.target as HTMLInputElement).value);
                              setEditingNoteKey(null);
                            }
                          }}
                        />
                      ) : (
                        <button
                          onClick={() => setEditingNoteKey(itemKey)}
                          className="flex items-center gap-1 mt-1.5 text-[10.5px] font-semibold"
                          style={{ color: '#0F1311A0' }}
                        >
                          <MessageSquare className="w-2.5 h-2.5" strokeWidth={2.6} />
                          {item.customerNote?.trim()
                            ? <span className="italic truncate">📝 {item.customerNote}</span>
                            : <span>{language === 'sq' ? '+ Shto shënim' : '+ Add note'}</span>}
                        </button>
                      )}

                      <div className="flex items-center justify-between mt-2.5">
                        <div
                          className="flex items-center gap-1 rounded-full p-1 border border-white/50"
                          style={{ background: 'rgba(255,255,255,0.65)' }}
                        >
                          <button
                            onClick={() => updateQuantity(itemKey, item.quantity - 1)}
                            className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-white/70"
                            style={{ color: SLATE }}
                            aria-label="-"
                          >
                            <Minus className="w-3.5 h-3.5" strokeWidth={2.6} />
                          </button>
                          <span className="w-5 text-center text-[12px] font-bold" style={{ color: SLATE }}>
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(itemKey, item.quantity + 1)}
                            className="w-7 h-7 rounded-full flex items-center justify-center text-white active:scale-90 transition-transform"
                            style={{ background: SAGE, boxShadow: '0 4px 10px -4px rgba(116,157,121,0.6)' }}
                            aria-label="+"
                          >
                            <Plus className="w-3.5 h-3.5" strokeWidth={2.8} />
                          </button>
                        </div>
                        <span className="text-[15px] font-bold tracking-tight" style={{ color: SLATE }}>
                          €{getCartLineTotal(item).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Sticky total bar — sits above the BottomNav */}
          <div
            className="sticky rounded-[28px] px-4 py-4 mt-5 border border-white/55"
            style={{
              bottom: 'calc(env(safe-area-inset-bottom) + 96px)',
              background: 'rgba(255,255,255,0.62)',
              backdropFilter: 'blur(28px) saturate(180%)',
              WebkitBackdropFilter: 'blur(28px) saturate(180%)',
              boxShadow: '0 12px 32px -16px rgba(0,0,0,0.18)',
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-[13px] font-semibold" style={{ color: '#0F1311B3' }}>{t.tray.total}</span>
              <span className="font-display font-bold text-[24px] tracking-tight" style={{ color: SLATE }}>
                €{total.toFixed(2)}
              </span>
            </div>
            <button
              onClick={() => setIsCheckoutOpen(true)}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-[14px] font-bold text-white active:scale-[0.98] transition-transform"
              style={{ background: SLATE, boxShadow: '0 10px 24px -10px rgba(15,19,17,0.45)' }}
            >
              <ShoppingBag className="w-4 h-4" strokeWidth={2.4} />
              {language === 'sq' ? 'Vazhdo në checkout' : t.tray.checkout}
            </button>
          </div>
        </>
      )}

      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        items={cart}
        total={total}
        onSuccess={clearCart}
      />
    </div>
  );
};

export default CartView;
