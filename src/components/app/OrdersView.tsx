import { useEffect, useState } from 'react';
import { Loader2, ClipboardList, Package, ChefHat, Bike, CheckCheck, X as XIcon, Hourglass, MessageCircle, Archive } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchAllOrders, subscribeAllOrdersRealtime, type OrderRecord } from '@/lib/ordersApi';
import { fetchArchivedOrderMessages, type ArchivedMessage } from '@/lib/orderMessagesApi';
import OrderStatusModal from '@/components/OrderStatusModal';
import { haptic } from '@/lib/native';

const STATUS = {
  pending: { label: 'Në shqyrtim', icon: Hourglass, cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300' },
  approved: { label: 'Aprovuar', icon: CheckCheck, cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
  preparing: { label: 'Përgatitet', icon: ChefHat, cls: 'bg-blue-500/15 text-blue-700 dark:text-blue-300' },
  out_for_delivery: { label: 'Në rrugë', icon: Bike, cls: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300' },
  completed: { label: 'Përfunduar', icon: CheckCheck, cls: 'bg-primary/10 text-primary' },
  rejected: { label: 'Anuluar', icon: XIcon, cls: 'bg-red-500/15 text-red-700 dark:text-red-300' },
} as const;

const ACTIVE_STATUSES = new Set(['pending', 'approved', 'preparing', 'out_for_delivery']);

const OrdersView = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [chatOrderId, setChatOrderId] = useState<string | null>(null);
  const [tab, setTab] = useState<'live' | 'archive'>('live');

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let mounted = true;
    const sync = async () => {
      try {
        const all = await fetchAllOrders();
        if (mounted) setOrders(all.filter((o) => o.userId === user.id));
      } catch {} finally {
        if (mounted) setLoading(false);
      }
    };
    sync();
    const unsub = subscribeAllOrdersRealtime(sync);
    return () => { mounted = false; unsub(); };
  }, [user]);

  const openChat = (id: string) => { haptic('light'); setChatOrderId(id); };

  return (
    <div className="px-4 py-4">
      <div className="flex items-center gap-2 mb-3 px-1">
        <ClipboardList className="w-5 h-5 text-primary" />
        <h2 className="font-display font-bold text-lg">Porositë e mia</h2>
      </div>

      {/* Tabs: Live / Archive */}
      <div className="app-glass rounded-full p-1 mb-4 grid grid-cols-2 gap-1">
        <button
          onClick={() => { haptic('light'); setTab('live'); }}
          className={`flex items-center justify-center gap-1.5 py-2 rounded-full text-[12px] font-bold transition-all ${
            tab === 'live' ? 'bg-foreground text-background shadow-sm' : 'text-foreground/70'
          }`}
        >
          <ClipboardList className="w-3.5 h-3.5" /> Aktive
        </button>
        <button
          onClick={() => { haptic('light'); setTab('archive'); }}
          className={`flex items-center justify-center gap-1.5 py-2 rounded-full text-[12px] font-bold transition-all ${
            tab === 'archive' ? 'bg-foreground text-background shadow-sm' : 'text-foreground/70'
          }`}
        >
          <Archive className="w-3.5 h-3.5" /> Arkivi i bisedave
        </button>
      </div>

      {tab === 'live' ? (
        loading ? (
          <div className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16 rounded-2xl bg-secondary/30">
            <Package className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-foreground">Asnjë porosi ende</p>
            <p className="text-xs text-muted-foreground mt-1">Porositë tua do shfaqen këtu</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {orders.map((o) => {
              const s = STATUS[o.status as keyof typeof STATUS] ?? STATUS.pending;
              const Icon = s.icon;
              const isActive = ACTIVE_STATUSES.has(o.status);
              return (
                <div key={o.id} className="bg-card rounded-2xl p-4 shadow-sm border border-border/40">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] text-muted-foreground">
                        {new Date(o.createdAt).toLocaleString('sq-AL', {
                          day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                      <p className="font-semibold text-sm mt-0.5">€{o.total.toFixed(2)}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full ${s.cls}`}>
                      <Icon className="w-3 h-3" /> {s.label}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-2.5">
                    {o.items.map((i: any) => `${i.quantity}× ${i.name?.sq || i.name?.en || ''}`).join(' · ')}
                  </p>
                  <button
                    onClick={() => openChat(o.id)}
                    className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold active:scale-95 transition-all ${
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20'
                        : 'bg-secondary/70 text-foreground hover:bg-secondary'
                    }`}
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    PapirunChat{isActive && ' · LIVE'}
                  </button>
                </div>
              );
            })}
          </div>
        )
      ) : (
        <ArchivedChats orders={orders} />
      )}

      {chatOrderId && (
        <OrderStatusModal orderId={chatOrderId} isOpen={!!chatOrderId} onClose={() => setChatOrderId(null)} />
      )}
    </div>
  );
};

/** Renders archived chat history (per past order) — read-only. */
const ArchivedChats = ({ orders }: { orders: OrderRecord[] }) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [archives, setArchives] = useState<Record<string, ArchivedMessage[]>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const toggle = async (orderId: string) => {
    haptic('light');
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId); else next.add(orderId);
      return next;
    });
    if (!archives[orderId]) {
      setLoadingId(orderId);
      try {
        const rows = await fetchArchivedOrderMessages(orderId);
        setArchives((p) => ({ ...p, [orderId]: rows }));
      } catch {
        setArchives((p) => ({ ...p, [orderId]: [] }));
      } finally {
        setLoadingId(null);
      }
    }
  };

  if (orders.length === 0) {
    return (
      <div className="text-center py-16 rounded-2xl bg-secondary/30">
        <Archive className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
        <p className="text-sm font-medium text-foreground">Asnjë arkiv biseduar</p>
        <p className="text-xs text-muted-foreground mt-1">Bisedat e mbyllura ruhen këtu</p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {orders.map((o) => {
        const isOpen = expanded.has(o.id);
        const rows = archives[o.id] ?? [];
        return (
          <div key={o.id} className="bg-card rounded-2xl border border-border/40 overflow-hidden">
            <button
              onClick={() => toggle(o.id)}
              className="w-full flex items-center justify-between gap-2 p-3 text-left active:bg-secondary/40"
            >
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground">
                  {new Date(o.createdAt).toLocaleString('sq-AL', {
                    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                  })}
                </p>
                <p className="font-semibold text-sm mt-0.5">€{o.total.toFixed(2)} · {o.status}</p>
              </div>
              <Archive className="w-4 h-4 text-muted-foreground" />
            </button>
            {isOpen && (
              <div className="px-3 pb-3 border-t border-border/40 pt-2.5 max-h-72 overflow-y-auto">
                {loadingId === o.id ? (
                  <div className="text-center py-4"><Loader2 className="w-4 h-4 animate-spin mx-auto text-primary" /></div>
                ) : rows.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground py-2 text-center">Asnjë mesazh i arkivuar.</p>
                ) : (
                  <div className="space-y-1.5">
                    {rows.map((m) => (
                      <div
                        key={m.id}
                        className={`max-w-[85%] rounded-2xl px-3 py-1.5 text-[12px] leading-snug ${
                          m.sender === 'admin'
                            ? 'bg-secondary/70 text-foreground self-start'
                            : 'bg-primary text-primary-foreground self-end ml-auto'
                        }`}
                      >
                        <p>{m.message}</p>
                        <p className="text-[9px] opacity-60 mt-0.5">
                          {new Date(m.originalCreatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default OrdersView;
