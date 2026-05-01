import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, MapPin, Phone, Calendar, Smartphone, Globe, Clock, Printer, Trash2, ChefHat, Bike, CheckCheck, AlertCircle, Hourglass, Star, MessageCircle, Copy, Navigation, Receipt, Search } from 'lucide-react';
import { toast } from 'sonner';
import {
  fetchAllOrders,
  subscribeAllOrdersRealtime,
  updateOrderStatus,
  deleteOrder,
  softDeleteOrder,
  restoreOrder,
  setOrderEta,
  type OrderRecord,
  type OrderStatus,
} from '@/lib/ordersApi';
import OrderChat from '@/components/OrderChat';
import OrderActionDrawer from '@/components/admin/OrderActionDrawer';
import DeliveryRouteMap from '@/components/admin/DeliveryRouteMap';
import ArchivedChatView from '@/components/admin/ArchivedChatView';
import { generateInvoice } from '@/lib/invoiceGenerator';
import { fetchDrivers, assignDriverToOrder, type DeliveryDriver } from '@/lib/driversApi';

const statusColor = (s: string) => {
  if (s === 'pending') return 'bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/30 animate-pulse';
  if (s === 'approved' || s === 'preparing' || s === 'out_for_delivery') return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-500/30';
  if (s === 'rejected') return 'bg-red-500/15 text-red-700 dark:text-red-400 ring-1 ring-red-500/30';
  if (s === 'completed') return 'bg-primary/10 text-primary ring-1 ring-primary/20';
  return 'bg-secondary text-muted-foreground';
};

// Used to drive the pulsing red alert badge after 60s without admin action
const useNow = (intervalMs = 5000) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
};

const STATUS_LABEL: Record<string, string> = {
  pending: 'Duke pritur',
  approved: 'Konfirmuar',
  preparing: 'Përgatitet',
  out_for_delivery: 'Në rrugë',
  rejected: 'Anuluar',
  completed: 'Përfunduar',
};

type FilterKey = 'hour' | 'today' | 'week' | 'month' | 'custom' | 'all';
type StatusFilter = 'active' | 'pending' | 'approved' | 'rejected' | 'history';

const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const startOfWeek = (d: Date) => {
  const x = startOfDay(d);
  const day = x.getDay();
  const diff = (day + 6) % 7;
  x.setDate(x.getDate() - diff);
  return x;
};
const startOfMonth = (d: Date) => {
  const x = startOfDay(d);
  x.setDate(1);
  return x;
};

// --- Sound ---
let _audioCtx: AudioContext | null = null;
const playDing = () => {
  try {
    if (!_audioCtx) _audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const ctx = _audioCtx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(880, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12);
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.45);
  } catch {}
};

const ARCHIVE_KEY = 'papirun_admin_archived_order_ids';
const loadArchive = (): Set<string> => {
  try { return new Set(JSON.parse(localStorage.getItem(ARCHIVE_KEY) || '[]')); }
  catch { return new Set(); }
};
const saveArchive = (s: Set<string>) => {
  try { localStorage.setItem(ARCHIVE_KEY, JSON.stringify(Array.from(s))); } catch {}
};

const PRIORITY_KEY = 'papirun_admin_priority_order_ids';
const loadPriority = (): Set<string> => {
  try { return new Set(JSON.parse(localStorage.getItem(PRIORITY_KEY) || '[]')); }
  catch { return new Set(); }
};
const savePriority = (s: Set<string>) => {
  try { localStorage.setItem(PRIORITY_KEY, JSON.stringify(Array.from(s))); } catch {}
};

