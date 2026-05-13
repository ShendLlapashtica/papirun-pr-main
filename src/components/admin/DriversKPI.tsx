import { useEffect, useState, useMemo, useCallback } from 'react';
import { fetchDrivers, setDriverPause, approvePause, driverShortCode, resetAllDriverTimers, type DeliveryDriver } from '@/lib/driversApi';
import { fetchAllOrders, hardDeleteAllOrders, type OrderRecord } from '@/lib/ordersApi';
import { Star, Zap, Clock, X, ChevronRight, Coffee, CheckCheck, TrendingUp, CheckCircle2, AlertCircle, Trash2, Loader2 } from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';

// ── helpers ────────────────────────────────────────────────────────────────────

function fmtDuration(ms: number): string {
  if (!isFinite(ms) || ms < 0) return '—';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}min ${sec}s`;
  return `${sec}s`;
}

function fmtTime(iso: string): string {
  try { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
  catch { return ''; }
}

function fmtDate(iso: string): string {
  try { return new Date(iso).toLocaleDateString([], { day: '2-digit', month: 'short' }); }
  catch { return ''; }
}

// ── algorithm ─────────────────────────────────────────────────────────────────

/** ms idle since last completed order; -1 if driver has active orders; Infinity if never worked */
export function driverIdleMs(driverId: string, orders: OrderRecord[], now = Date.now()): number {
  const hasActive = orders.some(
    (o) => o.assignedDriverId === driverId &&
      ['approved', 'preparing', 'out_for_delivery'].includes(o.status),
  );
  if (hasActive) return -1;

  const done = orders.filter((o) => o.assignedDriverId === driverId && o.status === 'completed');
  if (done.length === 0) return Infinity;

  const last = done.reduce((a, b) => new Date(b.updatedAt) > new Date(a.updatedAt) ? b : a);
  return now - new Date(last.updatedAt).getTime();
}

/**
 * Wait time for a driver — considers both order history and availableSince (from unpause).
 * Returns -1 if busy, otherwise ms waited.
 */
function driverWaitMs(driver: DeliveryDriver, orders: OrderRecord[], now = Date.now()): number {
  const idle = driverIdleMs(driver.id, orders, now);
  if (idle === -1) return -1;

  // availableSince is set when driver unpauses — use whichever is more recent
  if (driver.availableSince != null) {
    const sinceAvail = now - driver.availableSince;
    if (!isFinite(idle)) return sinceAvail;
    return Math.min(idle, sinceAvail);
  }
  return idle;
}

/** ECT: remaining minutes across all active orders for a driver */
function driverECT(driverId: string, orders: OrderRecord[], now = Date.now()): number {
  return orders
    .filter((o) => o.assignedDriverId === driverId && ['approved', 'preparing', 'out_for_delivery'].includes(o.status))
    .reduce((sum, o) => {
      const elapsed = (now - new Date(o.createdAt).getTime()) / 60_000;
      return sum + Math.max(0, (o.prepEtaMinutes ?? 20) - elapsed);
    }, 0);
}

/** Pick best driver: skip paused/pending drivers, prefer longest-idle, fallback lowest ECT */
export function pickBestDriver(drivers: DeliveryDriver[], orders: OrderRecord[]): string | null {
  const active = drivers.filter((d) => d.isActive && !d.isPaused && !d.isPendingPause);
  if (!active.length) return null;

  const now = Date.now();
  const withWait = active.map((d) => ({ id: d.id, waitMs: driverWaitMs(d, orders, now) }));
  const idle = withWait.filter((x) => x.waitMs >= 0);

  if (idle.length > 0) {
    return idle.reduce((best, x) => {
      if (!isFinite(best.waitMs)) return best;
      if (!isFinite(x.waitMs)) return x;
      return x.waitMs > best.waitMs ? x : best;
    }).id;
  }

  return active.reduce((best, d) =>
    driverECT(d.id, orders, now) < driverECT(best.id, orders, now) ? d : best,
  active[0]).id;
}

// ── Pie chart (SVG) ────────────────────────────────────────────────────────────

function PieChart({ happy, neutral, unhappy }: { happy: number; neutral: number; unhappy: number }) {
  const total = happy + neutral + unhappy;
  if (total === 0) return (
    <div className="w-20 h-20 rounded-full bg-secondary/50 flex items-center justify-center text-xs text-muted-foreground">—</div>
  );

  const slices = [
    { count: happy, color: '#22c55e' },
    { count: neutral, color: '#f59e0b' },
    { count: unhappy, color: '#ef4444' },
  ];

  let cumAngle = -Math.PI / 2;
  const cx = 40, cy = 40, r = 36;

  const paths = slices.map(({ count, color }) => {
    if (count === 0) return null;
    const angle = (count / total) * 2 * Math.PI;
    const x1 = cx + r * Math.cos(cumAngle);
    const y1 = cy + r * Math.sin(cumAngle);
    cumAngle += angle;
    const x2 = cx + r * Math.cos(cumAngle);
    const y2 = cy + r * Math.sin(cumAngle);
    const largeArc = angle > Math.PI ? 1 : 0;
    return (
      <path key={color} d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`} fill={color} />
    );
  });

  return (
    <svg viewBox="0 0 80 80" className="w-20 h-20 drop-shadow-sm">
      {paths}
      <circle cx={cx} cy={cy} r={16} fill="hsl(var(--card))" />
      <text x={cx} y={cy + 5} textAnchor="middle" fontSize={12} fontWeight="bold" fill="currentColor">{total}</text>
    </svg>
  );
}

