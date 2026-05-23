import React, { useEffect, useRef, useState, useCallback, Component } from 'react';
import { Bike, Phone, MapPin, Clock, MessageCircle, LogOut, Package, CheckCheck, Navigation, Coffee, TrendingUp, Timer, BookOpen, Lock } from 'lucide-react';
import { toast } from 'sonner';
import {
  fetchDrivers,
  fetchDriverById,
  fetchDriverOrders,
  fetchOrderAssignTimes,
  saveDriverPushSub,
  seedDefaultDrivers,
  subscribeDriverOrdersRealtime,
  subscribeDriverPauseState,
  updateDriverLocation,
  updateDriver,
  setDriverPause,
  requestDriverPause,
  driverShortCode,
  type DeliveryDriver,
} from '@/lib/driversApi';
import { archiveAllActiveOrders } from '@/lib/ordersApi';
import { playKrring } from '@/lib/sounds';

const DRIVER_SESSION_KEY = 'papirun_driver_session';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return new Uint8Array([...raw].map(c => c.charCodeAt(0)));
}
import { updateOrderStatus, suggestOrderLocation, type OrderRecord, type OrderStatus } from '@/lib/ordersApi';
import OrderChat from '@/components/OrderChat';
import DriverLocationMap from '@/components/DriverLocationMap';
import DriverManual from '@/components/DriverManual';

