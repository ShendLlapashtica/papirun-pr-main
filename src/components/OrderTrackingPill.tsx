import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, Bike, ChefHat, MessageCircle, X as XIcon, Star, Download } from 'lucide-react';
import { fetchOrder, subscribeOrderRealtime, type OrderRecord, type OrderStatus } from '@/lib/ordersApi';
import { rateDriver, fetchDriverLocation, subscribeDriverLocation, fetchDriverById, driverShortCode } from '@/lib/driversApi';
import { generateInvoice } from '@/lib/invoiceGenerator';
import OrderStatusModal from '@/components/OrderStatusModal';
import OrderChat from '@/components/OrderChat';
import CustomerDriverMap from '@/components/CustomerDriverMap';
import { useLanguage } from '@/contexts/LanguageContext';
import { haptic, lockBackButton, unlockBackButton } from '@/lib/native';

const GOOGLE_REVIEW_URL = 'https://www.google.com/search?q=papirun+reviews#lrd=0x13549ee685d7c721:0xff91baa797df481e,3,,,,';

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

const HIDDEN_ROUTES = ['/login', '/signup', '/verify', '/admin', '/driver'];

const OrderTrackingPill = () => {
  const { language } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const isHiddenRoute = HIDDEN_ROUTES.some((p) => location.pathname.startsWith(p));
  const [orderId, setOrderId] = useState<string | null>(getActiveId());
  const [order, setOrder] = useState<OrderRecord | null>(null);
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [showThankYou, setShowThankYou] = useState(false);
  const [ratingValue, setRatingValue] = useState(0);
  const [ratingNote, setRatingNote] = useState('');
  const ratingTriggeredRef = useRef(false);
  // Set true when the user just placed a fresh order (optimistic→real transition)
  const fromFreshPlacementRef = useRef(false);
  const [pendingElapsed, setPendingElapsed] = useState(0);
  // Auto-show chat when approved; set false when user explicitly closes so pill re-appears
  const [autoShowEnabled, setAutoShowEnabled] = useState(true);
  // Live driver location for the customer map (only used when out_for_delivery)
  const [driverPos, setDriverPos] = useState<{ lat: number; lng: number } | null>(null);
  const [etaMinutes, setEtaMinutes] = useState<number | null>(null);
  const [driverInfo, setDriverInfo] = useState<{ code: string; color: string } | null>(null);

  useEffect(() => { setAutoShowEnabled(true); }, [orderId]);

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
      fromFreshPlacementRef.current = true; // next real ID is a freshly placed order
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
    const wasFresh = fromFreshPlacementRef.current;
    fromFreshPlacementRef.current = false;

    let active = true;
    const fetchIt = async () => {
      try {
        const o = await fetchOrder(orderId);
        if (!active) return;
        if (!o) { clearActiveId(); setOrderId(null); return; }
        setOrder(o);
        // Admin approved before our subscription connected — open chat immediately
        if (wasFresh && (o.status === 'approved' || o.status === 'preparing' || o.status === 'out_for_delivery')) {
          haptic('success');
          setOpen(true);
        }
      } catch {}
    };

    fetchIt();

    const unsub = subscribeOrderRealtime(orderId, (updated) => {
      if (!active) return;
      setOrder(updated);
    });
    return () => { active = false; unsub(); };
  }, [orderId]);

  // Poll every 2s while pending — guarantees transition even if realtime lags or misses
  useEffect(() => {
    if (!orderId || orderId.startsWith('optimistic-') || order?.status !== 'pending') return;
    const poll = setInterval(async () => {
      try {
        const o = await fetchOrder(orderId);
        if (!o) {
          // Order was deleted from DB — clear the stuck overlay
          clearActiveId();
          setOrderId(null);
          return;
        }
        if (o.status !== 'pending') {
          setOrder(o);
          if (o.status === 'approved' || o.status === 'preparing' || o.status === 'out_for_delivery') {
            haptic('success');
            setOpen(true);
          }
        }
      } catch {}
    }, 2000);
    return () => clearInterval(poll);
  }, [orderId, order?.status]);

  // Poll every 5s while active — catches 'completed' transition if realtime misses it (rating form fix)
  useEffect(() => {
    if (!orderId || orderId.startsWith('optimistic-')) return;
    const ACTIVE: OrderStatus[] = ['approved', 'preparing', 'out_for_delivery'];
    if (!ACTIVE.includes(order?.status as OrderStatus)) return;
    const poll = setInterval(async () => {
      try {
        const o = await fetchOrder(orderId);
        if (o && o.status !== order?.status) setOrder(o);
      } catch {}
    }, 5_000);
    return () => clearInterval(poll);
  }, [orderId, order?.status]);

  // Track driver GPS in real-time when out_for_delivery — powers the customer map + ETA.
  // Primary: Supabase Realtime fires the instant the driver saves a new position.
  // Fallback: poll every 15s in case the realtime channel drops.
  useEffect(() => {
    if (order?.status !== 'out_for_delivery' || !order?.assignedDriverId) {
      setDriverPos(null);
      setEtaMinutes(null);
      return;
    }
    const driverId = order.assignedDriverId;
    const customerLat = order.deliveryLat;
    const customerLng = order.deliveryLng;

    const fetchPos = async () => {
      try {
        const loc = await fetchDriverLocation(driverId);
        if (loc) setDriverPos({ lat: loc.lat, lng: loc.lng });
      } catch {}
    };

    fetchPos(); // immediate first fetch
    const unsubRealtime = subscribeDriverLocation(driverId, fetchPos);
    const interval = setInterval(fetchPos, 5_000); // 5s fallback — realtime may not fire for anon users
    return () => { clearInterval(interval); unsubRealtime(); };
  }, [order?.status, order?.assignedDriverId, order?.deliveryLat, order?.deliveryLng]);

  // Fetch driver info (code + color) for the map badge when order has an assigned driver
  useEffect(() => {
    if (!order?.assignedDriverId) { setDriverInfo(null); return; }
    fetchDriverById(order.assignedDriverId)
      .then((d) => { if (d) setDriverInfo({ code: driverShortCode(d), color: d.color || '#3b82f6' }); })
      .catch(() => {});
  }, [order?.assignedDriverId]);

  // Tick elapsed seconds while pending — enables emergency escape after 8 min
  useEffect(() => {
    if (order?.status !== 'pending') { setPendingElapsed(0); return; }
    const tick = setInterval(() => setPendingElapsed((e) => e + 1), 1000);
    return () => clearInterval(tick);
  }, [order?.status]);

  // Trigger rating form when order completes and has a driver
  useEffect(() => {
    if (!order) return;
    if (order.status === 'completed' && !ratingTriggeredRef.current) {
      const alreadyRated = localStorage.getItem(`papirun_rated_${order.id}`);
      if (!alreadyRated) {
        ratingTriggeredRef.current = true;
        setShowRating(true);
      }
    }
  }, [order?.status, order?.id, order?.assignedDriverId]);

  // Auto-dismiss terminal states — rejected waits 5 min so user can read; completed auto-closes after 8 s
  useEffect(() => {
    if (!order) return;
    if (TERMINAL.includes(order.status) && !showRating) {
      const delay = order.status === 'rejected' ? 300_000 : 8_000;
      const t = setTimeout(() => {
        clearActiveId();
        setHidden(true);
        setOrderId(null);
      }, delay);
      return () => clearTimeout(t);
    }
  }, [order?.status, showRating]);

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

  // Auto-open chat the moment admin approves/rejects the order + haptic feedback
  const prevStatusRef = useRef<OrderStatus | undefined>(undefined);
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = order?.status;
    const wasOnCart = location.search.includes('tab=cart');
    if (prev === 'pending' && order?.status === 'approved') {
      haptic('success');
      setOpen(true);
      if (wasOnCart) navigate('/home', { replace: true });
    } else if (prev === 'pending' && order?.status === 'rejected') {
      haptic('error');
      setOpen(true);
      if (wasOnCart) navigate('/home', { replace: true });
    }
  }, [order?.status]);

  if (isHiddenRoute) return null;
  if (!order || hidden) return null;
  // Archived orders (isVisible=false or status=histori) must not surface to the customer.
  if (order.isVisible === false || (order.status as string) === 'histori') return null;

  const status = order.status;
  const isPending = status === 'pending';
  const isApproved = status === 'approved' || status === 'preparing' || status === 'out_for_delivery';

  // ===== THANK-YOU SCREEN — shown after 5-star rating =====
  if (showThankYou) {
    const finish = () => {
      setShowThankYou(false);
      clearActiveId();
      setHidden(true);
      setOrderId(null);
    };
    return (
      <AnimatePresence>
        <motion.div
          key="thankyou-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-[9998] flex flex-col items-center justify-center px-6"
          style={{ background: 'hsl(var(--background) / 0.88)', backdropFilter: 'blur(18px)' }}
        >
          <motion.div
            initial={{ scale: 0.88, opacity: 0, y: 24 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            className="w-full max-w-sm bg-card rounded-3xl p-8 shadow-xl text-center"
          >
            <div className="text-6xl mb-4">😊</div>
            <h2 className="font-display text-xl font-bold mb-2 tracking-tight">
              Gezohemi që jeni të kënaqur me porosinë!
            </h2>
            <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
              Do e vlerësonim shumë nga ana juaj një Review në Google — ndihmon shumë biznesin tonë!
            </p>
            <a
              href={GOOGLE_REVIEW_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={finish}
              className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-[#4285F4] text-white text-sm font-bold shadow-lg shadow-[#4285F4]/30 hover:bg-[#3574E2] active:scale-[0.98] transition-all mb-3"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Lë një Review në Google
            </a>
            <button
              onClick={finish}
              className="w-full py-2.5 rounded-xl bg-secondary text-sm font-semibold hover:bg-secondary/80 transition-colors text-muted-foreground"
            >
              Tani jo, faleminderit
            </button>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // ===== RATING FORM — appears when order is completed and driver was assigned =====
  if (showRating) {
    const dismiss = () => {
      setShowRating(false);
      clearActiveId();
      setHidden(true);
      setOrderId(null);
    };
    const submitRating = async () => {
      try {
        await rateDriver(order.id, ratingValue, ratingNote.trim() || undefined);
        try { localStorage.setItem(`papirun_rated_${order.id}`, '1'); } catch {}
      } catch { /* silent — still dismiss */ }
      if (ratingValue === 5) {
        setShowRating(false);
        setShowThankYou(true);
      } else {
        dismiss();
      }
    };
    return (
      <AnimatePresence>
        <motion.div
          key="rating-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-[9998] flex flex-col items-center justify-center px-6"
          style={{ background: 'hsl(var(--background) / 0.88)', backdropFilter: 'blur(18px)' }}
        >
          <motion.div
            initial={{ scale: 0.88, opacity: 0, y: 24 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            className="w-full max-w-sm bg-card rounded-3xl p-8 shadow-xl text-center"
          >
            <div className="w-16 h-16 rounded-2xl bg-amber-400/15 flex items-center justify-center mx-auto mb-5">
              <Star className="w-8 h-8 text-amber-500" fill="currentColor" />
            </div>
            <h2 className="font-display text-2xl font-bold mb-2 tracking-tight">
              {language === 'sq' ? 'Si ishte dërgesa?' : 'How was your delivery?'}
            </h2>
            <p className="text-muted-foreground text-sm mb-6">
              {language === 'sq' ? 'Vlerëso shoferin tënd' : 'Rate your driver'}
            </p>
            <div className="mb-6">
              <div className="text-6xl mb-4 transition-all duration-200 select-none text-center">
                {(['', '😢', '😕', '😐', '🙂', '🤩'] as const)[ratingValue] || '🤔'}
              </div>
              <div className="flex justify-center gap-3">
                {[1, 2, 3, 4, 5].map((v) => {
                  const filled = v <= ratingValue;
                  const c = ratingValue <= 2 ? '#f87171' : ratingValue === 3 ? '#fbbf24' : ratingValue === 4 ? '#4ade80' : '#d946ef';
                  return (
                    <button
                      key={v}
                      onClick={() => setRatingValue(v)}
                      className="transition-all duration-150 hover:scale-125 active:scale-95"
                    >
                      <Star
                        className="w-10 h-10 transition-all duration-200"
                        fill={filled ? c : 'transparent'}
                        strokeWidth={1.5}
                        style={{ color: filled ? c : 'hsl(var(--muted-foreground) / 0.3)' }}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
            <textarea
              value={ratingNote}
              onChange={(e) => setRatingNote(e.target.value)}
              placeholder={language === 'sq' ? 'Koment (opsional)...' : 'Comment (optional)...'}
              rows={2}
              className="w-full px-4 py-3 rounded-xl bg-secondary text-sm resize-none mb-5 focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <div className="flex gap-3">
              <button
                onClick={dismiss}
                className="flex-1 py-3 rounded-xl bg-secondary text-sm font-semibold hover:bg-secondary/80 transition-colors"
              >
                {language === 'sq' ? 'Kalo' : 'Skip'}
              </button>
              <button
                disabled={ratingValue === 0}
                onClick={submitRating}
                className="flex-[1.4] py-3 rounded-xl bg-amber-400 text-amber-900 text-sm font-bold disabled:opacity-40 hover:bg-amber-500 active:scale-[0.98] transition-all shadow-lg shadow-amber-400/30"
              >
                {language === 'sq' ? 'Dërgo' : 'Submit'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  }

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
            {pendingElapsed > 480 && (
              <button
                type="button"
                onClick={() => { clearActiveId(); setHidden(true); setOrderId(null); }}
                className="mt-2 text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors underline"
              >
                {language === 'sq' ? 'Anulo porosinë' : 'Cancel order'}
              </button>
            )}
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

  // Auto-open chat when approved; pill shows when modal is dismissed
  const showModal = open || (isApproved && autoShowEnabled);

  return (
    <>
      <AnimatePresence>
        {!showModal && <motion.div
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
        </motion.div>}
      </AnimatePresence>

      {orderId && showModal && (
        <div className="fixed bottom-0 left-0 right-0 z-[60] p-3 pointer-events-none">
          <div className="max-w-md mx-auto bg-background rounded-2xl shadow-2xl border border-border/50 overflow-hidden pointer-events-auto" style={{ maxHeight: '82vh' }}>
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/40">
              <span className="text-sm font-semibold flex items-center gap-1.5">
                <MessageCircle className="w-3.5 h-3.5 text-primary" />
                PapirunChat
              </span>
              <div className="flex items-center gap-1">
                {order && !isRejected && (
                  <button
                    onClick={() => generateInvoice(order, true)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-bold hover:bg-primary/20 active:scale-95 transition-all"
                  >
                    <Download className="w-3 h-3" />
                    Shkarko Faturimin
                  </button>
                )}
                <button onClick={() => { setOpen(false); setAutoShowEnabled(false); }} className="p-1 rounded-full hover:bg-secondary">
                  <XIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
            {/* Rejection banner with admin note */}
            {isRejected && (
              <div className="px-4 py-3 bg-red-50 dark:bg-red-950/40 border-b border-red-100 dark:border-red-900/40">
                <p className="text-xs font-bold text-red-600 dark:text-red-400 flex items-center gap-1.5 mb-1">
                  <XCircle className="w-3.5 h-3.5 shrink-0" strokeWidth={2.4} />
                  {language === 'sq' ? 'Porosia u refuzua' : 'Order rejected'}
                </p>
                {order?.adminNote && (
                  <p className="text-sm text-red-700 dark:text-red-300 leading-snug">{order.adminNote}</p>
                )}
              </div>
            )}
            {/* Live driver map — only when out_for_delivery and driver location is known */}
            {order?.status === 'out_for_delivery' &&
              driverPos &&
              order.deliveryLat != null &&
              order.deliveryLng != null && (
                <div className="border-b border-border/30">
                  {/* Driver ETA banner */}
                  {driverInfo && (
                    <div className="px-4 py-2.5 bg-primary/8 border-b border-primary/15 flex items-start gap-2 text-xs">
                      <span style={{ fontSize: '15px', lineHeight: 1 }}>🏍️</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-foreground leading-snug">
                          Shoferi yt{etaMinutes !== null ? ` është ~${etaMinutes} minuta larg teje` : ' është në rrugë'}.
                        </p>
                        <p className="text-muted-foreground mt-0.5">Ju lutem jini në dispozicion për dërgesen!</p>
                      </div>
                    </div>
                  )}
                  <CustomerDriverMap
                    driverLat={driverPos.lat}
                    driverLng={driverPos.lng}
                    customerLat={order.deliveryLat}
                    customerLng={order.deliveryLng}
                    etaMinutes={etaMinutes}
                    driverCode={driverInfo?.code}
                    driverColor={driverInfo?.color}
                    allowFullscreen
                    onRouteLoaded={(durationSec) =>
                      setEtaMinutes(Math.max(1, Math.ceil((durationSec / 60) * 1.2)))
                    }
                  />
                </div>
              )}
            <OrderChat
              orderId={orderId}
              viewerSide="user"
              disabled={order?.status === 'pending' || order?.status === 'rejected' || order?.status === 'completed'}
              maxHeightClass={order?.status === 'out_for_delivery' && driverPos ? 'max-h-36' : 'max-h-64'}
            />
          </div>
        </div>
      )}
    </>
  );
};

export default OrderTrackingPill;
