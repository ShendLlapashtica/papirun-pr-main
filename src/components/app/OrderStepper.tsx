import { useEffect, useState } from 'react';
import { CheckCircle2, ChefHat, Bike, Hourglass, MessageCircle } from 'lucide-react';
import { fetchOrder, subscribeOrderRealtime, type OrderRecord, type OrderStatus } from '@/lib/ordersApi';
import OrderStatusModal from '@/components/OrderStatusModal';

const STORAGE_KEY = 'papirun_active_order_id';

const STEPS: { key: OrderStatus; label: string; icon: typeof Hourglass }[] = [
  { key: 'pending', label: 'Pranuar', icon: Hourglass },
  { key: 'approved', label: 'Konfirmuar', icon: CheckCircle2 },
  { key: 'preparing', label: 'Përgatitet', icon: ChefHat },
  { key: 'out_for_delivery', label: 'Në rrugë', icon: Bike },
  { key: 'completed', label: 'Përfundoi', icon: CheckCircle2 },
];

const stepIndex = (status: OrderStatus): number => {
  const i = STEPS.findIndex((s) => s.key === status);
  return i < 0 ? 0 : i;
};

/**
 * Live status card shown in AppHome when the user has an active order.
 * Shows a step-by-step progress: Pranuar → Konfirmuar → Përgatitet → Në rrugë → Përfundoi.
 * Replaces the "reviews" section for engaged users.
 */
const OrderStepper = () => {
  const [orderId, setOrderId] = useState<string | null>(() => {
    try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
  });
  const [order, setOrder] = useState<OrderRecord | null>(null);
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    const onChange = () => {
      try { setOrderId(localStorage.getItem(STORAGE_KEY)); } catch {}
    };
    window.addEventListener('papirun:active-order-changed', onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener('papirun:active-order-changed', onChange);
      window.removeEventListener('storage', onChange);
    };
  }, []);

  useEffect(() => {
    if (!orderId) { setOrder(null); return; }
    let active = true;
    fetchOrder(orderId).then((o) => { if (active) setOrder(o); }).catch(() => {});
    const unsub = subscribeOrderRealtime(orderId, (u) => { if (active) setOrder(u); });
    return () => { active = false; unsub(); };
  }, [orderId]);

  if (!order || order.status === 'rejected' || order.status === 'completed') return null;

  const currentIdx = stepIndex(order.status);
  const progressPct = ((currentIdx + 1) / STEPS.length) * 100;
  const visibleSteps = STEPS.filter((s) => s.key !== 'completed' || order.status === 'completed');

  return (
    <>
      <div
        className="rounded-3xl overflow-hidden shadow-lg border border-white/40"
        style={{
          background: 'linear-gradient(135deg, hsl(var(--primary) / 0.18) 0%, hsl(var(--primary) / 0.08) 100%)',
          backdropFilter: 'blur(18px) saturate(140%)',
          WebkitBackdropFilter: 'blur(18px) saturate(140%)',
        }}
      >
        <div className="p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-primary/80">Porosia jote aktive</p>
              <p className="font-display font-bold text-base mt-0.5">€{order.total.toFixed(2)} · #{order.id.slice(0, 6).toUpperCase()}</p>
            </div>
            <button
              onClick={() => setChatOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-white/70 hover:bg-white text-primary text-xs font-bold active:scale-95 transition-all shadow-sm"
            >
              <MessageCircle className="w-3.5 h-3.5" strokeWidth={2.4} />
              Bisedo
            </button>
          </div>

          {/* Progress bar */}
          <div className="relative h-2 rounded-full bg-white/40 overflow-hidden mb-3">
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
              style={{ width: `${progressPct}%`, background: 'linear-gradient(90deg, hsl(var(--primary)), hsl(var(--primary) / 0.7))' }}
            />
          </div>

          {/* Steps */}
          <div className="flex items-center justify-between">
            {visibleSteps.map((step, i) => {
              const Icon = step.icon;
              const isDone = i < currentIdx;
              const isActive = i === currentIdx;
              return (
                <div key={step.key} className="flex flex-col items-center gap-1 flex-1 min-w-0">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                      isDone
                        ? 'bg-primary text-primary-foreground'
                        : isActive
                          ? 'bg-primary text-primary-foreground ring-4 ring-primary/25 animate-pulse'
                          : 'bg-white/60 text-muted-foreground'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" strokeWidth={2.4} />
                  </div>
                  <span className={`text-[9px] font-semibold text-center truncate max-w-full ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {chatOpen && orderId && (
        <OrderStatusModal orderId={orderId} isOpen={chatOpen} onClose={() => setChatOpen(false)} />
      )}
    </>
  );
};

export default OrderStepper;