// ── Driver Detail Modal ────────────────────────────────────────────────────────

function computeDailyData(completed: OrderRecord[], days = 14) {
  const now = new Date();
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (days - 1 - i));
    const startMs = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const endMs = startMs + 86_400_000;
    const day = d.toLocaleDateString('default', { day: '2-digit', month: 'short' });
    const dayOrders = completed.filter((o) => {
      const t = new Date(o.updatedAt).getTime();
      return t >= startMs && t < endMs;
    });
    return { day, porosi: dayOrders.length, te_ardhura: Math.round(dayOrders.reduce((s, o) => s + o.total, 0) * 100) / 100 };
  });
}

interface DriverDetailProps {
  driver: DeliveryDriver;
  completed: OrderRecord[];
  active: OrderRecord[];
  waitMs: number;
  isBusy: boolean;
  ect: number;
  avgRating: number | null;
  happy: number; neutral: number; unhappy: number; total: number;
  isNext: boolean;
  onClose: () => void;
}

function DriverDetailModal({ driver, completed, waitMs, isBusy, ect, avgRating, happy, neutral, unhappy, total, isNext, onClose }: DriverDetailProps) {
  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null);
  const [tick, setTick] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setTick(Date.now()), 1000); return () => clearInterval(t); }, []);

  const productiveMs = completed.reduce((sum, o) => {
    const ms = new Date(o.updatedAt).getTime() - new Date(o.createdAt).getTime();
    return sum + (ms > 0 ? ms : 0);
  }, 0);
  const totalRevenue = completed.reduce((s, o) => s + o.total, 0);
  const avgDurationMs = completed.length > 0 ? productiveMs / completed.length : 0;
  const currentWait = !isBusy && isFinite(waitMs) && waitMs >= 0 ? fmtDuration(waitMs) : null;
  const currentPause = driver.isPaused && driver.pausedAt ? fmtDuration(tick - driver.pausedAt) : null;
  const dailyData = useMemo(() => computeDailyData(completed, 14), [completed]);
  const hasActivity = dailyData.some((d) => d.porosi > 0);

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-foreground/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-background rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[92vh] flex flex-col border border-border/40">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border/40 shrink-0">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-base shrink-0 shadow" style={{ background: driver.color || '#6b7280' }}>
            {driverShortCode(driver)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-lg leading-tight">{driver.name}</div>
            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
              {driver.isActive ? <span className="text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">Aktiv</span>
                : <span className="text-[10px] font-bold text-muted-foreground bg-secondary px-1.5 py-0.5 rounded-full">Jo aktiv</span>}
              {driver.isPaused && <span className="text-[10px] font-bold text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><Coffee className="w-2.5 h-2.5" /> Në pauzë</span>}
              {isNext && <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><Zap className="w-2.5 h-2.5" /> Tjetri</span>}
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-secondary shrink-0"><X className="w-5 h-5" /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-5">

          {/* ── Stats grid ─────────────────────────────────────────── */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-secondary/40 rounded-2xl p-3 text-center">
              <div className="text-2xl font-bold">{completed.length}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">Dërgesa</div>
            </div>
            <div className="bg-secondary/40 rounded-2xl p-3 text-center">
              <div className="text-2xl font-bold text-primary">€{totalRevenue.toFixed(0)}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">Të ardhura</div>
            </div>
            <div className="bg-secondary/40 rounded-2xl p-3 text-center">
              <div className="text-sm font-bold text-emerald-600 leading-tight mt-0.5">{productiveMs > 0 ? fmtDuration(productiveMs) : '—'}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">Produktive</div>
            </div>
            <div className="bg-secondary/40 rounded-2xl p-3 text-center">
              <div className="text-sm font-bold leading-tight mt-0.5">{avgDurationMs > 0 ? fmtDuration(avgDurationMs) : '—'}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">Mesatare/porosi</div>
            </div>
            <div className="bg-secondary/40 rounded-2xl p-3 text-center">
              {currentWait
                ? <><div className="text-sm font-bold font-mono text-emerald-600 leading-tight mt-0.5">{currentWait}</div><div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">Pritje</div></>
                : isBusy
                  ? <><div className="text-sm font-bold text-amber-600 leading-tight mt-0.5">~{Math.ceil(ect)}m</div><div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">ETA</div></>
                  : <><div className="text-sm font-bold text-muted-foreground leading-tight mt-0.5">—</div><div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">Pritje</div></>
              }
            </div>
            <div className="bg-secondary/40 rounded-2xl p-3 text-center">
              {currentPause
                ? <><div className="text-sm font-bold font-mono text-amber-600 leading-tight mt-0.5">{currentPause}</div><div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">Pauzë</div></>
                : <><div className="text-sm font-bold text-muted-foreground leading-tight mt-0.5">—</div><div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">Pauzë</div></>
              }
            </div>
          </div>

          {/* ── Ratings ────────────────────────────────────────────── */}
          <div className="bg-secondary/30 rounded-2xl p-4">
            <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-3 flex items-center gap-1">
              <Star className="w-3 h-3" /> Vlerësimet · {total} vot
            </div>
            {avgRating !== null ? (
              <div className="flex items-center gap-4">
                <PieChart happy={happy} neutral={neutral} unhappy={unhappy} />
                <div className="flex-1 space-y-2">
                  <div>
                    <div className="text-3xl font-bold leading-none">{avgRating.toFixed(1)}</div>
                    <div className="flex mt-1">{[1,2,3,4,5].map((s) => <Star key={s} className={`w-3 h-3 ${s <= Math.round(avgRating) ? 'text-amber-400' : 'text-muted-foreground/25'}`} fill={s <= Math.round(avgRating) ? 'currentColor' : 'none'} />)}</div>
                  </div>
                  {([['😊', happy, 'bg-emerald-400'], ['😐', neutral, 'bg-amber-400'], ['☹️', unhappy, 'bg-red-400']] as const).map(([emoji, count, color]) => (
                    <div key={emoji} className="flex items-center gap-2 text-xs">
                      <span className="w-5">{emoji}</span>
                      <div className="flex-1 bg-secondary rounded-full h-1.5 overflow-hidden">
                        <div className={`h-1.5 rounded-full ${color}`} style={{ width: total > 0 ? `${(count / total) * 100}%` : '0%' }} />
                      </div>
                      <span className="w-5 text-right font-bold text-muted-foreground text-[10px]">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : <p className="text-xs text-muted-foreground italic text-center py-2">Asnjë vlerësim ende</p>}
          </div>

          {/* ── Daily charts ───────────────────────────────────────── */}
          {hasActivity && (
            <div className="space-y-4">
              <div className="bg-secondary/30 rounded-2xl p-4">
                <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-3 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" /> Porosi / ditë · 14 ditë
                </div>
                <ResponsiveContainer width="100%" height={110}>
                  <BarChart data={dailyData} margin={{ top: 2, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} interval={1} />
                    <YAxis tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 11 }}
                      cursor={{ fill: 'hsl(var(--primary) / 0.08)' }}
                      formatter={(v: number) => [v, 'Porosi']}
                    />
                    <Bar dataKey="porosi" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-secondary/30 rounded-2xl p-4">
                <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-3 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" /> Të ardhura / ditë · €
                </div>
                <ResponsiveContainer width="100%" height={110}>
                  <LineChart data={dailyData} margin={{ top: 2, right: 4, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} interval={1} />
                    <YAxis tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 11 }}
                      formatter={(v: number) => [`€${v.toFixed(2)}`, 'Të ardhura']}
                    />
                    <Line type="monotone" dataKey="te_ardhura" stroke="#22c55e" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ── Selected order detail ──────────────────────────────── */}
          {selectedOrder && (
            <div className="bg-primary/5 rounded-2xl p-4 border border-primary/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase tracking-wider font-bold text-primary">Detaje Porosi</span>
                <button onClick={() => setSelectedOrder(null)} className="text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>
              </div>
              <div className="text-sm font-semibold">{selectedOrder.customerName}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{selectedOrder.deliveryAddress}</div>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-primary/10">
                <span className="text-xs text-muted-foreground">{fmtDate(selectedOrder.updatedAt)} {fmtTime(selectedOrder.updatedAt)}</span>
                <span className="font-bold text-primary">€{selectedOrder.total.toFixed(2)}</span>
              </div>
              {selectedOrder.driverRating != null && (
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="text-base">{selectedOrder.driverRating >= 4 ? '😊' : selectedOrder.driverRating >= 2 ? '😐' : '☹️'}</span>
                  <div className="flex">{[1,2,3,4,5].map((s) => <Star key={s} className={`w-3 h-3 ${s <= selectedOrder.driverRating! ? 'text-amber-400' : 'text-muted-foreground/20'}`} fill={s <= selectedOrder.driverRating! ? 'currentColor' : 'none'} />)}</div>
                </div>
              )}
              <div className="mt-2 space-y-0.5">
                {selectedOrder.items.map((it: any, i) => <div key={i} className="text-xs text-muted-foreground">• {it.quantity}x {it.name?.sq || it.name?.en || it.id}</div>)}
              </div>
            </div>
          )}

          {/* ── Logbook ────────────────────────────────────────────── */}
          <div>
            <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2 flex items-center gap-1">
              <CheckCheck className="w-3 h-3" /> Logbook · {completed.length} dërgesa
            </div>
            {completed.length === 0
              ? <p className="text-xs text-muted-foreground italic text-center py-4">Asnjë dërgim i kryer</p>
              : (
                <div className="divide-y divide-border/20 rounded-2xl overflow-hidden border border-border/30">
                  {completed.map((o) => (
                    <button
                      key={o.id}
                      onClick={() => setSelectedOrder(selectedOrder?.id === o.id ? null : o)}
                      className={`w-full px-4 py-2.5 flex items-center gap-2 text-xs hover:bg-secondary/50 transition-colors text-left ${selectedOrder?.id === o.id ? 'bg-primary/5' : ''}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-[10px] text-muted-foreground leading-none mb-0.5">#{o.id.slice(0, 6).toUpperCase()}</div>
                        <div className="font-semibold truncate">{o.customerName}</div>
                        <div className="text-[10px] text-muted-foreground truncate">{o.deliveryAddress}</div>
                      </div>
                      <div className="text-right shrink-0 space-y-0.5">
                        <div className="font-bold text-foreground">€{o.total.toFixed(2)}</div>
                        <div className="text-[10px] text-muted-foreground">{fmtDate(o.updatedAt)}</div>
                      </div>
                      <div className="shrink-0 text-base leading-none w-6 text-center">
                        {o.driverRating != null ? (o.driverRating >= 4 ? '😊' : o.driverRating >= 2 ? '😐' : '☹️') : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40" />}
                      </div>
                    </button>
                  ))}
                </div>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── component ─────────────────────────────────────────────────────────────────

export default function DriversKPI() {
  const [drivers, setDrivers] = useState<DeliveryDriver[]>([]);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [tick, setTick] = useState(Date.now());
  const [detailDriverId, setDetailDriverId] = useState<string | null>(null);
  const [showCleanConfirm, setShowCleanConfirm] = useState(false);
  const [cleaning, setCleaning] = useState(false);

  const load = useCallback(() => {
    fetchDrivers().then(setDrivers).catch(console.error);
    fetchAllOrders().then(setOrders).catch(console.error);
  }, []);

  useEffect(() => {
    load();
    const poll = setInterval(load, 10_000);
    return () => clearInterval(poll);
  }, [load]);

  useEffect(() => {
    const t = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const handleApprovePause = async (driverId: string) => {
    setDrivers((prev) => prev.map((d) => d.id === driverId ? { ...d, isPendingPause: false, isPaused: true, pausedAt: Date.now() } : d));
    try { await approvePause(driverId); } catch { load(); }
  };

  const handleUnpause = async (driverId: string) => {
    const now = Date.now();
    setDrivers((prev) => prev.map((d) => d.id === driverId ? { ...d, isPaused: false, isPendingPause: false, pausedAt: null, availableSince: now } : d));
    try { await setDriverPause(driverId, false); } catch { load(); }
  };

  const handleCleanAll = async () => {
    setCleaning(true);
    try {
      await hardDeleteAllOrders();
      await resetAllDriverTimers();
      setOrders([]);
      load();
      setShowCleanConfirm(false);
    } catch { load(); }
    finally { setCleaning(false); }
  };

  const bestId = useMemo(() => pickBestDriver(drivers, orders), [drivers, orders, tick]);

  const cols = useMemo(() => drivers.filter((d) => d.isActive).map((driver) => {
    const all = orders.filter((o) => o.assignedDriverId === driver.id);
    const completed = all.filter((o) => o.status === 'completed')
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    const active = all.filter((o) => ['approved', 'preparing', 'out_for_delivery'].includes(o.status));
    const waitMs = driverWaitMs(driver, orders, tick);
    const isBusy = waitMs === -1;
    const ect = driverECT(driver.id, orders, tick);

    const rated = completed.filter((o) => o.driverRating != null);
    const avgRating = rated.length ? rated.reduce((s, o) => s + (o.driverRating ?? 0), 0) / rated.length : null;
    const happy = rated.filter((o) => (o.driverRating ?? 0) >= 4).length;
    const neutral = rated.filter((o) => (o.driverRating ?? 0) >= 2 && (o.driverRating ?? 0) < 4).length;
    const unhappy = rated.filter((o) => (o.driverRating ?? 0) < 2).length;
    const total = happy + neutral + unhappy;

    const pauseDurationMs = driver.isPaused && driver.pausedAt ? tick - driver.pausedAt : null;

    return { driver, completed, active, waitMs, isBusy, ect, avgRating, happy, neutral, unhappy, total, pauseDurationMs };
  }), [drivers, orders, tick]);

  // 3 sorted sections
  const queueAvailable = useMemo(() =>
    cols.filter((c) => !c.driver.isPaused && !c.driver.isPendingPause && !c.isBusy)
      .sort((a, b) => {
        const aMs = isFinite(a.waitMs) && a.waitMs >= 0 ? a.waitMs : Infinity;
        const bMs = isFinite(b.waitMs) && b.waitMs >= 0 ? b.waitMs : Infinity;
        return bMs - aMs; // longest wait first
      }),
  [cols]);

  const queueBusy = useMemo(() =>
    cols.filter((c) => !c.driver.isPaused && !c.driver.isPendingPause && c.isBusy)
      .sort((a, b) => a.ect - b.ect),
  [cols]);

  const queuePaused = useMemo(() =>
    cols.filter((c) => c.driver.isPaused || c.driver.isPendingPause),
  [cols]);

  const detailCol = detailDriverId ? cols.find((c) => c.driver.id === detailDriverId) : null;

  if (cols.length === 0) {
    return <div className="py-16 text-center text-muted-foreground text-sm">Nuk ka shoferë të regjistruar ende.</div>;
  }

  // ── Queue row renderers ──────────────────────────────────────────────────────

  const AvailableRow = ({ col, pos }: { col: typeof cols[0]; pos: number }) => {
    const isNext = col.driver.id === bestId;
    const hasWait = isFinite(col.waitMs) && col.waitMs >= 0;
    return (
      <div
        onClick={() => setDetailDriverId(col.driver.id)}
        className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all hover:bg-secondary/50 ${isNext ? 'bg-primary/5 ring-1 ring-primary/30' : 'bg-background'}`}
      >
        {/* Position */}
        <div className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm shrink-0"
          style={{ background: isNext ? 'hsl(var(--primary) / 0.15)' : 'hsl(var(--secondary))', color: isNext ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))' }}>
          {pos}
        </div>
        {/* Avatar */}
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-xs shrink-0" style={{ background: col.driver.color || '#6b7280' }}>
          {driverShortCode(col.driver)}
        </div>
        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm truncate flex items-center gap-1.5">
            {col.driver.name}
            {isNext && <span className="text-[9px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><Zap className="w-2 h-2" /> Tjetri</span>}
          </div>
          <div className="flex items-center gap-1 text-[11px] text-emerald-600 font-semibold mt-0.5">
            <Clock className="w-2.5 h-2.5" />
            {hasWait ? <>Koha e pritjes: <span className="font-mono ml-0.5">{fmtDuration(col.waitMs)}</span></> : 'I disponueshëm'}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm font-bold">{col.completed.length}</div>
          <div className="text-[9px] text-muted-foreground uppercase tracking-wider">dërgesa</div>
        </div>
      </div>
    );
  };

  const BusyRow = ({ col }: { col: typeof cols[0] }) => (
    <div
      onClick={() => setDetailDriverId(col.driver.id)}
      className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all hover:bg-secondary/50 bg-background"
    >
      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-xs shrink-0" style={{ background: col.driver.color || '#6b7280' }}>
        {driverShortCode(col.driver)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-bold text-sm truncate">{col.driver.name}</div>
        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-amber-600 font-semibold">
          <span>{col.active.length} porosi aktive</span>
          <span className="text-muted-foreground">·</span>
          <span>ETA ~{Math.ceil(col.ect)}min</span>
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-sm font-bold">{col.completed.length}</div>
        <div className="text-[9px] text-muted-foreground uppercase tracking-wider">dërgesa</div>
      </div>
    </div>
  );

  const PausedRow = ({ col }: { col: typeof cols[0] }) => {
    const isPending = col.driver.isPendingPause;
    return (
      <div
        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${isPending ? 'bg-amber-500/10 ring-1 ring-amber-400/40' : 'bg-background opacity-70'}`}
      >
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-xs shrink-0 opacity-60" style={{ background: col.driver.color || '#6b7280' }}>
          {driverShortCode(col.driver)}
        </div>
        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setDetailDriverId(col.driver.id)}>
          <div className="font-bold text-sm truncate">{col.driver.name}</div>
          {isPending ? (
            <div className="flex items-center gap-1 text-[11px] text-amber-600 font-semibold mt-0.5">
              <AlertCircle className="w-2.5 h-2.5" /> Kërkon pauzë
            </div>
          ) : (
            <div className="flex items-center gap-1 text-[11px] text-amber-600 font-semibold mt-0.5">
              <Coffee className="w-2.5 h-2.5" />
              {col.pauseDurationMs != null ? <>Pauzë: <span className="font-mono ml-0.5">{fmtDuration(col.pauseDurationMs)}</span></> : 'Në pauzë'}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {isPending && (
            <button
              onClick={() => handleApprovePause(col.driver.id)}
              className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors"
            >
              <CheckCircle2 className="w-3 h-3" /> Aprovo
            </button>
          )}
          <button
            onClick={() => handleUnpause(col.driver.id)}
            className="text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25 transition-colors"
          >
            Disponueshëm
          </button>
        </div>
      </div>
    );
  };

  // ── render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 px-1">
        <h2 className="text-xl font-bold font-display">Shoferët · Logbook</h2>
        <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse inline-block" />
          Live
        </span>
        <div className="ml-auto">
          {!showCleanConfirm ? (
            <button
              onClick={() => setShowCleanConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
            >
              <Trash2 className="w-3 h-3" /> PASTRIMI I POROSIVE
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-destructive">Konfirmo fshirjen?</span>
              <button
                disabled={cleaning}
                onClick={handleCleanAll}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-[11px] font-bold bg-destructive text-white hover:bg-destructive/90 disabled:opacity-50 transition-colors"
              >
                {cleaning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                Po, fshij
              </button>
              <button
                onClick={() => setShowCleanConfirm(false)}
                className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-secondary text-muted-foreground hover:bg-secondary/80 transition-colors"
              >
                Anulo
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          RRADHITJA — top, largest, most prominent
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className="rounded-2xl border-2 border-primary/20 bg-card shadow-md overflow-hidden">
        <div className="px-5 py-4 bg-primary/5 border-b border-primary/15 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          <div>
            <h3 className="font-bold text-base text-primary">Rradhitja e marrjes së porosisë</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">Auto-selection · Shoferët me pritje më të gjatë marrin porosinë e radhës</p>
          </div>
        </div>

        {/* Section 1: Available / in queue */}
        <div className="px-4 pt-4 pb-2">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">I disponueshëm · {queueAvailable.length}</span>
          </div>
          {queueAvailable.length === 0
            ? <div className="text-xs text-muted-foreground italic py-3 px-4">Asnjë shofer në radhë.</div>
            : <div className="space-y-1">
                {queueAvailable.map((col, i) => <AvailableRow key={col.driver.id} col={col} pos={i + 1} />)}
              </div>
          }
        </div>

        {/* Section 2: Busy */}
        {queueBusy.length > 0 && (
          <div className="px-4 py-2 border-t border-border/30">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600">Të zënët me punë · {queueBusy.length}</span>
            </div>
            <div className="space-y-1">
              {queueBusy.map((col) => <BusyRow key={col.driver.id} col={col} />)}
            </div>
          </div>
        )}

        {/* Section 3: Paused */}
        {queuePaused.length > 0 && (
          <div className="px-4 py-2 border-t border-border/30 pb-4">
            <div className="flex items-center gap-2 mb-2">
              <Coffee className="w-2.5 h-2.5 text-muted-foreground" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Në pauzë · {queuePaused.length}</span>
            </div>
            <div className="space-y-1">
              {queuePaused.map((col) => <PausedRow key={col.driver.id} col={col} />)}
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          DRIVER COLUMNS (detailed cards)
      ═══════════════════════════════════════════════════════════════════════ */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1 mb-3">Statistikat e Shoferëve · kliko për detaje</h3>
        <div className="flex gap-3 overflow-x-auto pb-3" style={{ scrollSnapType: 'x mandatory' }}>
          {cols.map(({ driver, completed, active, waitMs, isBusy, ect, avgRating, happy, neutral, unhappy, total, pauseDurationMs }) => {
            const isNext = driver.id === bestId;
            return (
              <div
                key={driver.id}
                className="flex-shrink-0 w-72 rounded-2xl border flex flex-col overflow-hidden shadow-sm cursor-pointer transition-all hover:shadow-md active:scale-[0.99]"
                style={{
                  scrollSnapAlign: 'start',
                  borderColor: isNext ? 'hsl(var(--primary) / 0.6)' : driver.isPaused ? 'hsl(var(--border) / 0.25)' : 'hsl(var(--border) / 0.4)',
                  background: isNext ? 'hsl(var(--primary) / 0.035)' : 'hsl(var(--card))',
                  opacity: driver.isPaused ? 0.75 : 1,
                }}
                onClick={() => setDetailDriverId(driver.id)}
              >
                {/* Header */}
                <div className="px-4 py-3 flex items-center gap-3 border-b border-border/30">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-sm" style={{ background: driver.color || '#6b7280' }}>
                    {driverShortCode(driver)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm truncate">{driver.name}</div>
                    <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                      {driver.isActive
                        ? <span className="text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">Aktiv</span>
                        : <span className="text-[10px] font-bold text-muted-foreground bg-secondary px-1.5 py-0.5 rounded-full">Jo aktiv</span>}
                      {driver.isPendingPause && <span className="text-[10px] font-bold text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><AlertCircle className="w-2.5 h-2.5" /> Kërkon pauzë</span>}
                      {driver.isPaused && <span className="text-[10px] font-bold text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><Coffee className="w-2.5 h-2.5" /> Pauzë</span>}
                      {isNext && <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><Zap className="w-2.5 h-2.5" /> Tjetri</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xl font-bold leading-none">{completed.length}</div>
                    <div className="text-[9px] text-muted-foreground uppercase tracking-wider mt-0.5">dërgesa</div>
                  </div>
                </div>

                {/* Status */}
                <div className="px-4 py-2.5 border-b border-border/30 bg-secondary/20 flex items-center gap-2.5">
                  {driver.isPaused ? (
                    <>
                      <Coffee className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <div>
                        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Në pauzë</div>
                        <div className="text-sm font-bold text-amber-600 font-mono">
                          {pauseDurationMs != null ? fmtDuration(pauseDurationMs) : '—'}
                        </div>
                      </div>
                    </>
                  ) : isBusy ? (
                    <>
                      <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
                      <div>
                        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Aktiv · {active.length} porosi</div>
                        <div className="text-sm font-bold text-amber-600">ETA ~{Math.ceil(ect)} min</div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                      <div>
                        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" /> Koha e pritjes
                        </div>
                        <div className="text-sm font-bold text-emerald-600 font-mono">
                          {isFinite(waitMs) && waitMs >= 0 ? fmtDuration(waitMs) : 'I disponueshëm'}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Logbook */}
                <div className="overflow-y-auto flex-1" style={{ maxHeight: 160 }}>
                  {completed.length === 0
                    ? <div className="py-4 text-center text-xs text-muted-foreground italic">Asnjë dërgim i kryer</div>
                    : (
                      <div className="divide-y divide-border/20">
                        {completed.slice(0, 10).map((o) => (
                          <div key={o.id} className="px-4 py-2 flex items-center gap-2 text-xs hover:bg-secondary/30 transition-colors">
                            <div className="flex-1 min-w-0">
                              <div className="font-mono text-[10px] text-muted-foreground leading-none mb-0.5">#{o.id.slice(0, 6).toUpperCase()}</div>
                              <div className="font-semibold truncate">{o.customerName}</div>
                            </div>
                            <div className="text-right shrink-0 text-muted-foreground">
                              <div className="font-bold text-foreground">€{o.total.toFixed(2)}</div>
                              <div className="text-[10px]">{fmtDate(o.updatedAt)} {fmtTime(o.updatedAt)}</div>
                            </div>
                            <div className="shrink-0 text-base leading-none">
                              {o.driverRating != null ? (o.driverRating >= 4 ? '😊' : o.driverRating >= 2 ? '😐' : '☹️') : <span className="text-muted-foreground/30 text-xs">—</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                </div>

                {/* Ratings */}
                <div className="px-4 py-3 border-t border-border/30">
                  {avgRating !== null ? (
                    <div className="flex items-center gap-3">
                      <div className="text-center shrink-0">
                        <div className="text-2xl font-bold leading-none">{avgRating.toFixed(1)}</div>
                        <div className="flex mt-1 justify-center">
                          {[1,2,3,4,5].map((s) => <Star key={s} className={`w-2.5 h-2.5 ${s <= Math.round(avgRating) ? 'text-amber-400' : 'text-muted-foreground/25'}`} fill={s <= Math.round(avgRating) ? 'currentColor' : 'none'} />)}
                        </div>
                        <div className="text-[9px] text-muted-foreground mt-0.5">{total} vot</div>
                      </div>
                      <div className="flex-1 space-y-1.5 text-xs">
                        {([['😊', happy, 'bg-emerald-400'], ['😐', neutral, 'bg-amber-400'], ['☹️', unhappy, 'bg-red-400']] as const).map(([emoji, count, color]) => (
                          <div key={emoji} className="flex items-center gap-1.5">
                            <span className="text-sm leading-none w-5">{emoji}</span>
                            <div className="flex-1 bg-secondary rounded-full h-1.5 overflow-hidden">
                              <div className={`h-1.5 rounded-full ${color} transition-all`} style={{ width: total > 0 ? `${(count / total) * 100}%` : '0%' }} />
                            </div>
                            <span className="w-5 text-right font-bold text-muted-foreground">{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : <p className="text-xs text-muted-foreground italic text-center py-1">Asnjë vlerësim ende</p>}
                </div>

                <div className="px-4 py-2 bg-secondary/10 flex items-center justify-center gap-1 text-[10px] text-muted-foreground border-t border-border/20">
                  <ChevronRight className="w-3 h-3" /> Kliko për statistika të plota
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {detailDriverId && detailCol && (
        <DriverDetailModal
          driver={detailCol.driver}
          completed={detailCol.completed}
          active={detailCol.active}
          waitMs={detailCol.waitMs}
          isBusy={detailCol.isBusy}
          ect={detailCol.ect}
          avgRating={detailCol.avgRating}
          happy={detailCol.happy}
          neutral={detailCol.neutral}
          unhappy={detailCol.unhappy}
          total={detailCol.total}
          isNext={detailCol.driver.id === bestId}
          onClose={() => setDetailDriverId(null)}
        />
      )}
    </div>
  );
}
