import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, Bike, ChefHat, MessageCircle, X as XIcon } from 'lucide-react';
import { fetchOrder, subscribeOrderRealtime, type OrderRecord, type OrderStatus } from '@/lib/ordersApi';
import OrderStatusModal from '@/components/OrderStatusModal';
import { useLanguage } from '@/contexts/LanguageContext';
import { haptic, lockBackButton, unlockBackButton } from '@/lib/native';

const STORAGE_KEY = 'papirun_active_order_id';

const getActiveId = (): string | null => {
  try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
};
const clearActiveId = () => { try { localStorage.removeItem(STORAGE_KEY); } catch {} };

export const setActiveOrderId = (id: string) => {
  try { localStorage.setItem(STORAGE_KEY, id); } catch {}
  window.dispatchEvent(new Event('papirun:active-order-changed'));
};

export const clearActiveOrderId = () => {
  clearActiveId();
  window.dispatchEvent(new Event('papirun:active-order-changed'));
};

const TERMINAL: OrderStatus[] = ['rejected', 'completed'];

const HIDDEN_ROUTES = ['/login', '/signup', '/verify', '/admin'];

const OrderTrackingPill = () => {
  const { language } = useLanguage();
  const location = useLocation();
  const isHiddenRoute = HIDDEN_ROUTES.some((p) => location.pathname.startsWith(p));
  const [orderId, setOrderId] = useState<string | null>(getActiveId());
  const [order, setOrder] = useState<OrderRecord | null>(null);
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const onChange = () => { setOrderId(getActiveId()); setHidden(false); };
    window.addEventListener('papirun:active-order-changed', onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener('papirun:active-order-changed', onChange);
      window.removeEventListener('storage', onChange);
    };
  }, []);

  useEffect(() => {
    if (!orderId) { setOrder(null); return; }
    // Optimistic ID — show pending overlay immediately, no server fetch
    if (orderId.startsWith('optimistic-')) {
      setOrder({
        id: orderId,
        userId: null,
        customerName: '',
        customerPhone: '',
        deliveryAddress: '',
        deliveryLat: null,
        deliveryLng: null,
        locationId: null,
        items: [],
        subtotal: 0,
        deliveryFee: 0,
        total: 0,
        status: 'pending',
        adminNote: '',
        notes: '',
        statusHistory: [],
        source: 'web',
        prepEtaMinutes: null,
        isVisible: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as OrderRecord);
      return;
    }
    let active = true;
    const fetchIt = async () => {
      try {
        const o = await fetchOrder(orderId);
        if (!active) return;
        if (!o) { clearActiveId(); setOrderId(null); return; }
        setOrder(o);
      } catch {}
    };

    fetchIt();
    const pollInterval = setInterval(fetchIt, 4000); // Polling fallback every 4s to guarantee spot-on updates

    const unsub = subscribeOrderRealtime(orderId, (updated) => {
      if (!active) return;
      setOrder(updated);
    });
    return () => { active = false; clearInterval(pollInterval); unsub(); };
  }, [orderId]);

  // Auto-dismiss terminal states after 8s (so user sees the result)
  useEffect(() => {
    if (!order) return;
    if (TERMINAL.includes(order.status)) {
      const t = setTimeout(() => {
        clearActiveId();
        setHidden(true);
        setOrderId(null);
      }, 8000);
      return () => clearTimeout(t);
    }
  }, [order?.status]);

  // Lock body scroll AND hardware back button while pending overlay is up.
  // The user MUST wait for admin to approve/reject — no escape possible.
  useEffect(() => {
    if (order?.status !== 'pending') return;

    const prevOverflow = document.body.style.overflow;
    const prevTouch = (document.body.style as any).touchAction;
    const prevPosition = document.body.style.position;
    document.body.style.overflow = 'hidden';
    (document.body.style as any).touchAction = 'none';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';

    const blockKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); }
    };
    const blockPop = () => { window.history.pushState(null, '', window.location.href); };
    window.history.pushState(null, '', window.location.href);

    window.addEventListener('keydown', blockKey, true);
    window.addEventListener('popstate', blockPop);
    lockBackButton();
    haptic('warning');

    return () => {
      document.body.style.overflow = prevOverflow;
      (document.body.style as any).touchAction = prevTouch;
      document.body.style.position = prevPosition;
      document.body.style.width = '';
      window.removeEventListener('keydown', blockKey, true);
      window.removeEventListener('popstate', blockPop);
      unlockBackButton();
    };
  }, [order?.status]);

  // Auto-open chat the moment admin approves the order + haptic feedback
  const prevStatusRef = (OrderTrackingPill as any)._prev || { current: undefined as OrderStatus | undefined };
  (OrderTrackingPill as any)._prev = prevStatusRef;
  useEffect(() => {
    const prev = prevStatusRef.current;
    if (prev === 'pending' && order?.status === 'approved') {
      haptic('success');
      setOpen(true);
    } else if (prev === 'pending' && order?.status === 'rejected') {
      haptic('error');
    }
    prevStatusRef.current = order?.status;
  }, [order?.status]);

  if (isHiddenRoute) return null;
  if (!order || hidden) return null;
  // Soft-deleted orders should not surface to the user.
  if (order.isVisible === false) return null;

  const status = order.status;
  const isPending = status === 'pending';
  const isApproved = status === 'approved' || status === 'preparing' || status === 'out_for_delivery';

  // ===== UNSKIPPABLE FULLSCREEN OVERLAY for PENDING — light glassmorphism, sage spinner =====
  if (isPending) {
    return (
      <AnimatePresence>
        <motion.div
          key="pending-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.45 }}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onTouchStart={(e) => e.stopPropagation()}
          onWheel={(e) => e.preventDefault()}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center px-6 select-none touch-none overscroll-none"
          style={{
            background: 'hsl(var(--background) / 0.78)',
            backdropFilter: 'blur(18px) saturate(140%)',
            WebkitBackdropFilter: 'blur(18px) saturate(140%)',
          }}
        >
          {/* Soft sage ambient glow */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[640px] h-[640px] rounded-full pointer-events-none"
            style={{
              background: 'radial-gradient(circle, hsl(var(--primary) / 0.18) 0%, transparent 65%)',
              filter: 'blur(60px)',
            }}
          />

          {/* Sage spinner */}
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 22 }}
            className="relative w-40 h-40 sm:w-48 sm:h-48 mb-10"
          >
            {/* Soft pulse ring */}
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{ border: '1px solid hsl(var(--primary) / 0.25)' }}
              animate={{ scale: [1, 1.18, 1], opacity: [0.6, 0, 0.6] }}
              transition={{ duration: 2.6, repeat: Infinity, ease: 'easeOut' }}
            />
            {/* Track */}
            <div
              className="absolute inset-2 rounded-full"
              style={{ border: '4px solid hsl(var(--primary) / 0.12)' }}
            />
            {/* Spinning sage arc */}
            <motion.div
              className="absolute inset-2 rounded-full"
              style={{
                border: '4px solid transparent',
                borderTopColor: 'hsl(var(--primary))',
                borderRightColor: 'hsl(var(--primary) / 0.55)',
                boxShadow: '0 0 30px hsl(var(--primary) / 0.35)',
              }}
              animate={{ rotate: 360 }}
              transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
            />
          </motion.div>

          {/* Heading + helper */}
          <motion.div
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 240, damping: 24 }}
            className="text-center max-w-md"
          >
            <h2
              className="font-display text-3xl sm:text-4xl font-semibold mb-3 tracking-tight leading-snug text-foreground"
            >
              {language === 'sq' ? 'Porosia juaj është në shqyrtim…' : 'Your order is under review…'}
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground leading-relaxed font-medium">
              {language === 'sq' ? 'Ju lutem prisni' : 'Please wait'}
            </p>
          </motion.div>

          {/* Order id at bottom */}
          <div className="absolute bottom-10 left-0 right-0 text-center">
            <p className="text-[11px] text-muted-foreground/70 font-mono tracking-[0.2em] uppercase">
              {language === 'sq' ? 'Porosia' : 'Order'} · #{order.id.slice(0, 8).toUpperCase()}
            </p>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // ===== ELEGANT PILL — sage gradient with chat affordance =====
  const isRejected = status === 'rejected';
  const isCompleted = status === 'completed';

  let icon: JSX.Element;
  let label: string;
  if (status === 'approved') {
    icon = <CheckCircle2 className="w-4 h-4" strokeWidth={2.4} />;
    label = language === 'sq' ? 'Porosia u aprovua' : 'Order approved';
  } else if (status === 'preparing') {
    icon = <ChefHat className="w-4 h-4" strokeWidth={2.4} />;
    label = language === 'sq' ? 'Po përgatitet' : 'Preparing';
  } else if (status === 'out_for_delivery') {
    icon = <Bike className="w-4 h-4" strokeWidth={2.4} />;
    label = language === 'sq' ? 'Në rrugë te ti' : 'On the way';
  } else if (isRejected) {
    icon = <XCircle className="w-4 h-4" strokeWidth={2.4} />;
    label = language === 'sq' ? 'Porosia u refuzua' : 'Order rejected';
  } else if (isCompleted) {
    icon = <CheckCircle2 className="w-4 h-4" strokeWidth={2.4} />;
    label = language === 'sq' ? 'Porosia u përfundua' : 'Order completed';
  } else {
    return null;
  }

  // Color system: sage primary for positive, soft pastel red for rejected
  const isNegative = isRejected;
  const pillBg = isNegative
    ? 'linear-gradient(135deg, hsl(0 70% 96%), hsl(0 70% 92%))'
    : 'linear-gradient(135deg, hsl(var(--primary) / 0.18), hsl(var(--primary) / 0.28))';
  const pillBorder = isNegative ? 'hsl(0 60% 78%)' : 'hsl(var(--primary) / 0.45)';
  const pillText = isNegative ? 'hsl(0 55% 42%)' : 'hsl(var(--primary))';
  const pillShadow = isNegative
    ? '0 8px 24px -8px hsl(0 60% 60% / 0.35)'
    : '0 8px 24px -8px hsl(var(--primary) / 0.45)';

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    haptic('light');
    clearActiveId();
    setHidden(true);
    setOrderId(null);
  };

  return (
    <>
      <AnimatePresence>
        <motion.div
          key="order-pill"
          initial={{ y: -16, opacity: 0, scale: 0.92 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -16, opacity: 0, scale: 0.92 }}
          transition={{ type: 'spring', stiffness: 380, damping: 28 }}
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[55] flex items-stretch rounded-full backdrop-blur-xl overflow-hidden"
          style={{
            maxWidth: 'calc(100vw - 32px)',
            background: pillBg,
            border: `1px solid ${pillBorder}`,
            color: pillText,
            boxShadow: pillShadow,
          }}
        >
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex items-center gap-2.5 pl-5 pr-4 py-3 active:scale-[0.97] transition-transform"
            aria-label={label}
          >
            {isApproved && (
              <span className="relative flex h-2 w-2 shrink-0">
                <span
                  className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                  style={{ background: 'hsl(var(--primary))' }}
                />
                <span
                  className="relative inline-flex rounded-full h-2 w-2"
                  style={{ background: 'hsl(var(--primary))' }}
                />
              </span>
            )}
            <span className="flex items-center justify-center shrink-0">{icon}</span>
            <span className="text-sm font-semibold truncate tracking-tight">{label}</span>
            {isApproved && (
              <span className="flex items-center gap-1 ml-1 pl-2.5 border-l" style={{ borderColor: 'hsl(var(--primary) / 0.35)' }}>
                <MessageCircle className="w-3.5 h-3.5 shrink-0" strokeWidth={2.4} />
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  {language === 'sq' ? 'Bisedo' : 'Chat'}
                </span>
              </span>
            )}
          </button>
          {/* Dismiss button — symmetrical pill end */}
          <button
            type="button"
            onClick={handleDismiss}
            className="flex items-center justify-center px-3 border-l active:scale-90 transition-transform hover:bg-foreground/5"
            style={{ borderColor: pillBorder }}
            aria-label={language === 'sq' ? 'Mbyll' : 'Dismiss'}
            title={language === 'sq' ? 'Mbyll' : 'Dismiss'}
          >
            <XIcon className="w-3.5 h-3.5 opacity-70" strokeWidth={2.4} />
          </button>
        </motion.div>
      </AnimatePresence>

      {orderId && open && (
        <OrderStatusModal orderId={orderId} isOpen={open} onClose={() => setOpen(false)} />
      )}
    </>
  );
};

export default OrderTrackingPill;
