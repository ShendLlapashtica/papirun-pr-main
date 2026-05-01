import { useEffect, useState } from 'react';
import { Loader2, X, MessageCircle, Trash2, Clock, CheckCircle2, XCircle, ChefHat, Bike, PartyPopper, Send, Star } from 'lucide-react';
import { toast } from 'sonner';
import { fetchOrder, subscribeOrderRealtime, softDeleteOrder, type OrderRecord, type OrderStatus } from '@/lib/ordersApi';
import { useLanguage } from '@/contexts/LanguageContext';
import OrderChat from '@/components/OrderChat';
import { clearActiveOrderId } from '@/components/OrderTrackingPill';
import { rateDriver } from '@/lib/driversApi';

interface Props {
  orderId: string;
  isOpen: boolean;
  onClose: () => void;
}

const WHATSAPP_FALLBACK = '38345262323';

const STATUS_LABELS_SQ: Record<string, string> = {
  pending: 'Porosia u dërgua',
  approved: 'Porosia u aprovua',
  preparing: 'Po përgatitet',
  out_for_delivery: 'Në rrugë',
  rejected: 'Porosia u refuzua',
  completed: 'Porosia u përfundua',
};
const STATUS_LABELS_EN: Record<string, string> = {
  pending: 'Order received',
  approved: 'Order approved',
  preparing: 'Preparing',
  out_for_delivery: 'On the way',
  rejected: 'Order rejected',
  completed: 'Order completed',
};

// Soft, pleasant icons per status — sage greens for positive, pastel red for rejected
const STATUS_ICON: Record<OrderStatus, { Icon: typeof CheckCircle2; color: string; bg: string }> = {
  pending:          { Icon: Send,         color: 'hsl(var(--primary))', bg: 'hsl(var(--primary) / 0.12)' },
  approved:         { Icon: CheckCircle2, color: 'hsl(var(--primary))', bg: 'hsl(var(--primary) / 0.14)' },
  preparing:        { Icon: ChefHat,      color: 'hsl(var(--primary))', bg: 'hsl(var(--primary) / 0.14)' },
  out_for_delivery: { Icon: Bike,         color: 'hsl(var(--primary))', bg: 'hsl(var(--primary) / 0.14)' },
  // pastel red — soft, not alarming
  rejected:         { Icon: XCircle,      color: 'hsl(0 55% 62%)',      bg: 'hsl(0 70% 94%)' },
  completed:        { Icon: PartyPopper,  color: 'hsl(var(--primary))', bg: 'hsl(var(--primary) / 0.14)' },
};

