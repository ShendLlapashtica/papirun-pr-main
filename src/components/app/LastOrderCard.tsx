import { useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useLiveMenuItems } from '@/hooks/useLiveStorefrontData';
import { fetchAllOrders, type OrderRecord } from '@/lib/ordersApi';
import { getOptimizedImage } from '@/lib/utils';

/**
 * Shows the user's most recent order with a "Reorder" CTA.
 * Distinct from the Favorites carousel — this is THE last order, single card.
 */
const LastOrderCard = () => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const { addToCart } = useCart();
  const { items: menuItems } = useLiveMenuItems();
  const [last, setLast] = useState<OrderRecord | null>(null);

  useEffect(() => {
    if (!user) return;
    fetchAllOrders()
      .then((all) => {
        const mine = all.filter((o) => o.userId === user.id);
        setLast(mine[0] ?? null);
      })
      .catch(() => {});
  }, [user]);

  if (!user || !last) return null;

  const itemList = (last.items as any[]).slice(0, 3);
  const moreCount = Math.max(0, (last.items as any[]).length - itemList.length);

  const reorderAll = () => {
    let added = 0;
    for (const it of last.items as any[]) {
      const product = menuItems.find((m) => m.id === it.id);
      if (product) { addToCart(product); added++; }
    }
    if (added > 0) toast.success(language === 'sq' ? `U shtuan ${added} artikuj` : `Added ${added} items`);
  };

  return (
    <section className="px-4 mb-3">
      <div className="flex items-center gap-2 mb-2">
        <RotateCcw className="w-4 h-4 text-primary" strokeWidth={2.4} />
        <h2 className="font-display font-bold text-sm">
          {language === 'sq' ? 'Porosia e fundit' : 'Last order'}
        </h2>
      </div>
      <div className="green-glass rounded-2xl p-3 flex items-center gap-3">
        <div className="flex -space-x-2 shrink-0">
          {itemList.map((it: any, i: number) => {
            const product = menuItems.find((m) => m.id === it.id);
            if (!product) return null;
            return (
              <div key={i} className="w-11 h-11 rounded-full bg-white border-2 border-background overflow-hidden">
                <img src={getOptimizedImage(product.image)} alt="" className="w-full h-full object-contain mix-blend-screen bg-white p-1" />
              </div>
            );
          })}
          {moreCount > 0 && (
            <div className="w-11 h-11 rounded-full bg-secondary border-2 border-background flex items-center justify-center text-[10px] font-bold">
              +{moreCount}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-[hsl(var(--app-muted-text))] font-semibold">
            €{last.total.toFixed(2)} · {(last.items as any[]).length} {language === 'sq' ? 'artikuj' : 'items'}
          </p>
          <p className="text-[12px] font-bold truncate text-foreground">
            {(last.items as any[]).map((it: any) => menuItems.find((m) => m.id === it.id)?.name[language]).filter(Boolean).slice(0, 2).join(', ')}
          </p>
        </div>
        <button
          onClick={reorderAll}
          className="shrink-0 px-3.5 py-2 rounded-xl bg-[hsl(var(--app-action-bg))] text-white text-[11px] font-bold active:scale-95 transition-all shadow-sm"
        >
          {language === 'sq' ? 'Riporosit' : 'Reorder'}
        </button>
      </div>
    </section>
  );
};

export default LastOrderCard;
