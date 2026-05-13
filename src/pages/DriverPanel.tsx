import { useEffect, useRef, useState, useCallback } from 'react';
import { Bike, Phone, MapPin, Clock, MessageCircle, LogOut, Package, CheckCheck, Navigation, Coffee } from 'lucide-react';
import { toast } from 'sonner';
import {
  fetchDrivers,
  fetchDriverById,
  fetchDriverOrders,
  seedDefaultDrivers,
  subscribeDriverOrdersRealtime,
  updateDriverLocation,
  setDriverPause,
  requestDriverPause,
  type DeliveryDriver,
} from '@/lib/driversApi';
import { playKrring } from '@/lib/sounds';

const DRIVER_SESSION_KEY = 'papirun_driver_session';
import { updateOrderStatus, type OrderRecord, type OrderStatus } from '@/lib/ordersApi';
import OrderChat from '@/components/OrderChat';
import DriverLocationMap from '@/components/DriverLocationMap';

// --- Row mapper (duplicated from ordersApi to avoid circular) ---
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

const DriverPanel = () => {
  const [driver, setDriver] = useState<DeliveryDriver | null>(null);
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const prevOrderCountRef = useRef(0);
  const watchIdRef = useRef<number | null>(null);
  const driverRef = useRef<DeliveryDriver | null>(null);

  useEffect(() => {
    seedDefaultDrivers().catch(console.error);
    const savedId = localStorage.getItem(DRIVER_SESSION_KEY);
    if (savedId) {
      fetchDriverById(savedId)
        .then((d) => {
          if (d && d.isActive) setDriver(d);
          else localStorage.removeItem(DRIVER_SESSION_KEY);
        })
        .catch(() => localStorage.removeItem(DRIVER_SESSION_KEY));
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const drivers = await fetchDrivers();
      const found = drivers.find(
        (d) => d.phone.toLowerCase() === username.trim().toLowerCase() && d.isActive
      );
      if (found) {
        setDriver(found);
        localStorage.setItem(DRIVER_SESSION_KEY, found.id);
      } else {
        setError('Username i gabuar. Provo: driver1, driver2...');
      }
    } catch {
      setError('Gabim në lidhje me bazën e të dhënave');
    }
  };

  useEffect(() => {
    if (!driver) return;
    let active = true;
    const sync = async () => {
      try {
        const raw = await fetchDriverOrders(driver.id);
        if (!active) return;
        const mapped = (raw as any[]).map(mapOrderRow);
        setOrders(mapped);

        const activeCount = mapped.filter((o) => !['completed', 'rejected'].includes(o.status)).length;
        if (activeCount > prevOrderCountRef.current && prevOrderCountRef.current >= 0) {
          playKrring();
        }
        prevOrderCountRef.current = activeCount;
      } catch (e) {
        console.error(e);
      }
    };
    sync();
    // Realtime handles live updates — no polling needed
    const unsub = subscribeDriverOrdersRealtime(driver.id, sync);
    return () => { active = false; unsub(); };
  }, [driver]);

  // Keep driverRef in sync so watchPosition callbacks always see the latest driver
  useEffect(() => { driverRef.current = driver; }, [driver]);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsTracking(false);
  }, []);

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error('Geolokacioni nuk suportohet nga ky browser');
      return;
    }
    if (watchIdRef.current !== null) return;

    // Throttle location writes to Supabase — at most once every 30 seconds
    let lastWriteAt = 0;

    const id = navigator.geolocation.watchPosition(
      async (pos) => {
        const d = driverRef.current;
        if (!d) return;
        const now = Date.now();
        if (now - lastWriteAt < 30_000) return; // skip if < 30s since last write
        lastWriteAt = now;
        try {
          await updateDriverLocation(d.id, pos.coords.latitude, pos.coords.longitude);
          const updated = await fetchDriverById(d.id);
          if (updated) setDriver(updated);
        } catch {
          // silent — retries on next tick after 30s
        }
      },
      (err) => {
        if (err.code !== 3) toast.error('GPS: ' + err.message);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
    watchIdRef.current = id;
    setIsTracking(true);
  }, []);

  // Auto-start live GPS tracking the moment a driver logs in
  useEffect(() => {
    if (!driver) return;
    startTracking();
    return stopTracking;
  }, [driver?.id, startTracking, stopTracking]);

  const selected = orders.find((o) => o.id === selectedId) ?? null;

  const handleStatus = async (id: string, status: OrderStatus) => {
    try {
      await updateOrderStatus(id, status);
      toast.success(STATUS_LABEL[status] ?? status);
    } catch {
      toast.error('Gabim');
    }
  };

  // Pause without admin approval — instant
  const handlePauseDirect = async () => {
    if (!driver) return;
    const now = Date.now();
    setDriver((d) => d ? { ...d, isPaused: true, isPendingPause: false, pausedAt: now } : d);
    try {
      await setDriverPause(driver.id, true);
      toast.success('Je në pauzë');
    } catch {
      setDriver((d) => d ? { ...d, isPaused: false } : d);
      toast.error('Gabim');
    }
  };

  // Request pause — needs admin approval
  const handleRequestPause = async () => {
    if (!driver) return;
    setDriver((d) => d ? { ...d, isPendingPause: true } : d);
    try {
      await requestDriverPause(driver.id);
      toast.success('Kërkesa për pauzë u dërgua tek admini');
    } catch {
      setDriver((d) => d ? { ...d, isPendingPause: false } : d);
      toast.error('Gabim');
    }
  };

  // Unpause — become available again
  const handleUnpause = async () => {
    if (!driver) return;
    const now = Date.now();
    setDriver((d) => d ? { ...d, isPaused: false, isPendingPause: false, pausedAt: null, availableSince: now } : d);
    try {
      await setDriverPause(driver.id, false);
      toast.success('Je i disponueshëm');
    } catch {
      setDriver((d) => d ? { ...d, isPaused: true } : d);
      toast.error('Gabim');
    }
  };

  const activeOrders = orders.filter((o) => !['completed', 'rejected'].includes(o.status) && o.isVisible);
  const completedOrders = orders.filter((o) => o.status === 'completed');

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
              <label className="block text-xs font-medium mb-1.5">Username (p.sh. driver1)</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="driver1"
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
      {/* Driver header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-lg border-b border-border/50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-sm"
              style={{ background: driver.color || '#3b82f6' }}
            >
              {driver.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h1 className="font-display font-bold text-lg">{driver.name}</h1>
              <p className="text-xs text-muted-foreground">
                Driver · {driver.lat != null ? '📍 Online' : 'Vendndodhja joaktive'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(driver.isPaused || driver.isPendingPause) ? (
              <button
                onClick={handleUnpause}
                className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25 transition-colors"
              >
                <Coffee className="w-3.5 h-3.5" />
                {driver.isPendingPause ? 'Kërkon pauzë…' : 'Disponueshëm'}
              </button>
            ) : (
              <>
                <button
                  onClick={handleRequestPause}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 transition-colors"
                  title="Kërko aprovim nga admini"
                >
                  <Coffee className="w-3.5 h-3.5" /> Pauzë
                </button>
                <button
                  onClick={handlePauseDirect}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold bg-secondary text-muted-foreground hover:bg-secondary/80 transition-colors"
                  title="Pa aprovim të adminit"
                >
                  Pa aprovim
                </button>
              </>
            )}
            <button
              onClick={() => isTracking ? stopTracking() : startTracking()}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold transition-colors ${
                isTracking
                  ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                  : 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20'
              }`}
            >
              <Navigation className={`w-3.5 h-3.5 ${isTracking ? 'animate-pulse' : ''}`} />
              {isTracking ? '● GPS Live' : 'Aktivizo GPS'}
            </button>
            <button
              onClick={() => { setDriver(null); localStorage.removeItem(DRIVER_SESSION_KEY); }}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-secondary hover:bg-secondary/80 transition-colors text-sm"
            >
              <LogOut className="w-4 h-4" /> Dil
            </button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 space-y-4">
        {/* Driver location map — always visible */}
        <DriverLocationMap
          drivers={[driver]}
          deliveryLat={selected?.deliveryLat}
          deliveryLng={selected?.deliveryLng}
          height="280px"
          allowFullscreen
        />

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-4">
          {/* Orders list */}
          <div className="space-y-3">
            <h2 className="font-display font-bold text-lg flex items-center gap-2">
              <Package className="w-5 h-5 text-blue-600" />
              Porositë e Mia ({activeOrders.length})
            </h2>

            {activeOrders.length === 0 && (
              <div className="bg-card rounded-2xl p-8 text-center text-sm text-muted-foreground shadow-card">
                <Bike className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
                Asnjë porosi aktive. Prit derisa admini të caktojë porosi.
              </div>
            )}

            {activeOrders.map((o) => (
              <button
                key={o.id}
                onClick={() => setSelectedId(o.id)}
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
                  <span className={`text-[10px] px-2 py-1 rounded-full font-medium whitespace-nowrap ${statusColor(o.status)}`}>
                    {STATUS_LABEL[o.status] ?? o.status}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/40">
                  <span className="text-xs text-muted-foreground">{o.items.length} artikuj</span>
                  <span className="text-primary font-semibold text-sm">€{o.total.toFixed(2)}</span>
                </div>
              </button>
            ))}

            {completedOrders.length > 0 && (
              <>
                <h3 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mt-6 mb-2">
                  Të përfunduara ({completedOrders.length})
                </h3>
                {completedOrders.slice(0, 5).map((o) => (
                  <div
                    key={o.id}
                    className="bg-card/60 rounded-2xl p-3 text-xs text-muted-foreground flex items-center justify-between"
                  >
                    <span>{o.customerName} · €{o.total.toFixed(2)}</span>
                    <span className="text-[10px]">{new Date(o.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Detail panel */}
          <div className="lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100vh-100px)] lg:overflow-y-auto">
            {!selected && (
              <div className="bg-card rounded-2xl p-6 text-center text-sm text-muted-foreground shadow-card">
                Zgjidh një porosi për detaje dhe chat.
              </div>
            )}

            {selected && (
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
                    <a
                      href={`tel:${selected.customerPhone}`}
                      className="flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-500/10 text-blue-600 font-semibold active:scale-95 transition-all"
                    >
                      <Phone className="w-4 h-4" /> Thirr
                    </a>
                    {selected.deliveryLat !== null && selected.deliveryLng !== null && (
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${selected.deliveryLat},${selected.deliveryLng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500/10 text-emerald-600 font-semibold active:scale-95 transition-all"
                      >
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

                  {/* ETA */}
                  {selected.prepEtaMinutes && (
                    <div className="flex items-center gap-1.5 text-xs text-blue-600 bg-blue-500/5 rounded-lg px-2.5 py-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      Gati për ~{selected.prepEtaMinutes} min
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
                    <button
                      onClick={() => handleStatus(selected.id, 'out_for_delivery')}
                      className="w-full py-3.5 rounded-xl bg-blue-600 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"
                    >
                      <Bike className="w-5 h-5" /> Nise Dërgesën
                    </button>
                  )}

                  {selected.status === 'out_for_delivery' && (
                    <button
                      onClick={() => handleStatus(selected.id, 'completed')}
                      className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"
                    >
                      <CheckCheck className="w-5 h-5" /> Përfundo Dërgesën
                    </button>
                  )}

                  {['approved', 'preparing', 'out_for_delivery'].includes(selected.status) && (
                    <button
                      onClick={() => handleStatus(selected.id, 'completed')}
                      className="w-full py-2.5 rounded-xl bg-secondary text-foreground text-sm font-semibold flex items-center justify-center gap-2 hover:bg-secondary/80 active:scale-95 transition-all"
                    >
                      <CheckCheck className="w-4 h-4" /> Mbaro bisedën · Përfundo
                    </button>
                  )}

                  {/* Chat with customer */}
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DriverPanel;