const OrdersReview = () => {
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [filter, setFilter] = useState<FilterKey>('month');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerMode, setDrawerMode] = useState<'approve' | 'reject' | null>(null);
  const [drawerOrder, setDrawerOrder] = useState<OrderRecord | null>(null);
  const [glowingIds, setGlowingIds] = useState<Set<string>>(new Set());
  const [archivedIds, setArchivedIds] = useState<Set<string>>(() => loadArchive());
  const [priorityIds, setPriorityIds] = useState<Set<string>>(() => loadPriority());
  const seenIdsRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);
  const now = useNow(5000);
  const [drivers, setDrivers] = useState<DeliveryDriver[]>([]);

  // Load drivers list once
  useEffect(() => {
    fetchDrivers().then((d) => setDrivers(d.filter((x) => x.isActive))).catch(() => {});
  }, []);

  const archiveOrder = (id: string) => {
    setArchivedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveArchive(next);
      return next;
    });
    if (selectedId === id) setSelectedId(null);
  };
  const unarchiveOrder = (id: string) => {
    setArchivedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      saveArchive(next);
      return next;
    });
  };
  const togglePriority = (id: string) => {
    setPriorityIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      savePriority(next);
      return next;
    });
  };
  useEffect(() => {
    const sync = async () => {
      try {
        const all = await fetchAllOrders();
        // Detect new orders (not seen yet AND we already have an initial baseline)
        if (initializedRef.current) {
          const newOnes = all.filter((o) => !seenIdsRef.current.has(o.id));
          if (newOnes.length) {
            playDing();
            const newIds = newOnes.map((o) => o.id);
            setGlowingIds((prev) => {
              const next = new Set(prev);
              newIds.forEach((id) => next.add(id));
              return next;
            });
            setTimeout(() => {
              setGlowingIds((prev) => {
                const next = new Set(prev);
                newIds.forEach((id) => next.delete(id));
                return next;
              });
            }, 10000);
          }
        }
        all.forEach((o) => seenIdsRef.current.add(o.id));
        initializedRef.current = true;
        setOrders(all);
      } catch (e) { console.error(e); }
    };
    sync();
    const unsub = subscribeAllOrdersRealtime(sync);
    return () => { unsub(); };
  }, []);

  // Apply time-range filter first
  const timeFiltered = useMemo(() => {
    const now = new Date();
    return orders.filter((o) => {
      const created = new Date(o.createdAt);
      switch (filter) {
        case 'hour': return created >= new Date(now.getTime() - 60 * 60 * 1000);
        case 'today': return created >= startOfDay(now);
        case 'week': return created >= startOfWeek(now);
        case 'month': return created >= startOfMonth(now);
        case 'custom': {
          if (!customFrom && !customTo) return true;
          const from = customFrom ? new Date(customFrom) : null;
          const to = customTo ? new Date(customTo + 'T23:59:59') : null;
          if (from && created < from) return false;
          if (to && created > to) return false;
          return true;
        }
        default: return true;
      }
    });
  }, [orders, filter, customFrom, customTo]);

  // Helper: an order is "in history" if either soft-deleted server-side or locally archived or status is histori
  const isInHistory = (o: OrderRecord) => o.isVisible === false || archivedIds.has(o.id) || o.status === 'histori';

  // Counts (exclude history items so deleted/archived don't keep counting in active stats)
  const counts = useMemo(() => {
    const visible = timeFiltered.filter((o) => !isInHistory(o));
    return {
      pending: visible.filter((o) => o.status === 'pending').length,
      approved: visible.filter((o) => ['approved','preparing','out_for_delivery','completed'].includes(o.status)).length,
      rejected: visible.filter((o) => o.status === 'rejected').length,
      history: timeFiltered.filter(isInHistory).length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeFiltered, archivedIds]);

  const overduePending = useMemo(
    () => timeFiltered.some((o) => o.status === 'pending' && !isInHistory(o) && now - new Date(o.createdAt).getTime() > 60_000),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [timeFiltered, now, archivedIds]
  );

  // Apply status filter on top, then sort by priority (starred first)
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const arr = timeFiltered.filter((o) => {
      const inHistory = isInHistory(o);
      const matchesStatus = (() => {
        switch (statusFilter) {
          case 'history': return inHistory;
          case 'pending': return !inHistory && o.status === 'pending';
          case 'approved': return !inHistory && ['approved','preparing','out_for_delivery','completed'].includes(o.status);
          case 'rejected': return !inHistory && o.status === 'rejected';
          case 'active':
          default: return !inHistory;
        }
      })();
      if (!matchesStatus) return false;
      if (!q) return true;
      // Search across name, phone, address, items
      const itemsStr = o.items.map((i: any) => `${i.name?.sq || ''} ${i.name?.en || ''}`).join(' ').toLowerCase();
      return (
        o.customerName.toLowerCase().includes(q) ||
        o.customerPhone.toLowerCase().includes(q) ||
        o.deliveryAddress.toLowerCase().includes(q) ||
        itemsStr.includes(q) ||
        o.id.toLowerCase().includes(q)
      );
    });
    return arr.sort((a, b) => {
      const ap = priorityIds.has(a.id) ? 1 : 0;
      const bp = priorityIds.has(b.id) ? 1 : 0;
      if (ap !== bp) return bp - ap; // starred first
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeFiltered, statusFilter, archivedIds, priorityIds, searchQuery]);

  const selected = useMemo(() => orders.find((o) => o.id === selectedId) ?? null, [orders, selectedId]);

  const handleStatus = async (id: string, status: OrderStatus) => {
    try {
      await updateOrderStatus(id, status);
      toast.success(STATUS_LABEL[status] ?? status);

      // Auto-assign driver logic when an order gets approved
      if (status === 'approved') {
        const activeDrivers = drivers.filter(d => d.isActive);
        if (activeDrivers.length > 0) {
          const counts = new Map<string, number>();
          activeDrivers.forEach(d => counts.set(d.id, 0));
          orders.forEach(o => {
            if ((o.status === 'out_for_delivery' || o.status === 'preparing' || o.status === 'approved') && o.assignedDriverId) {
              counts.set(o.assignedDriverId, (counts.get(o.assignedDriverId) || 0) + 1);
            }
          });
          let bestDriver = activeDrivers[0];
          let minCount = Infinity;
          activeDrivers.forEach(d => {
            const c = counts.get(d.id) || 0;
            if (c < minCount) {
              minCount = c;
              bestDriver = d;
            }
          });
          try {
            await assignDriverToOrder(id, bestDriver.id);
            toast.success(`U caktua automatikisht tek shoferi: ${bestDriver.name}`);
          } catch (e) {
            console.error('Failed to auto assign', e);
          }
        }
      }
    }
    catch { toast.error('Gabim'); }
  };

  // Soft-delete: hide from Aktive immediately with a 1.6s "U fshi" fade,
  // then it remains in Histori (server-side is_visible=false).
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const handleDelete = async (id: string) => {
    if (deletingIds.has(id)) return;
    setDeletingIds((prev) => { const n = new Set(prev); n.add(id); return n; });
    try {
      await softDeleteOrder(id);
      toast.success('U fshi · ruajtur në Histori');
      // Local archive marker too, so it appears in Histori tab without refetch
      setArchivedIds((prev) => { const next = new Set(prev); next.add(id); saveArchive(next); return next; });
      setTimeout(() => {
        setDeletingIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
        if (selectedId === id) setSelectedId(null);
      }, 1600);
    } catch {
      toast.error('Gabim');
      setDeletingIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
    }
  };

  const handleHardDelete = async (id: string) => {
    if (!window.confirm('Fshi këtë porosi përfundimisht? Ky veprim nuk mund të zhbëhet.')) return;
    try { await deleteOrder(id); toast.success('U fshi përfundimisht'); if (selectedId === id) setSelectedId(null); }
    catch { toast.error('Gabim'); }
  };

  const handleRestore = async (id: string) => {
    try {
      await restoreOrder(id);
      setArchivedIds((prev) => { const next = new Set(prev); next.delete(id); saveArchive(next); return next; });
      toast.success('U rikthye');
    } catch { toast.error('Gabim'); }
  };

  const handleEta = async (o: OrderRecord, minutes: number) => {
    try { await setOrderEta(o.id, minutes); toast.success(`ETA: ${minutes} min`); }
    catch { toast.error('Gabim'); }
  };

  const handlePrint = (o: OrderRecord) => {
    generateInvoice(o);
  };

  const openDrawer = (o: OrderRecord, mode: 'approve' | 'reject') => {
    setDrawerOrder(o);
    setDrawerMode(mode);
  };

  const FilterTab = ({ k, label }: { k: FilterKey; label: string }) => (
    <button
      onClick={() => setFilter(k)}
      className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
        filter === k ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-4">
      {/* List */}
      <div className="space-y-3">
        {/* Search bar — logbook search across all customers/orders */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (e.target.value.trim() && filter !== 'all') setFilter('all');
            }}
            placeholder="Kërko: emër, telefon, adresë, produkt, ID…"
            className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-secondary border-0 text-sm focus:ring-2 focus:ring-primary/20 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-background"
              aria-label="Pastro"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Time-range tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          <FilterTab k="hour" label="Kjo orë" />
          <FilterTab k="today" label="Sot" />
          <FilterTab k="week" label="Kjo javë" />
          <FilterTab k="month" label="Ky muaj" />
          <FilterTab k="custom" label="Intervali" />
          <FilterTab k="all" label="Të gjitha" />
        </div>

        {(filter === 'custom' || statusFilter === 'history') && (
          <div className="flex flex-wrap items-center gap-2 bg-secondary/40 rounded-xl p-2.5 text-xs">
            <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
            <label className="flex items-center gap-1.5">
              <span className="text-muted-foreground font-medium">Prej</span>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => { setCustomFrom(e.target.value); if (filter !== 'custom') setFilter('custom'); }}
                className="bg-background rounded-lg px-2.5 py-1.5 border border-border/40 focus:ring-2 focus:ring-primary/20 focus:outline-none"
              />
            </label>
            <label className="flex items-center gap-1.5">
              <span className="text-muted-foreground font-medium">Deri</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => { setCustomTo(e.target.value); if (filter !== 'custom') setFilter('custom'); }}
                className="bg-background rounded-lg px-2.5 py-1.5 border border-border/40 focus:ring-2 focus:ring-primary/20 focus:outline-none"
              />
            </label>
            {(customFrom || customTo) && (
              <button
                type="button"
                onClick={() => { setCustomFrom(''); setCustomTo(''); }}
                className="text-[11px] text-primary font-semibold hover:underline ml-auto"
              >
                Pastro intervalin
              </button>
            )}
          </div>
        )}

        {/* Status filter buttons (clickable) — Duke pritur / Konfirmuar / Anuluar / Histori */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button
            onClick={() => setStatusFilter(statusFilter === 'pending' ? 'active' : 'pending')}
            className={`relative rounded-2xl p-3 text-left border transition-all active:scale-[0.98] ${
              statusFilter === 'pending'
                ? 'bg-amber-500/20 border-amber-500/50 ring-2 ring-amber-500/40'
                : 'bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/15'
            }`}
          >
            {overduePending && (
              <div className="absolute -top-1.5 -right-1.5 flex items-center justify-center">
                <span className="absolute inline-flex h-5 w-5 rounded-full bg-red-500 opacity-60 animate-ping" />
                <span className="relative inline-flex h-5 w-5 rounded-full bg-red-500 items-center justify-center shadow-lg shadow-red-500/50">
                  <AlertCircle className="w-3 h-3 text-white" strokeWidth={3} />
                </span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Hourglass className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <p className="text-[10px] uppercase tracking-wider font-semibold text-amber-700 dark:text-amber-300">Duke pritur</p>
            </div>
            <p className="text-2xl font-bold text-amber-700 dark:text-amber-300 mt-0.5">{counts.pending}</p>
          </button>

          <button
            onClick={() => setStatusFilter(statusFilter === 'approved' ? 'active' : 'approved')}
            className={`rounded-2xl p-3 text-left border transition-all active:scale-[0.98] ${
              statusFilter === 'approved'
                ? 'bg-emerald-500/20 border-emerald-500/50 ring-2 ring-emerald-500/40'
                : 'bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/15'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <p className="text-[10px] uppercase tracking-wider font-semibold text-emerald-700 dark:text-emerald-300">Konfirmuar</p>
            </div>
            <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">{counts.approved}</p>
          </button>

          <button
            onClick={() => setStatusFilter(statusFilter === 'rejected' ? 'active' : 'rejected')}
            className={`rounded-2xl p-3 text-left border transition-all active:scale-[0.98] ${
              statusFilter === 'rejected'
                ? 'bg-red-500/20 border-red-500/50 ring-2 ring-red-500/40'
                : 'bg-red-500/10 border-red-500/20 hover:bg-red-500/15'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <X className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
              <p className="text-[10px] uppercase tracking-wider font-semibold text-red-700 dark:text-red-300">Anuluar</p>
            </div>
            <p className="text-2xl font-bold text-red-700 dark:text-red-300 mt-0.5">{counts.rejected}</p>
          </button>

          <button
            onClick={() => setStatusFilter(statusFilter === 'history' ? 'active' : 'history')}
            className={`rounded-2xl p-3 text-left border transition-all active:scale-[0.98] ${
              statusFilter === 'history'
                ? 'bg-foreground/10 border-foreground/30 ring-2 ring-foreground/20'
                : 'bg-secondary/60 border-border hover:bg-secondary'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Histori</p>
            </div>
            <p className="text-2xl font-bold text-foreground mt-0.5">{counts.history}</p>
          </button>
        </div>

        <div className="flex items-center justify-between px-1">
          <p className="text-xs text-muted-foreground">
            {filtered.length} porosi · {
              statusFilter === 'history' ? 'Histori' :
              statusFilter === 'pending' ? 'Duke pritur' :
              statusFilter === 'approved' ? 'Konfirmuar' :
              statusFilter === 'rejected' ? 'Anuluar' :
              'Aktive'
            }
          </p>
          {statusFilter !== 'active' && statusFilter !== 'history' && (
            <button onClick={() => setStatusFilter('active')} className="text-[11px] text-primary font-medium hover:underline">
              Pastro filtrin
            </button>
          )}
        </div>

        {filtered.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-12">
            {statusFilter === 'history' ? 'Asnjë porosi në histori.' : 'Asnjë porosi në këtë interval.'}
          </p>
        )}

        <AnimatePresence initial={false}>
          {filtered.map((o) => {
            const isSelected = o.id === selectedId;
            const isGlowing = glowingIds.has(o.id);
            const isPending = o.status === 'pending';
            const isArchived = isInHistory(o);
            const isDeleting = deletingIds.has(o.id);
            const ageMs = now - new Date(o.createdAt).getTime();
            const isOverdue = isPending && ageMs > 60_000;
            return (
              <motion.div
                key={o.id}
                layout
                initial={{ x: -40, opacity: 0, scale: 0.96 }}
                animate={{ x: 0, opacity: isDeleting ? 0.45 : 1, scale: 1 }}
                exit={{ x: 300, opacity: 0, scale: 0.92 }}
                transition={{ type: 'spring', stiffness: 320, damping: 26 }}
                drag={!isPending && !isDeleting ? 'x' : false}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.4}
                onDragEnd={(_, info) => {
                  if (!isPending && Math.abs(info.offset.x) > 120) {
                    if (isArchived) unarchiveOrder(o.id);
                    else archiveOrder(o.id);
                  }
                }}
                className={`relative bg-card rounded-3xl p-4 shadow-card transition-all touch-pan-y ${
                  isSelected ? 'ring-2 ring-primary' :
                  isOverdue ? 'ring-2 ring-red-500/60 shadow-[0_0_24px_-4px_hsl(0_70%_50%/0.5)]' :
                  isGlowing ? 'ring-2 ring-primary/60 shadow-[0_0_24px_-4px_hsl(var(--primary)/0.5)]' :
                  'hover:shadow-md'
                } ${!isPending && !isDeleting ? 'cursor-grab active:cursor-grabbing' : ''} ${isDeleting ? 'pointer-events-none grayscale' : ''}`}
              >
                {/* Top-right action strip: Star (priority) + Delete / Restore */}
                <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); togglePriority(o.id); }}
                    className={`w-7 h-7 rounded-full flex items-center justify-center transition-all active:scale-90 ${
                      priorityIds.has(o.id)
                        ? 'bg-amber-400/20 text-amber-500 hover:bg-amber-400/30'
                        : 'text-muted-foreground/50 hover:text-amber-500 hover:bg-amber-400/10'
                    }`}
                    title={priorityIds.has(o.id) ? 'Hiq prioritetin' : 'Shëno si prioritet'}
                    aria-label="Prioritet"
                  >
                    <Star className="w-3.5 h-3.5" fill={priorityIds.has(o.id) ? 'currentColor' : 'none'} strokeWidth={2} />
                  </button>
                  {!isPending && !isArchived && !isDeleting && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(o.id); }}
                      className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-all active:scale-90"
                      title="Fshi (ruhet në Histori)"
                      aria-label="Fshi"
                    >
                      <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
                    </button>
                  )}
                  {isArchived && !isDeleting && (
                    <>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRestore(o.id); }}
                        className="text-[10px] font-bold uppercase tracking-wider px-2 h-7 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-all active:scale-90"
                        title="Riktheje në aktive"
                      >
                        Rikthe
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleHardDelete(o.id); }}
                        className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-all active:scale-90"
                        title="Fshi përfundimisht"
                        aria-label="Fshi përfundimisht"
                      >
                        <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
                      </button>
                    </>
                  )}
                </div>
                {isDeleting && (
                  <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
                    <span className="text-[11px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full bg-foreground/80 text-background shadow-lg">
                      U fshi
                    </span>
                  </div>
                )}
                {isOverdue && (
                  <div className="absolute -top-2 -left-2 z-10 flex items-center justify-center">
                    <span className="absolute inline-flex h-7 w-7 rounded-full bg-red-500 opacity-50 animate-ping" />
                    <span className="relative inline-flex h-7 w-7 rounded-full bg-red-500 items-center justify-center shadow-lg shadow-red-500/60">
                      <AlertCircle className="w-4 h-4 text-white" strokeWidth={3} />
                    </span>
                  </div>
                )}
                <button
                  onClick={() => setSelectedId(o.id)}
                  className="w-full text-left space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="font-semibold text-sm truncate">{o.customerName || 'Anonim'}</h3>
                        <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">
                          {o.source === 'app' ? <><Smartphone className="w-2.5 h-2.5" /> App</> : <><Globe className="w-2.5 h-2.5" /> Web</>}
                        </span>
                        {isArchived && (
                          <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-foreground/10 text-muted-foreground font-semibold uppercase tracking-wider">
                            E fshirë
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {o.customerPhone}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(o.createdAt).toLocaleString()}</p>
                    </div>
                    <span className={`text-[10px] px-2 py-1 rounded-full font-medium whitespace-nowrap ${statusColor(o.status)}`}>
                      {STATUS_LABEL[o.status] ?? o.status}
                    </span>
                  </div>

                  <div className="text-xs text-muted-foreground flex items-center justify-between gap-2">
                    <span className="truncate flex-1 inline-flex items-center gap-1">
                      <MapPin className="w-3 h-3 shrink-0 opacity-70" />
                      {o.deliveryAddress}
                    </span>
                    <span className="text-primary font-semibold shrink-0">€{o.total.toFixed(2)}</span>
                  </div>
                </button>

                {/* Tik / Iks actions for pending */}
                {isPending && (
                  <div className="flex items-center justify-end gap-2 pt-2 mt-1 border-t border-border/40">
                    <button
                      onClick={(e) => { e.stopPropagation(); openDrawer(o, 'reject'); }}
                      className="w-11 h-11 rounded-full bg-destructive/10 text-destructive flex items-center justify-center hover:bg-destructive/20 active:scale-95 transition-all"
                      aria-label="Anulo"
                    >
                      <X className="w-5 h-5" strokeWidth={2.5} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); openDrawer(o, 'approve'); }}
                      className="w-11 h-11 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 active:scale-95 shadow-md transition-all"
                      aria-label="Konfirmo"
                    >
                      <Check className="w-5 h-5" strokeWidth={2.5} />
                    </button>
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Detail panel */}
      <div className="lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100vh-100px)] lg:overflow-y-auto">
        {!selected && (
          <div className="bg-card rounded-3xl p-6 text-center text-sm text-muted-foreground shadow-card backdrop-blur-md">
            Zgjidh një porosi për të hapur detajet, hartën dhe chat.
          </div>
        )}
        {selected && (
          <div className="bg-card/90 backdrop-blur-xl rounded-3xl shadow-card overflow-hidden border border-border/40">
            <div className="p-4 border-b border-border/50 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-bold text-base flex items-center gap-2">
                  {selected.customerName}
                  <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">
                    {selected.source === 'app' ? <><Smartphone className="w-2.5 h-2.5" /> App</> : <><Globe className="w-2.5 h-2.5" /> Web</>}
                  </span>
                </h3>
                <a href={`tel:${selected.customerPhone}`} className="text-xs text-primary font-medium">{selected.customerPhone}</a>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => handlePrint(selected)} className="p-2 rounded-full hover:bg-secondary" title="Print"><Printer className="w-4 h-4" /></button>
                <button onClick={() => setSelectedId(null)} className="p-2 rounded-full hover:bg-secondary"><X className="w-4 h-4" /></button>
              </div>
            </div>

            <div className="p-4 space-y-4 text-xs">
              {/* Quick actions row — bigger, prominent */}
              <div className="grid grid-cols-4 gap-2">
                <a
                  href={`tel:${selected.customerPhone}`}
                  className="flex flex-col items-center justify-center gap-1 py-3 rounded-2xl bg-primary/10 text-primary hover:bg-primary/20 active:scale-95 transition-all"
                  title="Telefono"
                >
                  <Phone className="w-5 h-5" strokeWidth={2.4} />
                  <span className="text-[10px] font-semibold">Thirr</span>
                </a>
                <a
                  href={`https://wa.me/${selected.customerPhone.replace(/[^0-9]/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center justify-center gap-1 py-3 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 active:scale-95 transition-all"
                  title="WhatsApp"
                >
                  <MessageCircle className="w-5 h-5" strokeWidth={2.4} />
                  <span className="text-[10px] font-semibold">WhatsApp</span>
                </a>
                {selected.deliveryLat !== null && selected.deliveryLng !== null ? (
                  <a
                    href={`https://www.google.com/maps?q=${selected.deliveryLat},${selected.deliveryLng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col items-center justify-center gap-1 py-3 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 active:scale-95 transition-all"
                    title="Hap në Maps"
                  >
                    <Navigation className="w-5 h-5" strokeWidth={2.4} />
                    <span className="text-[10px] font-semibold">Navigo</span>
                  </a>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-1 py-3 rounded-2xl bg-secondary/40 text-muted-foreground/50">
                    <Navigation className="w-5 h-5" strokeWidth={2.4} />
                    <span className="text-[10px] font-semibold">Pa Map</span>
                  </div>
                )}
                <button
                  onClick={() => {
                    const text = `${selected.customerName}\n${selected.customerPhone}\n${selected.deliveryAddress}\n€${selected.total.toFixed(2)}`;
                    navigator.clipboard?.writeText(text).then(() => toast.success('U kopjua'));
                  }}
                  className="flex flex-col items-center justify-center gap-1 py-3 rounded-2xl bg-secondary text-foreground hover:bg-secondary/70 active:scale-95 transition-all"
                  title="Kopjo detajet"
                >
                  <Copy className="w-5 h-5" strokeWidth={2.4} />
                  <span className="text-[10px] font-semibold">Kopjo</span>
                </button>
              </div>

              {/* Order receipt */}
              <div className="bg-secondary/40 rounded-2xl p-3.5 space-y-1">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1.5">
                  <Receipt className="w-3 h-3" /> Porosia
                </div>
                {selected.items.map((it: any, i) => (
                  <div key={i} className="text-sm">• {it.quantity}x {it.name?.sq || it.name?.en || it.id}</div>
                ))}
                <div className="flex justify-between items-baseline font-bold pt-2 border-t border-border/50 mt-2">
                  <span className="text-sm">Totali</span>
                  <span className="text-primary text-lg">€{selected.total.toFixed(2)}</span>
                </div>
              </div>

              <div className="flex items-start gap-2 text-muted-foreground">
                <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <p className="leading-snug">{selected.deliveryAddress}</p>
              </div>

              {/* Routing map */}
              {selected.deliveryLat !== null && selected.deliveryLng !== null && (
                <DeliveryRouteMap
                  customerLat={selected.deliveryLat}
                  customerLng={selected.deliveryLng}
                  customerLabel={selected.customerName}
                />
              )}

              {selected.notes && (
                <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-300/50 dark:border-amber-500/30 rounded-xl px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-0.5">Shënim klienti</p>
                  <p className="italic text-foreground/90 text-xs">{selected.notes}</p>
                </div>
              )}

              {/* Pending: Big Aprovo / Refuzo */}
              {selected.status === 'pending' && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => openDrawer(selected, 'reject')}
                    className="flex items-center justify-center gap-2 py-4 rounded-2xl bg-destructive/10 text-destructive font-bold text-sm hover:bg-destructive/20 active:scale-95 transition-all"
                  >
                    <X className="w-5 h-5" strokeWidth={2.5} /> Refuzo
                  </button>
                  <button
                    onClick={() => openDrawer(selected, 'approve')}
                    className="flex items-center justify-center gap-2 py-4 rounded-2xl bg-primary text-primary-foreground font-bold text-sm shadow-lg shadow-primary/30 hover:bg-primary/90 active:scale-95 transition-all"
                  >
                    <Check className="w-5 h-5" strokeWidth={2.5} /> Aprovo
                  </button>
                </div>
              )}

              {(selected.status === 'approved' || selected.status === 'preparing' || selected.status === 'out_for_delivery') && (
                <div className="space-y-3 pt-1">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold flex items-center gap-1 mb-1.5">
                      <Clock className="w-3 h-3" /> ETA përgatitje {selected.prepEtaMinutes ? `· tani ${selected.prepEtaMinutes} min` : ''}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {[15, 20, 30, 45, 60].map((m) => (
                        <button key={m} onClick={() => handleEta(selected, m)}
                          className={`text-xs px-3 py-1.5 rounded-full font-semibold transition-all active:scale-95 ${selected.prepEtaMinutes === m ? 'bg-primary text-primary-foreground shadow' : 'bg-secondary hover:bg-primary/10'}`}>
                          {m} min
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1.5">Ndrysho status</p>
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        onClick={() => handleStatus(selected.id, 'preparing')}
                        disabled={selected.status === 'preparing'}
                        className="text-xs px-2 py-2.5 rounded-xl font-semibold bg-secondary hover:bg-primary/10 disabled:opacity-40 disabled:cursor-not-allowed inline-flex flex-col items-center gap-1 active:scale-95 transition-all"
                      >
                        <ChefHat className="w-4 h-4" /> Përgatit
                      </button>
                      <button
                        onClick={() => handleStatus(selected.id, 'out_for_delivery')}
                        disabled={selected.status === 'out_for_delivery'}
                        className="text-xs px-2 py-2.5 rounded-xl font-semibold bg-secondary hover:bg-primary/10 disabled:opacity-40 disabled:cursor-not-allowed inline-flex flex-col items-center gap-1 active:scale-95 transition-all"
                      >
                        <Bike className="w-4 h-4" /> Në rrugë
                      </button>
                      <button
                        onClick={() => handleStatus(selected.id, 'completed')}
                        className="text-xs px-2 py-2.5 rounded-xl font-bold bg-primary text-primary-foreground inline-flex flex-col items-center gap-1 shadow-md active:scale-95 transition-all"
                      >
                        <CheckCheck className="w-4 h-4" /> Përfundo
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Driver assignment */}
              {(selected.status === 'approved' || selected.status === 'preparing' || selected.status === 'out_for_delivery') && drivers.length > 0 && (
                <div className="bg-blue-500/5 rounded-2xl p-3 border border-blue-500/20">
                  <p className="text-[10px] uppercase tracking-wider text-blue-600 font-bold mb-2 flex items-center gap-1">
                    <Bike className="w-3 h-3" /> Cakto shoferin
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {drivers.map((d) => {
                      const isAssigned = (selected as any).assigned_driver_id === d.id;
                      return (
                        <button
                          key={d.id}
                          onClick={async () => {
                            try {
                              await assignDriverToOrder(selected.id, d.id);
                              toast.success(`Shoferi ${d.name} u caktua`);
                            } catch { toast.error('Gabim'); }
                          }}
                          className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all active:scale-95 ${
                            isAssigned
                              ? 'bg-blue-600 text-white shadow'
                              : 'bg-secondary hover:bg-blue-500/10'
                          }`}
                        >
                          {d.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {(selected.status === 'completed' || selected.status === 'rejected') && !isInHistory(selected) && (
                <button onClick={() => handleDelete(selected.id)} className="w-full py-3 rounded-2xl bg-destructive/10 text-destructive text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 hover:bg-destructive/20 transition-all">
                  <Trash2 className="w-4 h-4" /> Fshi · ruaj në Histori
                </button>
              )}

              {isInHistory(selected) && (
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => handleRestore(selected.id)} className="py-3 rounded-2xl bg-primary/10 text-primary text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 hover:bg-primary/20 transition-all">
                    <Check className="w-4 h-4" /> Rikthe
                  </button>
                  <button onClick={() => handleHardDelete(selected.id)} className="py-3 rounded-2xl bg-destructive/10 text-destructive text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 hover:bg-destructive/20 transition-all">
                    <Trash2 className="w-4 h-4" /> Fshi përfundimisht
                  </button>
                </div>
              )}

              {/* "Mbyll bisedën" — only available when order is mid-lifecycle (approved/preparing/out_for_delivery).
                  Marks the order as completed (which makes the user-side pill disappear via its own
                  TERMINAL auto-dismiss logic in OrderTrackingPill), then archives the chat transcript. */}
              {(selected.status === 'approved' || selected.status === 'preparing' || selected.status === 'out_for_delivery') && (
                <button
                  onClick={async () => {
                    if (!window.confirm('Mbyll bisedën dhe mark-o porosinë si të përfunduar?')) return;
                    try {
                      await updateOrderStatus(selected.id, 'completed');
                      // Archive + clear live chat so it disappears from user side too
                      const { deleteOrderMessages } = await import('@/lib/orderMessagesApi');
                      await deleteOrderMessages(selected.id);
                      toast.success('Biseda u mbyll · porosia u përfundua');
                    } catch {
                      toast.error('Gabim');
                    }
                  }}
                  className="w-full py-3 rounded-2xl bg-foreground/90 text-background text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 hover:bg-foreground transition-all"
                >
                  <CheckCheck className="w-4 h-4" /> Mbyll bisedën
                </button>
              )}

              {/* Chat — branded as PapirunChat; admin-side. If order is in History
                  (archived), show the archived transcript read-only instead. */}
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-2 flex items-center gap-1">
                  <MessageCircle className="w-3 h-3" /> PapirunChat · me klientin
                </p>
                {isInHistory(selected) ? (
                  <ArchivedChatView orderId={selected.id} />
                ) : (
                  <OrderChat orderId={selected.id} viewerSide="admin" disabled={false} maxHeightClass="max-h-80" allowDelete />
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Approve/Reject drawer — auto-select order on close so admin continues chatting */}
      <OrderActionDrawer
        order={drawerOrder}
        mode={drawerMode}
        onClose={() => {
          if (drawerOrder) setSelectedId(drawerOrder.id);
          setDrawerMode(null);
          setDrawerOrder(null);
        }}
      />
    </div>
  );
};

export default OrdersReview;
