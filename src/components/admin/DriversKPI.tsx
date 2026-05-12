import { useEffect, useState, useMemo } from 'react';
import { fetchDrivers, type DeliveryDriver } from '@/lib/driversApi';
import { fetchAllOrders, type OrderRecord } from '@/lib/ordersApi';
import { Star, Zap, Clock } from 'lucide-react';

// ── helpers ────────────────────────────────────────────────────────────────────

function fmtDuration(ms: number): string {
  if (!isFinite(ms) || ms < 0) return '—';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
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

/** ECT: remaining minutes across all active orders for a driver */
function driverECT(driverId: string, orders: OrderRecord[], now = Date.now()): number {
  return orders
    .filter((o) => o.assignedDriverId === driverId && ['approved', 'preparing', 'out_for_delivery'].includes(o.status))
    .reduce((sum, o) => {
      const elapsed = (now - new Date(o.createdAt).getTime()) / 60_000;
      return sum + Math.max(0, (o.prepEtaMinutes ?? 20) - elapsed);
    }, 0);
}

/**
 * Pick best driver to assign next order:
 * 1. Prefer idle drivers — among them, the one idle the LONGEST wins
 * 2. If all busy — fallback to lowest ECT (soonest free)
 */
export function pickBestDriver(drivers: DeliveryDriver[], orders: OrderRecord[]): string | null {
  const active = drivers.filter((d) => d.isActive);
  if (!active.length) return null;

  const now = Date.now();
  const withIdle = active.map((d) => ({ id: d.id, idleMs: driverIdleMs(d.id, orders, now) }));
  const idle = withIdle.filter((x) => x.idleMs >= 0);

  if (idle.length > 0) {
    return idle.reduce((best, x) => {
      if (!isFinite(best.idleMs)) return best;
      if (!isFinite(x.idleMs)) return x;
      return x.idleMs > best.idleMs ? x : best;
    }).id;
  }

  // All busy — lowest ECT
  return active.reduce((best, d) =>
    driverECT(d.id, orders, now) < driverECT(best.id, orders, now) ? d : best,
  active[0]).id;
}

// ── component ─────────────────────────────────────────────────────────────────

export default function DriversKPI() {
  const [drivers, setDrivers] = useState<DeliveryDriver[]>([]);
  const [orders, setOrders]   = useState<OrderRecord[]>([]);
  const [tick, setTick]       = useState(Date.now());

  useEffect(() => {
    const load = () => {
      fetchDrivers().then(setDrivers).catch(console.error);
      fetchAllOrders().then(setOrders).catch(console.error);
    };
    load();
    const poll = setInterval(load, 10_000);
    return () => clearInterval(poll);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const bestId = useMemo(() => pickBestDriver(drivers, orders), [drivers, orders, tick]);

  const cols = useMemo(() => drivers.map((driver) => {
    const all      = orders.filter((o) => o.assignedDriverId === driver.id);
    const completed = all
      .filter((o) => o.status === 'completed')
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    const active   = all.filter((o) => ['approved', 'preparing', 'out_for_delivery'].includes(o.status));
    const idleMs   = driverIdleMs(driver.id, orders, tick);
    const isBusy   = idleMs === -1;
    const ect      = driverECT(driver.id, orders, tick);

    const rated    = completed.filter((o) => o.driverRating != null);
    const avgRating = rated.length
      ? rated.reduce((s, o) => s + (o.driverRating ?? 0), 0) / rated.length
      : null;
    const happy   = rated.filter((o) => (o.driverRating ?? 0) >= 4).length;
    const neutral = rated.filter((o) => (o.driverRating ?? 0) >= 2 && (o.driverRating ?? 0) < 4).length;
    const unhappy = rated.filter((o) => (o.driverRating ?? 0) < 2).length;
    const total   = happy + neutral + unhappy;

    return { driver, completed, active, idleMs, isBusy, ect, avgRating, happy, neutral, unhappy, total };
  }), [drivers, orders, tick]);

  if (cols.length === 0) {
    return (
      <div className="py-16 text-center text-muted-foreground text-sm">
        Nuk ka shoferë të regjistruar ende.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-1">
        <h2 className="text-xl font-bold font-display">Shoferët · Logbook</h2>
        <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse inline-block" />
          Live
        </span>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-3" style={{ scrollSnapType: 'x mandatory' }}>
        {cols.map(({ driver, completed, active, idleMs, isBusy, ect, avgRating, happy, neutral, unhappy, total }) => {
          const isNext = driver.id === bestId;

          return (
            <div
              key={driver.id}
              className="flex-shrink-0 w-72 rounded-2xl border flex flex-col overflow-hidden shadow-sm"
              style={{
                scrollSnapAlign: 'start',
                borderColor: isNext ? 'hsl(var(--primary) / 0.6)' : 'hsl(var(--border) / 0.4)',
                background: isNext ? 'hsl(var(--primary) / 0.035)' : 'hsl(var(--card))',
              }}
            >
              {/* ── Header ── */}
              <div className="px-4 py-3 flex items-center gap-3 border-b border-border/30">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-sm"
                  style={{ background: driver.color || '#6b7280' }}
                >
                  {driver.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm truncate">{driver.name}</div>
                  <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                    {driver.isActive
                      ? <span className="text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">Aktiv</span>
                      : <span className="text-[10px] font-bold text-muted-foreground bg-secondary px-1.5 py-0.5 rounded-full">Jo aktiv</span>
                    }
                    {isNext && (
                      <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                        <Zap className="w-2.5 h-2.5" /> Tjetri
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xl font-bold leading-none">{completed.length}</div>
                  <div className="text-[9px] text-muted-foreground uppercase tracking-wider mt-0.5">dërgesa</div>
                </div>
              </div>

              {/* ── Status / idle timer ── */}
              <div className="px-4 py-2.5 border-b border-border/30 bg-secondary/20 flex items-center gap-2.5">
                {isBusy ? (
                  <>
                    <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
                    <div>
                      <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Aktiv · {active.length} {active.length === 1 ? 'porosi' : 'porosi'}</div>
                      <div className="text-sm font-bold text-amber-600">ETA ~{Math.ceil(ect)} min</div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                    <div>
                      <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" /> Në pritje
                      </div>
                      <div className="text-sm font-bold text-emerald-600">
                        {isFinite(idleMs) ? fmtDuration(idleMs) : 'Pa porosi akoma'}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* ── Ratings ── */}
              <div className="px-4 py-3 border-b border-border/30">
                {avgRating !== null ? (
                  <div className="flex items-center gap-3">
                    <div className="text-center shrink-0">
                      <div className="text-2xl font-bold leading-none">{avgRating.toFixed(1)}</div>
                      <div className="flex mt-1 justify-center">
                        {[1,2,3,4,5].map((s) => (
                          <Star
                            key={s}
                            className={`w-2.5 h-2.5 ${s <= Math.round(avgRating) ? 'text-amber-400' : 'text-muted-foreground/25'}`}
                            fill={s <= Math.round(avgRating) ? 'currentColor' : 'none'}
                          />
                        ))}
                      </div>
                      <div className="text-[9px] text-muted-foreground mt-0.5">{total} vot</div>
                    </div>
                    <div className="flex-1 space-y-1.5 text-xs">
                      {([['😊', happy, 'bg-emerald-400'], ['😐', neutral, 'bg-amber-400'], ['☹️', unhappy, 'bg-red-400']] as const).map(([emoji, count, color]) => (
                        <div key={emoji} className="flex items-center gap-1.5">
                          <span className="text-sm leading-none w-5">{emoji}</span>
                          <div className="flex-1 bg-secondary rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-1.5 rounded-full ${color} transition-all`}
                              style={{ width: total > 0 ? `${(count / total) * 100}%` : '0%' }}
                            />
                          </div>
                          <span className="w-5 text-right font-bold text-muted-foreground">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic text-center py-1">Asnjë vlerësim ende</p>
                )}
              </div>

              {/* ── Logbook ── */}
              <div className="overflow-y-auto flex-1" style={{ maxHeight: 260 }}>
                {completed.length === 0 ? (
                  <div className="py-6 text-center text-xs text-muted-foreground italic">Asnjë dërgim i kryer</div>
                ) : (
                  <div className="divide-y divide-border/20">
                    {completed.slice(0, 30).map((o) => (
                      <div key={o.id} className="px-4 py-2 flex items-center gap-2 text-xs hover:bg-secondary/30 transition-colors">
                        <div className="flex-1 min-w-0">
                          <div className="font-mono text-[10px] text-muted-foreground leading-none mb-0.5">
                            #{o.id.slice(0, 6).toUpperCase()}
                          </div>
                          <div className="font-semibold truncate">{o.customerName}</div>
                        </div>
                        <div className="text-right shrink-0 text-muted-foreground">
                          <div className="font-bold text-foreground">€{o.total.toFixed(2)}</div>
                          <div className="text-[10px]">{fmtDate(o.updatedAt)} {fmtTime(o.updatedAt)}</div>
                        </div>
                        <div className="shrink-0 text-base leading-none">
                          {o.driverRating != null
                            ? (o.driverRating >= 4 ? '😊' : o.driverRating >= 2 ? '😐' : '☹️')
                            : <span className="text-muted-foreground/30 text-xs">—</span>
                          }
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