const formatTime = (iso: string) => {
  try { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
  catch { return ''; }
};

const OrderStatusModal = ({ orderId, isOpen, onClose }: Props) => {
  const [order, setOrder] = useState<OrderRecord | null>(null);
  const [chatCount, setChatCount] = useState<number | null>(null);
  const [driverRating, setDriverRating] = useState<number>(0);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const { language } = useLanguage();

  useEffect(() => {
    if (!isOpen || !orderId) return;
    let active = true;
    fetchOrder(orderId).then((o) => { if (active) setOrder(o); });
    const unsub = subscribeOrderRealtime(orderId, (updated) => setOrder(updated));
    return () => { active = false; unsub(); };
  }, [orderId, isOpen]);

  if (!isOpen) return null;

  const status = order?.status ?? 'pending';
  const labels = language === 'sq' ? STATUS_LABELS_SQ : STATUS_LABELS_EN;
  const events = order?.statusHistory ?? [];
  const canDelete = status === 'completed' || status === 'rejected';
  // Chat input is enabled ONLY after admin has approved (or further). Prevents spamming during review.
  const chatDisabled = status === 'pending' || status === 'rejected' || status === 'completed';
  // Hide chat section entirely if it's locked AND empty (e.g. admin wiped it, or never started)
  const hideChat = chatDisabled && chatCount === 0;

  const handleDelete = async () => {
    if (!order) return;
    if (!window.confirm(language === 'sq' ? 'Arkivo këtë porosi?' : 'Archive this order?')) return;
    try {
      await softDeleteOrder(order.id);
      toast.success(language === 'sq' ? 'Porosia u arkivua' : 'Order archived');
      try {
        const raw = localStorage.getItem('papirun_my_orders');
        if (raw) {
          const arr: string[] = JSON.parse(raw);
          localStorage.setItem('papirun_my_orders', JSON.stringify(arr.filter((id) => id !== order.id)));
        }
      } catch {}
      clearActiveOrderId();
      onClose();
    } catch (e) { console.error(e); toast.error(language === 'sq' ? 'Gabim' : 'Failed'); }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-background rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border/50 shrink-0">
          <div>
            <h2 className="font-display font-bold text-base">
              {language === 'sq' ? 'Porosia juaj' : 'Your order'}
            </h2>
            <p className="text-[11px] text-muted-foreground">{labels[status] ?? status}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-secondary">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ WebkitOverflowScrolling: 'touch' }}>
          {/* Status timeline */}
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1">
              {language === 'sq' ? 'Statusi' : 'Status'}
            </h3>
            <div className="space-y-1.5">
              {events.length === 0 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {language === 'sq' ? 'Po ngarkohet...' : 'Loading...'}
                </div>
              )}
              {events.map((m, i) => {
                const meta = STATUS_ICON[m.status as OrderStatus];
                const Icon = meta?.Icon ?? CheckCircle2;
                return (
                  <div key={i} className="flex items-start gap-2.5 text-sm">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                      style={{ backgroundColor: meta?.bg, color: meta?.color }}
                    >
                      <Icon className="w-3.5 h-3.5" strokeWidth={2.4} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium leading-tight">{labels[m.status] ?? m.status}</div>
                      {m.note && <div className="text-xs text-muted-foreground mt-0.5">{m.note}</div>}
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0 mt-1">{formatTime(m.at)}</span>
                  </div>
                );
              })}
            </div>
            {order?.prepEtaMinutes && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-primary bg-primary/5 rounded-lg px-2.5 py-1.5">
                <Clock className="w-3.5 h-3.5" />
                {language === 'sq' ? `Gati për ~${order.prepEtaMinutes} min` : `Ready in ~${order.prepEtaMinutes} min`}
              </div>
            )}
          </div>

          {/* Chat — visually hidden when locked AND empty (still mounted to fetch count) */}
          <div style={{ display: hideChat ? 'none' : 'block' }}>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1 flex items-center gap-1.5">
              <MessageCircle className="w-3 h-3" />
              {language === 'sq' ? 'PapirunChat · bisedo me Papirun' : 'PapirunChat · chat with Papirun'}
            </h3>
            <OrderChat
              orderId={orderId}
              viewerSide="user"
              disabled={chatDisabled}
              maxHeightClass="max-h-72"
              onMessagesCountChange={setChatCount}
            />
          </div>
        </div>

        <div className="p-4 border-t border-border/50 space-y-3 shrink-0">
          {status === 'completed' && order?.assignedDriverId && !ratingSubmitted && (
            <div className="bg-secondary/30 p-3 rounded-xl border border-border/50">
              <p className="text-xs font-semibold text-center mb-2">{language === 'sq' ? 'Si ishte dërgesa?' : 'How was the delivery?'}</p>
              <div className="flex items-center justify-center gap-3 mb-3">
                <button
                  onClick={async () => {
                    setDriverRating(5);
                    const note = prompt(language === 'sq' ? 'Mund të lini një koment (opsionale):' : 'Leave a note (optional):');
                    await rateDriver(order.id, 5, note || undefined);
                    setRatingSubmitted(true);
                    toast.success(language === 'sq' ? 'Faleminderit për vlerësimin!' : 'Thanks for rating!');
                  }}
                  className="text-2xl hover:scale-125 transition-transform" title="I kënaqur">😊</button>
                <button
                  onClick={async () => {
                    setDriverRating(3);
                    const note = prompt(language === 'sq' ? 'Mund të lini një koment (opsionale):' : 'Leave a note (optional):');
                    await rateDriver(order.id, 3, note || undefined);
                    setRatingSubmitted(true);
                    toast.success(language === 'sq' ? 'Faleminderit për vlerësimin!' : 'Thanks for rating!');
                  }}
                  className="text-2xl hover:scale-125 transition-transform" title="Neutral">😐</button>
                <button
                  onClick={async () => {
                    setDriverRating(1);
                    const note = prompt(language === 'sq' ? 'Mund të lini një koment (opsionale):' : 'Leave a note (optional):');
                    await rateDriver(order.id, 1, note || undefined);
                    setRatingSubmitted(true);
                    toast.success(language === 'sq' ? 'Faleminderit për vlerësimin!' : 'Thanks for rating!');
                  }}
                  className="text-2xl hover:scale-125 transition-transform" title="I pakënaqur">☹️</button>
              </div>
            </div>
          )}
          {status === 'completed' && ratingSubmitted && (
            <div className="bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20 text-emerald-600 text-center text-xs font-semibold">
              {language === 'sq' ? 'Vlerësimi u dërgua me sukses.' : 'Rating submitted successfully.'}
            </div>
          )}
          
          <div className="space-y-2">
            {status === 'rejected' && (
              <a
                href={`https://wa.me/${WHATSAPP_FALLBACK}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[hsl(142,70%,40%)] text-white text-sm font-semibold"
              >
                <MessageCircle className="w-4 h-4" /> {language === 'sq' ? 'WhatsApp' : 'WhatsApp'}
              </a>
            )}
            {canDelete && (
              <button onClick={handleDelete} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-destructive/10 text-destructive text-sm font-semibold">
                <Trash2 className="w-4 h-4" /> {language === 'sq' ? 'Arkivo porosinë' : 'Archive order'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderStatusModal;