// Error boundary — prevents a single order detail crash from whiting out the page
class OrderDetailBoundary extends Component<
  { children: React.ReactNode; resetKey: string | null },
  { crashed: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { crashed: false };
  }
  static getDerivedStateFromError() { return { crashed: true }; }
  componentDidUpdate(prev: any) {
    if (prev.resetKey !== this.props.resetKey) this.setState({ crashed: false });
  }
  render() {
    if (this.state.crashed) {
      return (
        <div className="mt-2 bg-card rounded-2xl border border-border/40 p-6 text-center text-sm text-muted-foreground">
          <p className="font-semibold mb-2 text-destructive">Gabim në ngarkimin e detajeve</p>
          <button
            type="button"
            onClick={() => this.setState({ crashed: false })}
            className="px-3 py-1.5 rounded-lg bg-secondary text-xs font-medium"
          >
            Provo përsëri
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- Row mapper ---
const mapOrderRow = (row: any): OrderRecord => ({
  id: row.id,
  userId: row.user_id,
  customerName: row.customer_name,
  customerPhone: row.customer_phone,
  deliveryAddress: row.delivery_address,
  deliveryLat: row.delivery_lat !== null ? Number(row.delivery_lat) : null,
  deliveryLng: row.delivery_lng !== null ? Number(row.delivery_lng) : null,
  locationId: row.location_id,
  items: Array.isArray(row.items) ? row.items : [],
  subtotal: Number(row.subtotal),
  deliveryFee: Number(row.delivery_fee),
  total: Number(row.total),
  status: row.status,
  adminNote: row.admin_note,
  notes: row.notes,
  statusHistory: Array.isArray(row.status_history) ? row.status_history : [],
  source: (row.source ?? 'web') as any,
  prepEtaMinutes: row.prep_eta_minutes,
  isVisible: row.is_visible !== false,
  assignedDriverId: row.assigned_driver_id ?? null,
  driverRating: row.driver_rating ?? null,
  suggestedLocation: suggestOrderLocation(row.delivery_lat ?? null, row.delivery_lng ?? null, row.delivery_address || ''),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const statusColor = (s: string) => {
  if (s === 'out_for_delivery') return 'bg-blue-500/15 text-blue-700 ring-1 ring-blue-500/30';
  if (s === 'preparing') return 'bg-amber-500/15 text-amber-700 ring-1 ring-amber-500/30';
  if (s === 'approved') return 'bg-emerald-500/15 text-emerald-700 ring-1 ring-emerald-500/30';
  if (s === 'completed') return 'bg-primary/10 text-primary ring-1 ring-primary/20';
  return 'bg-secondary text-muted-foreground';
};

const STATUS_LABEL: Record<string, string> = {
  approved: 'Konfirmuar',
  preparing: 'Përgatitet',
  out_for_delivery: 'Në rrugë',
  completed: 'Përfunduar',
};

function fmtHours(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function fmtElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

const DriverPanel = () => {
  const [driver, setDriver] = useState<DeliveryDriver | null>(null);
  // False only when a saved session exists and is still being verified against the DB.
  const [sessionChecked, setSessionChecked] = useState(() => !localStorage.getItem(DRIVER_SESSION_KEY));
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const prevOrderCountRef = useRef(0);
  const watchIdRef = useRef<number | null>(null);
  const gpsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wakeLockRef = useRef<any>(null);
  const driverRef = useRef<DeliveryDriver | null>(null);
  const assignTimesRef = useRef<Record<string, number>>({});
  const [tick, setTick] = useState(0);
  const driverAlarmFiredRef = useRef<Set<string>>(new Set());
  const [showManual, setShowManual] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [showPinChange, setShowPinChange] = useState(false);
  const [curPin, setCurPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinSaving, setPinSaving] = useState(false);
  const [isLg, setIsLg] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches
  );
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const handler = (e: MediaQueryListEvent) => setIsLg(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Pre-register SW on page load so push notifications can arrive even before login
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  useEffect(() => {
    seedDefaultDrivers().catch(console.error);
    const savedId = localStorage.getItem(DRIVER_SESSION_KEY);
    if (savedId) {
      fetchDriverById(savedId)
        .then((d) => {
          if (d && d.isActive) setDriver(d);
          else if (d === null) localStorage.removeItem(DRIVER_SESSION_KEY);
        })
        .catch(() => { /* network error — keep session, will restore on next load */ })
        .finally(() => setSessionChecked(true));
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const drivers = await fetchDrivers();
      const q = username.trim().toLowerCase();
      const found = drivers.find((d) => {
        const phone = d.phone.trim().toLowerCase();
        const uname = d.username.trim().toLowerCase();
        const fullName = d.name.trim().toLowerCase();
        const firstName = fullName.split(/\s+/)[0];
        return phone === q || uname === q || fullName === q || firstName === q;
      });
      if (found) {
        if (found.pin && found.pin !== password.trim()) {
          setError('Fjalëkalim i gabuar.');
          return;
        }
        setDriver(found);
        localStorage.setItem(DRIVER_SESSION_KEY, found.id);
      } else {
        setError('Username i gabuar.');
      }
    } catch {
      setError('Gabim në lidhje me bazën e të dhënave');
    }
  };

  const syncOrders = useCallback(async (driverId: string) => {
    try {
      const raw = await fetchDriverOrders(driverId);
      const mapped = (raw as any[]).map(mapOrderRow);
      setOrders(mapped);
      const active = mapped.filter((o) => !['completed', 'rejected', 'histori'].includes(o.status));
      const activeCount = active.length;
      if (activeCount > prevOrderCountRef.current && prevOrderCountRef.current >= 0) {
        playKrring();
      }
      prevOrderCountRef.current = activeCount;
      if (active.length > 0) {
        fetchOrderAssignTimes(active.map(o => o.id)).then(times => {
          assignTimesRef.current = { ...assignTimesRef.current, ...times };
        }).catch(() => {});
      }
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    if (!driver) return;
    let active = true;
    syncOrders(driver.id);
    const unsub = subscribeDriverOrdersRealtime(driver.id, () => {
      if (active) syncOrders(driver.id);
    });
    const poll = setInterval(() => { if (active) syncOrders(driver.id); }, 8000);
    return () => { active = false; unsub(); clearInterval(poll); };
  }, [driver, syncOrders]);

  // Midnight clean-slate: archive all active orders at 00:00
  useEffect(() => {
    if (!driver) return;
    const scheduleNextMidnight = () => {
      const now = new Date();
      const next = new Date(now);
      next.setHours(24, 0, 5, 0); // 00:00:05 to be safe
      const delay = next.getTime() - now.getTime();
      return setTimeout(async () => {
        try {
          await archiveAllActiveOrders();
          await syncOrders(driver.id);
          toast.success('Pasditja e mesnatës: porositë u arkivuan');
        } catch {}
        scheduleNextMidnight();
      }, delay);
    };
    const t = scheduleNextMidnight();
    return () => clearTimeout(t);
  }, [driver, syncOrders]);

  useEffect(() => { driverRef.current = driver; }, [driver]);

  useEffect(() => {
    if (!driver) return;
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, [driver]);

  // 1-minute alarm: kling when driver hasn't acted on an approved order for >60s
  useEffect(() => {
    if (!driver) return;
    const ALARM_MS = 60_000;
    const unaccepted = orders.filter(
      (o) => o.status === 'approved' && assignTimesRef.current[o.id] && Date.now() - assignTimesRef.current[o.id] > ALARM_MS
    );
    for (const o of unaccepted) {
      if (!driverAlarmFiredRef.current.has(o.id)) {
        driverAlarmFiredRef.current.add(o.id);
        playKrring();
      }
    }
    for (const id of Array.from(driverAlarmFiredRef.current)) {
      const o = orders.find((x) => x.id === id);
      if (!o || o.status !== 'approved') driverAlarmFiredRef.current.delete(id);
    }
  }, [driver, orders, tick]);

  useEffect(() => {
    if (!driver || !('serviceWorker' in navigator) || !('PushManager' in window)) return;
    const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
    if (!vapidKey) return;
    navigator.serviceWorker.register('/sw.js').then(async (reg) => {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey) as unknown as BufferSource,
        });
      }
      await saveDriverPushSub(driver.id, sub.toJSON());
    }).catch(() => {});
  }, [driver?.id]);

  // Realtime: sync pause state when admin approves/rejects
  useEffect(() => {
    if (!driver) return;
    const prevPending = driver.isPendingPause;
    const unsub = subscribeDriverPauseState(driver.id, async () => {
      try {
        const updated = await fetchDriverById(driver.id);
        if (!updated) return;
        setDriver(updated);
        // Toast when admin transitions from pendingPause → paused
        if (prevPending && updated.isPaused && !updated.isPendingPause) {
          toast.success('Admini aprovoi pauzën tënde ✓');
        } else if (prevPending && !updated.isPaused && !updated.isPendingPause) {
          toast('Kërkesa për pauzë u refuzua');
        }
      } catch {}
    });
    return unsub;
  }, [driver?.id, driver?.isPendingPause]);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (gpsIntervalRef.current !== null) {
      clearInterval(gpsIntervalRef.current);
      gpsIntervalRef.current = null;
    }
    setIsTracking(false);
  }, []);

  const startTracking = useCallback(() => {
    if (!navigator.geolocation || watchIdRef.current !== null) return;
    let lastWriteAt = 0;

    const savePos = async (lat: number, lng: number) => {
      const d = driverRef.current;
      if (!d) return;
      const now = Date.now();
      if (now - lastWriteAt < 4_800) return;
      lastWriteAt = now;
      try {
        await updateDriverLocation(d.id, lat, lng);
        const updated = await fetchDriverById(d.id);
        if (updated) setDriver(updated);
      } catch {}
    };

    const id = navigator.geolocation.watchPosition(
      (pos) => { savePos(pos.coords.latitude, pos.coords.longitude); },
      (err) => { if (err.code !== 3) toast.error('GPS: ' + err.message); },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
    watchIdRef.current = id;

    // Forced backup: getCurrentPosition every 5 s in case watchPosition stalls on mobile
    gpsIntervalRef.current = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (pos) => { savePos(pos.coords.latitude, pos.coords.longitude); },
        () => {},
        { enableHighAccuracy: true, timeout: 4000, maximumAge: 0 }
      );
    }, 5000);

    setIsTracking(true);
  }, []);

  useEffect(() => {
    if (!driver) return;
    startTracking();
    return stopTracking;
  }, [driver?.id, startTracking, stopTracking]);

  // Keep screen awake + ensure GPS is running while driver has an active delivery.
  // WakeLock prevents screen dimming; auto-restart GPS if driver accidentally stopped it.
  useEffect(() => {
    if (!driver) return;
    const hasDelivery = orders.some((o) => o.status === 'out_for_delivery');

    if (!hasDelivery) {
      if ('wakeLock' in navigator) {
        wakeLockRef.current?.release().catch(() => {});
        wakeLockRef.current = null;
      }
      return;
    }

    // Auto-restart GPS if it was somehow stopped during a delivery
    if (!isTracking) startTracking();

    if (!('wakeLock' in navigator)) return;
    const acquire = async () => {
      if (!wakeLockRef.current || (wakeLockRef.current as any).released) {
        try { wakeLockRef.current = await (navigator as any).wakeLock.request('screen'); } catch {}
      }
    };
    acquire();
    document.addEventListener('visibilitychange', acquire);
    return () => document.removeEventListener('visibilitychange', acquire);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driver?.id, orders, isTracking]);

  // Optimistic status update — no refresh required
  const handleStatus = async (id: string, status: OrderStatus) => {
    setOrders((prev) => prev.map((o) => o.id === id ? { ...o, status } : o));
    if (status === 'completed') setSelectedId(null);
    if (status === 'out_for_delivery') {
      const assignedAt = assignTimesRef.current[id];
      if (assignedAt) {
        toast.success(`Pranuat pas ${fmtElapsed(Date.now() - assignedAt)}`);
      }
    }
    try {
      await updateOrderStatus(id, status);
      if (status !== 'out_for_delivery') toast.success(STATUS_LABEL[status] ?? status);
    } catch {
      toast.error('Gabim');
      if (driver) syncOrders(driver.id);
    }
  };

  // Pause handlers
  const handlePauseDirect = async () => {
    if (!driver) return;
    const now = Date.now();
    setDriver((d) => d ? { ...d, isPaused: true, isPendingPause: false, pausedAt: now } : d);
    try { await setDriverPause(driver.id, true); toast.success('Je në pauzë'); }
    catch { setDriver((d) => d ? { ...d, isPaused: false } : d); toast.error('Gabim'); }
  };

  const handleRequestPause = async () => {
    if (!driver) return;
    setDriver((d) => d ? { ...d, isPendingPause: true } : d);
    try { await requestDriverPause(driver.id); toast.success('Kërkesa për pauzë u dërgua'); }
    catch { setDriver((d) => d ? { ...d, isPendingPause: false } : d); toast.error('Gabim'); }
  };

  const handleUnpause = async () => {
    if (!driver) return;
    const now = Date.now();
    setDriver((d) => d ? { ...d, isPaused: false, isPendingPause: false, pausedAt: null, availableSince: now } : d);
    try { await setDriverPause(driver.id, false); toast.success('Je i disponueshëm'); }
    catch { setDriver((d) => d ? { ...d, isPaused: true } : d); toast.error('Gabim'); }
  };

  const handlePinChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError('');
    if (!driver) return;
    if (curPin !== driver.pin) { setPinError('PIN aktual i gabuar.'); return; }
    if (newPin.length < 3) { setPinError('PIN i ri duhet të ketë të paktën 3 karaktere.'); return; }
    if (newPin !== confirmPin) { setPinError('PINs nuk përputhen.'); return; }
    setPinSaving(true);
    try {
      await updateDriver(driver.id, { pin: newPin });
      setDriver((d) => d ? { ...d, pin: newPin } : d);
      setShowPinChange(false);
      setCurPin(''); setNewPin(''); setConfirmPin('');
      toast.success('Fjalëkalimi u ndryshua');
    } catch { setPinError('Gabim gjatë ndryshimit.'); }
    finally { setPinSaving(false); }
  };

  const activeOrders = orders.filter((o) => !['completed', 'rejected', 'histori'].includes(o.status) && o.isVisible !== false);
  const completedOrders = orders.filter((o) => o.status === 'completed');
  const selected = orders.find((o) => o.id === selectedId) ?? null;

  // Stats
  const productiveMs = completedOrders.reduce((sum, o) => {
    const ms = new Date(o.updatedAt).getTime() - new Date(o.createdAt).getTime();
    return sum + (ms > 0 ? ms : 0);
  }, 0);

  // Verifying saved session — don't flash the login form
  if (!sessionChecked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Bike className="w-8 h-8 text-blue-500 animate-pulse" />
          <p className="text-sm">Duke u kyçur...</p>
        </div>
      </div>
    );
  }

  // Login screen
  if (!driver) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center mx-auto mb-4">
              <Bike className="w-8 h-8 text-blue-600" />
            </div>
            <h1 className="font-display font-bold text-2xl">Driver Panel</h1>
            <p className="text-sm text-muted-foreground mt-1">Papirun Delivery</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1.5">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="driver1"
                className="w-full px-4 py-3 rounded-xl bg-secondary border-0 text-sm focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5">Fjalëkalimi</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
                className="w-full px-4 py-3 rounded-xl bg-secondary border-0 text-sm focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
            </div>
            {error && <p className="text-destructive text-xs">{error}</p>}
            <button type="submit" className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition-colors">
              Hyr
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {showManual && <DriverManual driverName={driver.name} onClose={() => setShowManual(false)} />}

      {/* PIN change modal */}
      {showPinChange && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" onClick={() => { setShowPinChange(false); setCurPin(''); setNewPin(''); setConfirmPin(''); setPinError(''); }} />
          <div className="relative w-full max-w-xs bg-background rounded-2xl shadow-2xl border border-border/40 p-6 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Lock className="w-4 h-4 text-blue-500" />
              <h2 className="font-bold text-base">Ndrysho Fjalëkalimin</h2>
            </div>
            <form onSubmit={handlePinChange} className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1">PIN aktual</label>
                <input type="password" value={curPin} onChange={(e) => setCurPin(e.target.value)} placeholder="••••" className="w-full px-3 py-2.5 rounded-xl bg-secondary text-sm border-0 focus:ring-2 focus:ring-blue-500/20" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">PIN i ri</label>
                <input type="password" value={newPin} onChange={(e) => setNewPin(e.target.value)} placeholder="••••" className="w-full px-3 py-2.5 rounded-xl bg-secondary text-sm border-0 focus:ring-2 focus:ring-blue-500/20" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Konfirmo PIN-in e ri</label>
                <input type="password" value={confirmPin} onChange={(e) => setConfirmPin(e.target.value)} placeholder="••••" className="w-full px-3 py-2.5 rounded-xl bg-secondary text-sm border-0 focus:ring-2 focus:ring-blue-500/20" />
              </div>
              {pinError && <p className="text-destructive text-xs">{pinError}</p>}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => { setShowPinChange(false); setCurPin(''); setNewPin(''); setConfirmPin(''); setPinError(''); }} className="flex-1 py-2.5 rounded-xl bg-secondary text-sm font-semibold">Anulo</button>
                <button type="submit" disabled={pinSaving} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold disabled:opacity-50">
                  {pinSaving ? 'Duke ruajtur…' : 'Ruaj'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-lg border-b border-border/50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-sm" style={{ background: driver.color || '#3b82f6' }}>
              {driverShortCode(driver)}
            </div>
            <div>
              <h1 className="font-display font-bold text-base leading-tight">{driver.name}</h1>
              <p className="text-[10px] text-muted-foreground">{driver.lat != null ? '📍 GPS aktiv' : 'GPS joaktiv'}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {(driver.isPaused || driver.isPendingPause) ? (
              <button onClick={handleUnpause} className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25 transition-colors">
                <Coffee className="w-3.5 h-3.5" />{driver.isPendingPause ? 'Duke pritur…' : 'Disponueshëm'}
              </button>
            ) : (
              <>
                <button onClick={handleRequestPause} className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 transition-colors" title="Kërko aprovim">
                  <Coffee className="w-3.5 h-3.5" /> Pauzë
                </button>
                <button onClick={handlePauseDirect} className="px-3 py-2 rounded-full text-xs font-semibold bg-secondary text-muted-foreground hover:bg-secondary/80 transition-colors" title="Pa aprovim">
                  Pa aprovim
                </button>
              </>
            )}
            {(() => {
              const delivering = orders.some((o) => o.status === 'out_for_delivery');
              return (
                <button
                  onClick={() => !delivering && (isTracking ? stopTracking() : startTracking())}
                  disabled={delivering}
                  title={delivering ? 'GPS i bllokuar gjatë dërgesës' : undefined}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold transition-colors ${delivering ? 'bg-emerald-500 text-white cursor-not-allowed opacity-90' : isTracking ? 'bg-emerald-500 text-white' : 'bg-emerald-500/10 text-emerald-600'}`}
                >
                  <Navigation className={`w-3.5 h-3.5 ${isTracking ? 'animate-pulse' : ''}`} />
                  {isTracking ? 'GPS Live' : 'GPS'}
                  {delivering && <span className="text-[9px] opacity-75 ml-0.5">🔒</span>}
                </button>
              );
            })()}
            <button onClick={() => setShowManual(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-secondary text-sm font-medium" title="Manual">
              <BookOpen className="w-4 h-4" />
            </button>
            <button onClick={() => setShowPinChange(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-secondary text-sm font-medium" title="Ndrysho fjalëkalimin">
              <Lock className="w-4 h-4" />
            </button>
            <button onClick={() => { setDriver(null); localStorage.removeItem(DRIVER_SESSION_KEY); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-secondary text-sm font-medium">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-4 space-y-4">

        {/* ── Stats bar ── */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card rounded-2xl p-3 text-center border border-border/40 shadow-sm">
            <div className="text-2xl font-bold text-blue-600">{activeOrders.length}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5 flex items-center justify-center gap-1">
              <Package className="w-2.5 h-2.5" /> Aktive
            </div>
          </div>
          <div className="bg-card rounded-2xl p-3 text-center border border-border/40 shadow-sm">
            <div className="text-2xl font-bold text-emerald-600">{completedOrders.length}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5 flex items-center justify-center gap-1">
              <CheckCheck className="w-2.5 h-2.5" /> Sot
            </div>
          </div>
          <div className="bg-card rounded-2xl p-3 text-center border border-border/40 shadow-sm">
            <div className="text-lg font-bold text-primary leading-tight mt-0.5">
              {productiveMs > 0 ? fmtHours(productiveMs) : '—'}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5 flex items-center justify-center gap-1">
              <TrendingUp className="w-2.5 h-2.5" /> Produktive
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-4">
          {/* 1-min unaccepted banner */}
          {(() => {
            const ALARM_MS = 60_000;
            const unaccepted = activeOrders.filter(
              (o) => o.status === 'approved' && assignTimesRef.current[o.id] && Date.now() - assignTimesRef.current[o.id] > ALARM_MS
            );
            if (unaccepted.length === 0) return null;
            return (
              <div className="rounded-2xl bg-red-500/15 border-2 border-red-500/50 p-4 animate-pulse">
                <div className="flex items-center gap-2 text-red-600 font-bold text-sm mb-2">
                  <Clock className="w-4 h-4 shrink-0" />
                  Provo të pranosh porosinë — ka kaluar 1 minutë!
                </div>
                {unaccepted.map((o) => (
                  <button
                    key={o.id}
                    onClick={() => setSelectedId(o.id)}
                    className="w-full text-left bg-background/70 rounded-xl px-3 py-2 text-xs font-semibold text-red-700 hover:bg-background transition-colors"
                  >
                    {o.customerName} · €{o.total.toFixed(2)}
                  </button>
                ))}
              </div>
            );
          })()}

          {/* Active orders list */}
          <div className="space-y-3">
            <h2 className="font-display font-bold text-base flex items-center gap-2">
              <Package className="w-4 h-4 text-blue-600" />
              Porositë Aktive
              {activeOrders.length > 0 && (
                <span className="text-xs font-bold bg-blue-500 text-white px-2 py-0.5 rounded-full">{activeOrders.length}</span>
              )}
            </h2>

            {activeOrders.length === 0 && (
              <div className="bg-card rounded-2xl p-8 text-center text-sm text-muted-foreground shadow-card">
                <Bike className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
                Asnjë porosi aktive. Prit derisa admini të caktojë porosi.
              </div>
            )}

            {activeOrders.map((o) => (
              <React.Fragment key={o.id}>
                <button
                  onClick={() => setSelectedId(o.id === selectedId ? null : o.id)}
                  className={`w-full text-left bg-card rounded-2xl p-4 shadow-card transition-all hover:shadow-md ${
                    selectedId === o.id ? 'ring-2 ring-blue-500' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-sm truncate">{o.customerName || 'Anonim'}</h3>
                      <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3" /> {o.customerPhone}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3" /> {o.deliveryAddress}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={`text-[10px] px-2 py-1 rounded-full font-medium whitespace-nowrap ${statusColor(o.status)}`}>
                        {STATUS_LABEL[o.status] ?? o.status}
                      </span>
                      {assignTimesRef.current[o.id] && tick >= 0 && (
                        <span className="text-[10px] text-amber-600 font-medium flex items-center gap-0.5">
                          <Timer className="w-3 h-3" />
                          {fmtElapsed(Date.now() - assignTimesRef.current[o.id])}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/40">
                    <span className="text-xs text-muted-foreground">{o.items.length} artikuj</span>
                    <span className="text-primary font-semibold text-sm">€{o.total.toFixed(2)}</span>
                  </div>
                </button>

                {/* Mobile inline detail — shown right under the clicked order on small screens */}
                {!isLg && selectedId === o.id && selected && (
                  <OrderDetailBoundary resetKey={selectedId}>
                    <div className="mt-2 bg-card rounded-2xl shadow-card overflow-hidden border border-border/40">
                      <div className="p-3 border-b border-border/50 flex items-center justify-between">
                        <div>
                          <h3 className="font-bold text-sm">{selected.customerName}</h3>
                          <a href={`tel:${selected.customerPhone}`} className="text-xs text-blue-600 font-medium">{selected.customerPhone}</a>
                        </div>
                        <button type="button" onClick={() => setSelectedId(null)} className="p-1.5 rounded-full hover:bg-secondary">
                          <CheckCheck className="w-4 h-4 text-muted-foreground" />
                        </button>
                      </div>
                      <div className="p-3 space-y-3 text-xs">
                        <div className="grid grid-cols-2 gap-2">
                          <a href={`tel:${selected.customerPhone}`} className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-500/10 text-blue-600 font-semibold active:scale-95 transition-all">
                            <Phone className="w-4 h-4" /> Thirr
                          </a>
                          {selected.deliveryLat !== null && selected.deliveryLng !== null && (
                            <a href={`https://www.google.com/maps/dir/?api=1&destination=${selected.deliveryLat},${selected.deliveryLng}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 font-semibold active:scale-95 transition-all">
                              <MapPin className="w-4 h-4" /> Navigo
                            </a>
                          )}
                        </div>
                        <div className="bg-secondary/40 rounded-xl p-3 space-y-1">
                          {selected.items.map((it: any, i) => (
                            <div key={i} className="text-sm">• {it.quantity}x {it.name?.sq || it.name?.en || it.id}</div>
                          ))}
                          <div className="flex justify-between items-baseline font-bold pt-2 border-t border-border/50 mt-2">
                            <span>Totali</span>
                            <span className="text-primary text-sm">€{selected.total.toFixed(2)}</span>
                          </div>
                        </div>
                        <div className="flex items-start gap-2 text-muted-foreground"><MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" /><p className="leading-snug">{selected.deliveryAddress}</p></div>
                        {selected.notes && (
                          <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-300/50 rounded-xl px-3 py-2">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-0.5">Shënim</p>
                            <p className="italic text-foreground/90">{selected.notes}</p>
                          </div>
                        )}
                        {(selected.status === 'approved' || selected.status === 'preparing') && (
                          <button type="button" onClick={() => handleStatus(selected.id, 'out_for_delivery')} className="w-full py-3 rounded-xl bg-blue-600 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all">
                            <Bike className="w-5 h-5" /> Nise Dërgesën
                          </button>
                        )}
                        {selected.status === 'out_for_delivery' && (
                          <button type="button" onClick={() => handleStatus(selected.id, 'completed')} className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all">
                            <CheckCheck className="w-5 h-5" /> Përfundo Dërgesën
                          </button>
                        )}
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-2 flex items-center gap-1"><MessageCircle className="w-3 h-3" /> Chat</p>
                          <OrderChat orderId={selected.id} viewerSide="driver" disabled={selected.status === 'completed' || selected.status === 'rejected'} maxHeightClass="max-h-60" allowDelete={selected.status === 'completed'} />
                        </div>
                      </div>
                    </div>
                  </OrderDetailBoundary>
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Completed orders today — collapsible */}
          {completedOrders.length > 0 && (
            <div className="space-y-2">
              <button
                onClick={() => setShowCompleted((v) => !v)}
                className="w-full flex items-center justify-between px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Përfunduar sot
                  <span className="bg-emerald-500/15 text-emerald-600 px-1.5 py-0.5 rounded-full font-bold">{completedOrders.length}</span>
                </span>
                <span className="text-muted-foreground/60">{showCompleted ? '▲' : '▼'}</span>
              </button>
              {showCompleted && completedOrders.map((o) => (
                <React.Fragment key={o.id}>
                  <button
                    onClick={() => setSelectedId(o.id === selectedId ? null : o.id)}
                    className={`w-full text-left bg-card/60 rounded-2xl p-3 shadow-sm border border-border/30 transition-all hover:shadow-md ${selectedId === o.id ? 'ring-2 ring-emerald-500' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-sm truncate text-muted-foreground">{o.customerName || 'Anonim'}</h3>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{o.deliveryAddress}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="text-[10px] px-2 py-1 rounded-full font-medium bg-emerald-500/15 text-emerald-600">Përfunduar</span>
                        <span className="text-primary font-semibold text-xs">€{o.total.toFixed(2)}</span>
                      </div>
                    </div>
                  </button>
                  {!isLg && selectedId === o.id && (
                    <div className="mt-2 bg-card/80 rounded-2xl border border-border/30 overflow-hidden">
                      <div className="p-3 space-y-2 text-xs">
                        <div className="bg-secondary/40 rounded-xl p-3 space-y-1">
                          {o.items.map((it: any, i) => (
                            <div key={i} className="text-sm">• {it.quantity}x {it.name?.sq || it.name?.en || it.id}</div>
                          ))}
                          <div className="flex justify-between font-bold pt-2 border-t border-border/50 mt-2">
                            <span>Totali</span><span className="text-primary">€{o.total.toFixed(2)}</span>
                          </div>
                        </div>
                        <OrderChat orderId={o.id} viewerSide="driver" disabled maxHeightClass="max-h-52" allowDelete />
                      </div>
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>
          )}

          {/* Detail panel — desktop sidebar only; mobile version is rendered inline in active orders list */}
          <div className="hidden lg:block lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100vh-100px)] lg:overflow-y-auto">
            {!selected ? (
              <div className="bg-card rounded-2xl p-6 text-center text-sm text-muted-foreground shadow-card">
                Zgjidh një porosi për detaje dhe chat.
              </div>
            ) : (
              <OrderDetailBoundary resetKey={selectedId}>
                <div className="bg-card rounded-2xl shadow-card overflow-hidden border border-border/40">
                <div className="p-4 border-b border-border/50">
                  <h3 className="font-bold text-base">{selected.customerName}</h3>
                  <a href={`tel:${selected.customerPhone}`} className="text-xs text-blue-600 font-medium flex items-center gap-1 mt-1">
                    <Phone className="w-3 h-3" /> {selected.customerPhone}
                  </a>
                </div>

                <div className="p-4 space-y-4 text-xs">
                  {/* Quick actions */}
                  <div className="grid grid-cols-2 gap-2">
                    <a href={`tel:${selected.customerPhone}`}
                      className="flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-500/10 text-blue-600 font-semibold active:scale-95 transition-all">
                      <Phone className="w-4 h-4" /> Thirr
                    </a>
                    {selected.deliveryLat !== null && selected.deliveryLng !== null && (
                      <a href={`https://www.google.com/maps/dir/?api=1&destination=${selected.deliveryLat},${selected.deliveryLng}`}
                        target="_blank" rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500/10 text-emerald-600 font-semibold active:scale-95 transition-all">
                        <MapPin className="w-4 h-4" /> Navigo
                      </a>
                    )}
                  </div>

                  {/* Order items */}
                  <div className="bg-secondary/40 rounded-xl p-3 space-y-1">
                    {selected.items.map((it: any, i) => (
                      <div key={i} className="text-sm">• {it.quantity}x {it.name?.sq || it.name?.en || it.id}</div>
                    ))}
                    <div className="flex justify-between items-baseline font-bold pt-2 border-t border-border/50 mt-2">
                      <span>Totali</span>
                      <span className="text-primary text-base">€{selected.total.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Address */}
                  <div className="flex items-start gap-2 text-muted-foreground">
                    <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <p className="leading-snug">{selected.deliveryAddress}</p>
                  </div>

                  {selected.prepEtaMinutes && (
                    <div className="flex items-center gap-1.5 text-xs text-blue-600 bg-blue-500/5 rounded-lg px-2.5 py-1.5">
                      <Clock className="w-3.5 h-3.5" /> Gati për ~{selected.prepEtaMinutes} min
                    </div>
                  )}

                  {selected.notes && (
                    <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-300/50 rounded-xl px-3 py-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-0.5">Shënim klienti</p>
                      <p className="italic text-foreground/90">{selected.notes}</p>
                    </div>
                  )}

                  {/* Status actions */}
                  {(selected.status === 'approved' || selected.status === 'preparing') && (
                    <button onClick={() => handleStatus(selected.id, 'out_for_delivery')}
                      className="w-full py-3.5 rounded-xl bg-blue-600 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all">
                      <Bike className="w-5 h-5" /> Nise Dërgesën
                    </button>
                  )}
                  {selected.status === 'out_for_delivery' && (
                    <button onClick={() => handleStatus(selected.id, 'completed')}
                      className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all">
                      <CheckCheck className="w-5 h-5" /> Përfundo Dërgesën
                    </button>
                  )}
                  {['approved', 'preparing', 'out_for_delivery'].includes(selected.status) && (
                    <button onClick={() => handleStatus(selected.id, 'completed')}
                      className="w-full py-2.5 rounded-xl bg-secondary text-foreground text-sm font-semibold flex items-center justify-center gap-2 hover:bg-secondary/80 active:scale-95 transition-all">
                      <CheckCheck className="w-4 h-4" /> Mbaro bisedën · Përfundo
                    </button>
                  )}

                  {/* Chat */}
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-2 flex items-center gap-1">
                      <MessageCircle className="w-3 h-3" /> Chat me klientin
                    </p>
                    <OrderChat
                      orderId={selected.id}
                      viewerSide="driver"
                      disabled={selected.status === 'completed' || selected.status === 'rejected'}
                      maxHeightClass="max-h-72"
                      allowDelete={selected.status === 'completed'}
                    />
                  </div>
                </div>
                </div>
              </OrderDetailBoundary>
            )}
          </div>
        </div>

        {/* Map at bottom */}
        <div className="pt-2">
          <h3 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-2 px-1">Vendndodhja jote</h3>
          <DriverLocationMap
            drivers={[driver]}
            deliveryLat={selected?.deliveryLat}
            deliveryLng={selected?.deliveryLng}
            height="240px"
            allowFullscreen
          />
        </div>
      </div>
    </div>
  );
};

export default DriverPanel;
