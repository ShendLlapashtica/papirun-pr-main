import { useEffect, useState } from 'react';
import { RotateCcw, ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useLiveMenuItems } from '@/hooks/useLiveStorefrontData';
import { fetchAllOrders, type OrderRecord } from '@/lib/ordersApi';

/**
 * Horizontal scroll of items the user has previously ordered.
 * Replaces the generic "Reviews" section in the app context — shows the user
 * THEIR own past orders for one-tap reorder.
 */
const QuickReorder = () => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const { addToCart } = useCart();
  const { items: menuItems } = useLiveMenuItems();
  const [orders, setOrders] = useState<OrderRecord[]>([]);

  useEffect(() => {
    if (!user) return;
    fetchAllOrders()
      .then((all) => setOrders(all.filter((o) => o.userId === user.id).slice(0, 8)))
      .catch(() => {});
  }, [user]);

  // Build unique product list from past orders, sorted by recency
  const recentProducts = (() => {
    const seen = new Set<string>();
    const out: { id: string; quantity: number }[] = [];
    for (const o of orders) {
      for (const it of o.items as any[]) {
        if (!seen.has(it.id)) {
          seen.add(it.id);
          out.push({ id: it.id, quantity: it.quantity || 1 });
        }
      }
      if (out.length >= 8) break;
    }
    return out
      .map((p) => ({ product: menuItems.find((m) => m.id === p.id), quantity: p.quantity }))
      .filter((x) => x.product);
  })();

  if (recentProducts.length === 0) return null;

  return (
    <section className="px-3 sm:px-4">
      <div className="flex items-center gap-2 mb-3">
        <RotateCcw className="w-4 h-4 text-primary" strokeWidth={2.4} />
        <h2 className="font-display font-bold text-sm">
          {language === 'sq' ? 'Iu riktheve përsëri?' : 'Order again?'}
        </h2>
      </div>
      <div className="flex gap-2.5 overflow-x-auto scrollbar-hide -mx-3 sm:-mx-4 px-3 sm:px-4 pb-2">
        {recentProducts.map(({ product }) => (
          <button
            key={product!.id}
            onClick={() => {
              addToCart(product!);
              toast.success(language === 'sq' ? 'U shtua' : 'Added');
            }}
            className="shrink-0 w-32 rounded-2xl bg-white border border-border/40 shadow-sm overflow-hidden active:scale-95 transition-all"
          >
            <div className="h-20 bg-white flex items-center justify-center">
              <img src={product!.image} alt={product!.name[language]} className="h-full w-full object-contain p-2" />
            </div>
            <div className="p-2 text-left">
              <p className="text-[11px] font-semibold line-clamp-1">{product!.name[language]}</p>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[11px] font-bold text-primary">€{product!.price.toFixed(2)}</span>
                <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                  <ShoppingBag className="w-3 h-3" strokeWidth={2.4} />
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
};

export default QuickReorder;
