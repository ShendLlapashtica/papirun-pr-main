import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, MapPin, Phone, Calendar, Smartphone, Globe, Clock, Printer, Trash2, ChefHat, Bike, CheckCheck, AlertCircle, Hourglass, Star, MessageCircle, Copy, Navigation, Receipt, Search, Download, Share2, Zap, Ban } from 'lucide-react';
import { toast } from 'sonner';
import {
  fetchAllOrders,
  subscribeAllOrdersRealtime,
  updateOrderStatus,
  softDeleteOrder,
  restoreOrder,
  setOrderEta,
  hardDeleteOrder,
  hardDeleteOrdersBatch,
  type OrderRecord,
  type OrderStatus,
} from '@/lib/ordersApi';
import OrderChat from '@/components/OrderChat';
import OrderActionDrawer from '@/components/admin/OrderActionDrawer';
import BulkAssignBar from '@/components/admin/BulkAssignBar';
import ClientsOverviewMap from '@/components/admin/ClientsOverviewMap';
import DeliveryRouteMap from '@/components/admin/DeliveryRouteMap';
import ArchivedChatView from '@/components/admin/ArchivedChatView';
import { generateInvoice } from '@/lib/invoiceGenerator';
import { assignDriverToOrder, fetchDrivers, fetchOrderAssignTimes, subscribeAllDriverLocations, driverShortCode, haversineKm, type DeliveryDriver } from '@/lib/driversApi';
import { pickBestDriver } from '@/components/admin/DriversKPI';
import DriverLocationMap from '@/components/DriverLocationMap';
import CustomerDriverMap from '@/components/CustomerDriverMap';
import { sendOrderMessage, subscribeOrderTyping, playTypingChime, playMessageChime } from '@/lib/orderMessagesApi';
import { supabase } from '@/integrations/supabase/client';
import { getOptimizedImage } from '@/lib/utils';

const statusColor = (s: string) => {
  if (s === 'pending') return 'bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/30 animate-pulse';
  if (s === 'approved' || s === 'preparing' || s === 'out_for_delivery') return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-500/30';
  if (s === 'rejected') return 'bg-red-500/15 text-red-700 dark:text-red-400 ring-1 ring-red-500/30';
  if (s === 'completed') return 'bg-primary/10 text-primary ring-1 ring-primary/20';
  return 'bg-secondary text-muted-foreground';
};

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

// Çagllavicë detection — uses suggestedLocation when set, falls back to address/coord for old orders
const isCagllavice = (o: OrderRecord): boolean => {
  if (o.suggestedLocation) return o.suggestedLocation === 'cagllavice';
  const addr = (o.deliveryAddress || '').toLowerCase();
  if (addr.includes('çagllavic') || addr.includes('cagllavic')) return true;
  if (o.deliveryLat !== null && o.deliveryLng !== null) {
    return o.deliveryLat >= 42.585 && o.deliveryLat <= 42.650 && o.deliveryLng >= 21.040 && o.deliveryLng <= 21.115;
  }
  return false;
};

const CATEGORY_LABEL: Record<string, string> = {
  salad: 'Salad',
  fajita: 'Fajita',
  sandwich: 'Sandwich',
  sides: 'Sides',
};

const CopyButton: React.FC<{ text: string; size?: 'sm' | 'md' }> = ({ text, size = 'sm' }) => {
  const [copied, setCopied] = React.useState(false);
  const iconCls = size === 'md' ? 'w-3.5 h-3.5' : 'w-3 h-3';
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      title="Kopjo"
      className="inline-flex items-center justify-center p-1 rounded-md bg-secondary/60 border border-border/40 text-muted-foreground hover:text-foreground hover:bg-secondary hover:border-border transition-colors shrink-0 ml-1"
    >
      {copied
        ? <Check className={`${iconCls} text-emerald-500`} />
        : <Copy className={iconCls} />}
    </button>
  );
};

interface GroupedOrderItem {
  id: string;
  name?: { sq: string; en: string };
  category?: string;
  image?: string;
  totalQty: number;
  modifiedItems: Array<{
    qty: number;
    removed: string[];
    extras: Array<{ name: { sq: string; en: string }; price: number }>;
  }>;
}

function groupOrderItems(items: any[]): GroupedOrderItem[] {
  const map = new Map<string, GroupedOrderItem>();
  for (const it of items) {
    if (!map.has(it.id)) {
      map.set(it.id, { id: it.id, name: it.name, category: it.category, image: it.image, totalQty: 0, modifiedItems: [] });
    }
    const entry = map.get(it.id)!;
    entry.totalQty += it.quantity ?? 1;
    if ((it.removedIngredients?.length ?? 0) > 0 || (it.addedExtras?.length ?? 0) > 0) {
      entry.modifiedItems.push({
        qty: it.quantity ?? 1,
        removed: it.removedIngredients ?? [],
        extras: it.addedExtras ?? [],
      });
    }
  }
  return Array.from(map.values());
}

const OrderItemsReceipt: React.FC<{ items: any[]; total: number }> = React.memo(({ items, total }) => {
  const grouped = groupOrderItems(items);
  const listText = formatOrderListText(items);
  return (
    <div className="bg-secondary/40 rounded-2xl p-3.5 space-y-1.5">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-wider font-bold text-muted-foreground dark:text-slate-400 mb-1.5">
        <span className="flex items-center gap-1.5"><Receipt className="w-3 h-3" /> Porosia</span>
        <CopyButton text={listText} size="md" />
      </div>
      {grouped.map((g) => (
        <div key={g.id} className="flex items-start gap-2">
          {g.image
            ? <img src={getOptimizedImage(g.image)} alt="" className="w-7 h-7 rounded-md object-cover shrink-0 mt-0.5 ring-1 ring-border/50" />
            : <div className="w-7 h-7 rounded-md bg-secondary shrink-0 mt-0.5 ring-1 ring-border/30" />
          }
          <div className="flex-1 min-w-0">
            <div className="text-sm flex items-center gap-1 flex-wrap">
              <span className="font-medium dark:text-white">{g.totalQty}x {g.name?.sq || g.name?.en || g.id}</span>
              {g.category && (
                <span className="text-[11px] font-normal text-muted-foreground">
                  ({CATEGORY_LABEL[g.category] ?? g.category})
                </span>
              )}
            </div>
            {g.modifiedItems.map((m, mi) => (
              <div key={mi} className="mt-0.5 text-xs flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                <span className="text-muted-foreground shrink-0">↳ {m.qty}x</span>
                {m.removed.map((r, ri) => (
                  <span key={`r${ri}`} className="px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 font-semibold text-[10px] border border-red-500/20">
                    Pa {r}
                  </span>
                ))}
                {m.extras.map((ex, ei) => (
                  <span key={`e${ei}`} className="px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold text-[10px] border border-emerald-500/20">
                    + {ex.name?.sq || ex.name?.en}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      ))}
      <div className="flex justify-between items-baseline font-bold pt-2 border-t border-border/50 mt-2">
        <span className="text-sm dark:text-slate-400">Totali</span>
        <span className="text-primary text-lg dark:text-emerald-400">€{total.toFixed(2)}</span>
      </div>
    </div>
  );
}, (prev, next) => {
  if (prev.items.length !== next.items.length) return false;
  return prev.items.every((it, i) =>
    it.id === next.items[i]?.id &&
    it.quantity === next.items[i]?.quantity &&
    (it.removedIngredients?.length ?? 0) === (next.items[i]?.removedIngredients?.length ?? 0) &&
    (it.addedExtras?.length ?? 0) === (next.items[i]?.addedExtras?.length ?? 0)
  );
});

function formatOrderListText(items: any[]): string {
  return groupOrderItems(items).map(g => {
    const name = g.name?.sq || g.name?.en || g.id;
    const cat = g.category ? ` (${CATEGORY_LABEL[g.category] ?? g.category})` : '';
    let line = `${g.totalQty}x ${name}${cat}`;
    if (g.modifiedItems.length > 0) {
      const subs = g.modifiedItems.map(m => {
        const parts = [
          ...m.removed.map(r => `Pa ${r}`),
          ...m.extras.map(e => `+ ${e.name?.sq || e.name?.en}`),
        ];
        return `  ↳ ${m.qty}x ${parts.join(' · ')}`;
      });
      line += '\n' + subs.join('\n');
    }
    return line;
  }).join('\n');
}

const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const startOfWeek = (d: Date) => {
  const x = startOfDay(d);
  const day = x.getDay();
  x.setDate(x.getDate() - (day + 6) % 7);
  return x;
};
const startOfMonth = (d: Date) => {
  const x = startOfDay(d);
  x.setDate(1);
  return x;
};

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

const AUTO_MODE_KEY = 'papirun_admin_auto_mode';
const loadAutoMode = (): boolean => { try { return localStorage.getItem(AUTO_MODE_KEY) === 'true'; } catch { return false; } };
const saveAutoMode = (v: boolean) => { try { localStorage.setItem(AUTO_MODE_KEY, v ? 'true' : 'false'); } catch {} };

type PezullimReason = 'traffic' | 'holiday' | 'custom';
const SUNDAY_MSG = 'Nuk punojme te dielen!';
const PEZULLIM_MESSAGES: Record<PezullimReason, string> = {
  traffic: 'Kemi shume porosi, ju lutem provoni me vone',
  holiday: 'Nuk punojme ne kete dite feste!',
  custom:  '',
};
const AUTO_PEZULLIM_KEY    = 'papirun_admin_auto_pezullim';
const PEZULLIM_REASON_KEY  = 'papirun_admin_pezullim_reason';
const CUSTOM_PEZULLIM_KEY  = 'papirun_admin_pezullim_custom';
const loadAutoPezullim     = (): boolean => { try { return localStorage.getItem(AUTO_PEZULLIM_KEY) === 'true'; } catch { return false; } };
const saveAutoPezullim     = (v: boolean) => { try { localStorage.setItem(AUTO_PEZULLIM_KEY, v ? 'true' : 'false'); } catch {} };
const loadPezullimReason   = (): PezullimReason | null => { try { return (localStorage.getItem(PEZULLIM_REASON_KEY) as PezullimReason) || null; } catch { return null; } };
const savePezullimReason   = (v: PezullimReason | null) => { try { v ? localStorage.setItem(PEZULLIM_REASON_KEY, v) : localStorage.removeItem(PEZULLIM_REASON_KEY); } catch {} };
const loadCustomPezullim   = (): string => { try { return localStorage.getItem(CUSTOM_PEZULLIM_KEY) || ''; } catch { return ''; } };
const saveCustomPezullim   = (v: string) => { try { localStorage.setItem(CUSTOM_PEZULLIM_KEY, v); } catch {} };

// ---- CSV/JSON export helpers ----
const exportOrdersCSV = (orders: OrderRecord[]) => {
  const header = 'ID,Emri,Telefon,Adresa,Totali,Statusi,Data,Artikujt';
  const rows = orders.map((o) => {
    const items = o.items.map((i: any) => `${i.quantity}x ${i.name?.sq || i.name?.en || i.id}`).join(' | ');
    const safe = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    return [o.id, safe(o.customerName), safe(o.customerPhone), safe(o.deliveryAddress), o.total.toFixed(2), o.status, o.createdAt, safe(items)].join(',');
  });
  const blob = new Blob([header + '\n' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `papirun-histori-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

const exportOrdersJSON = (orders: OrderRecord[]) => {
  const blob = new Blob([JSON.stringify(orders, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `papirun-histori-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

// ---- Cluster finder: groups orders whose delivery coords are within 2km of each other ----
function findBestCluster(orders: OrderRecord[]): OrderRecord[] | null {
  const geo = orders.filter((o) => o.deliveryLat && o.deliveryLng && ['pending', 'approved'].includes(o.status));
  if (geo.length < 3) return null;
  let best: OrderRecord[] = [];
  for (let i = 0; i < geo.length; i++) {
    const cluster = [geo[i]];
    for (let j = 0; j < geo.length; j++) {
      if (i === j) continue;
      const dist = haversineKm(geo[i].deliveryLat!, geo[i].deliveryLng!, geo[j].deliveryLat!, geo[j].deliveryLng!);
      if (dist <= 2.0) cluster.push(geo[j]);
    }
    if (cluster.length > best.length) best = cluster;
  }
  return best.length >= 3 ? best.slice(0, 5) : null;
}

// ---- Confirm-text delete dialog ----
const CONFIRM_PHRASE = 'konfirmoj fshirjen';

interface ConfirmDeleteDialogProps {
  title: string;
  description: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDeleteDialog = ({ title, description, onConfirm, onCancel }: ConfirmDeleteDialogProps) => {
  const [text, setText] = useState('');
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-foreground/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-background rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4">
        <h3 className="font-bold text-base text-destructive">{title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
        <p className="text-xs text-muted-foreground">
          Shkruaj <strong className="text-foreground font-mono">{CONFIRM_PHRASE}</strong> për të vazhduar:
        </p>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={CONFIRM_PHRASE}
          autoFocus
          className="w-full px-4 py-2.5 rounded-xl bg-secondary text-sm focus:outline-none focus:ring-2 focus:ring-destructive/30"
        />
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl bg-secondary text-sm font-semibold hover:bg-secondary/80 transition-colors"
          >
            Anulo
          </button>
          <button
            disabled={text !== CONFIRM_PHRASE}
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl bg-destructive text-destructive-foreground text-sm font-semibold transition-all disabled:opacity-40 hover:bg-destructive/90 active:scale-[0.98]"
          >
            Fshi
          </button>
        </div>
      </div>
    </div>
  );
};

type UnreadEntry = { count: number; firstMsgTs: number; sender: 'user' | 'driver' };

const OrdersReview = ({
  caglOnly = false,
  onTypingCount,
  onUnreadChange,
  highlightId,
}: {
  caglOnly?: boolean;
  onTypingCount?: (n: number) => void;
  onUnreadChange?: (list: Array<{ id: string; name: string; count: number; urgent: boolean }>) => void;
  highlightId?: string | null;
} = {}) => {
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [filter, setFilter] = useState<FilterKey>('month');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [locationFilter, setLocationFilter] = useState<'all' | 'qender' | 'cagllavice'>('all');
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
  const [showDriverMap, setShowDriverMap] = useState(false);
  const [autoMode, setAutoMode] = useState(() => loadAutoMode());
  const [showAutoModeConfirm, setShowAutoModeConfirm] = useState(false);
  const autoModeRef = useRef(false);
  const isSunday = new Date().getDay() === 0;
  const [autoPezullim, setAutoPezullim] = useState(() => loadAutoPezullim());
  const [pezullimReason, setPezullimReason] = useState<PezullimReason | null>(() => loadPezullimReason());
  const [customPezullimMsg, setCustomPezullimMsg] = useState(() => loadCustomPezullim());
  const [showPezullimModal, setShowPezullimModal] = useState(false);
  const [pendingReason, setPendingReason] = useState<PezullimReason | null>(null);
  const [pendingCustomMsg, setPendingCustomMsg] = useState('');
  const autoPezullimRef = useRef(autoPezullim);
  const pezullimReasonRef = useRef(pezullimReason);
  const customPezullimMsgRef = useRef(customPezullimMsg);
  const driversRef = useRef<DeliveryDriver[]>([]);
  const [assignTimes, setAssignTimes] = useState<Record<string, number>>({});
  const assignAlarmFiredRef = useRef<Set<string>>(new Set());
  const lastArchiveDateRef = useRef('');
  const [massSelectMode, setMassSelectMode] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [showClientsMap, setShowClientsMap] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [typingMap, setTypingMap] = useState<Record<string, { client?: number; staff?: number }>>({});
  const [newMsgMap, setNewMsgMap] = useState<Record<string, { count: number; firstMsgTs: number; sender: 'user' | 'driver' }>>({});

  // Confirm-delete dialog state
  const [confirmDeleteTarget, setConfirmDeleteTarget] = useState<{ id: string } | { all: true } | null>(null);
  // Close-chat confirm (replaces window.confirm — blocked in iOS PWA)
  const [closeChatTarget, setCloseChatTarget] = useState<string | null>(null);

  // Tracks whether we're on a lg+ breakpoint — used to route inline vs sidebar detail
  const [isLg, setIsLg] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches
  );
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const handler = (e: MediaQueryListEvent) => setIsLg(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Scroll the inline detail into view on mobile when a card is tapped
  useEffect(() => {
    if (!selectedId || isLg) return;
    const t = setTimeout(() => {
      const el = document.querySelector(`[data-detail-id="${selectedId}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 120);
    return () => clearTimeout(t);
  }, [selectedId, isLg]);

  useEffect(() => {
    const reload = () => fetchDrivers().then((d) => setDrivers(d.filter((x) => x.isActive))).catch(() => {});
    reload();
    // Refresh driver list (incl. locations) on real-time updates
    const unsub = subscribeAllDriverLocations(reload);
    return unsub;
  }, []);

  useEffect(() => { autoModeRef.current = autoMode; saveAutoMode(autoMode); }, [autoMode]);
  useEffect(() => { autoPezullimRef.current = autoPezullim; saveAutoPezullim(autoPezullim); }, [autoPezullim]);
  useEffect(() => { pezullimReasonRef.current = pezullimReason; savePezullimReason(pezullimReason); }, [pezullimReason]);
  useEffect(() => { customPezullimMsgRef.current = customPezullimMsg; saveCustomPezullim(customPezullimMsg); }, [customPezullimMsg]);
  // Auto-activate pezullim when both stations are inactive
  useEffect(() => {
    if (isSunday || autoPezullimRef.current) return;
    import('@/lib/locationsApi').then(({ fetchLocations }) => {
      fetchLocations().then((locs) => {
        if (locs.length >= 2 && locs.every((l) => !l.isActive)) {
          setAutoPezullim(true);
          setPezullimReason('holiday');
        }
      }).catch(() => {});
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { driversRef.current = drivers; }, [drivers]);

  // Fetch assignment timestamps when assigned orders change
  useEffect(() => {
    const assignedIds = orders
      .filter((o) => o.assignedDriverId && o.status === 'approved')
      .map((o) => o.id);
    if (assignedIds.length === 0) return;
    fetchOrderAssignTimes(assignedIds).then(setAssignTimes).catch(() => {});
  }, [orders]);

  // 1-minute alarm: kling + alarm ref when driver hasn't accepted after 60s
  useEffect(() => {
    const ALARM_MS = 60_000;
    const unaccepted = orders.filter(
      (o) => o.assignedDriverId && o.status === 'approved' && assignTimes[o.id] && now - assignTimes[o.id] > ALARM_MS
    );
    for (const o of unaccepted) {
      if (!assignAlarmFiredRef.current.has(o.id)) {
        assignAlarmFiredRef.current.add(o.id);
        playDing();
      }
    }
    // Clear from alarm ref when order is no longer 'approved'
    for (const id of Array.from(assignAlarmFiredRef.current)) {
      const o = orders.find((x) => x.id === id);
      if (!o || o.status !== 'approved') assignAlarmFiredRef.current.delete(id);
    }
  }, [orders, assignTimes, now]);

  // Midnight auto-archive — orders from before today that are not pending go to history
  useEffect(() => {
    if (orders.length === 0) return;
    const todayStr = new Date().toLocaleDateString();
    if (lastArchiveDateRef.current === todayStr) return; // already ran today
    lastArchiveDateRef.current = todayStr;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const stale = orders.filter(
      (o) =>
        o.isVisible !== false &&
        (o.status as string) !== 'histori' &&
        o.status !== 'pending' &&
        new Date(o.createdAt).getTime() < todayStart.getTime()
    );
    if (stale.length === 0) return;

    setArchivedIds((prev) => {
      const next = new Set(prev);
      stale.forEach((o) => next.add(o.id));
      saveArchive(next);
      return next;
    });
    stale.forEach((o) => softDeleteOrder(o.id).catch(() => {}));

    // Re-run at next midnight (reset guard so tomorrow's archive fires)
    const now = new Date();
    const nextMidnight = new Date(now);
    nextMidnight.setDate(nextMidnight.getDate() + 1);
    nextMidnight.setHours(0, 0, 0, 0);
    const t = setTimeout(() => { lastArchiveDateRef.current = ''; }, nextMidnight.getTime() - now.getTime());
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders]);

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
      if (next.has(id)) next.delete(id); else next.add(id);
      savePriority(next);
      return next;
    });
  };

  useEffect(() => {
    const sync = async () => {
      try {
        const all = await fetchAllOrders();
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

            const isSundayNow = new Date().getDay() === 0;
            if (isSundayNow || autoPezullimRef.current) {
              const msg = isSundayNow
                ? SUNDAY_MSG
                : pezullimReasonRef.current === 'custom'
                  ? (customPezullimMsgRef.current || 'Aktualisht nuk pranojme porosi')
                  : PEZULLIM_MESSAGES[pezullimReasonRef.current!];
              const pendingNew = newOnes.filter((o) => o.status === 'pending');
              for (const o of pendingNew) {
                (async () => {
                  try {
                    await sendOrderMessage(o.id, 'admin', msg);
                    await updateOrderStatus(o.id, 'rejected', msg);
                  } catch (e) { console.error('Auto-pezullim failed:', e); }
                })();
              }
            } else if (autoModeRef.current) {
              const pendingNew = newOnes.filter((o) => o.status === 'pending');
              for (const o of pendingNew) {
                const DEFAULT_ETA = 20;
                const autoMsg = `Po e përgatisim — gati për ~${DEFAULT_ETA} min ✓`;
                (async () => {
                  try {
                    await sendOrderMessage(o.id, 'admin', autoMsg);
                    await updateOrderStatus(o.id, 'approved', '');
                    await setOrderEta(o.id, DEFAULT_ETA);
                    const bestId = pickBestDriver(driversRef.current, all);
                    if (bestId) {
                      const target = driversRef.current.find((d) => d.id === bestId);
                      if (target) await assignDriverToOrder(o.id, target.id, { customerName: o.customerName, address: o.deliveryAddress, total: o.total });
                    }
                  } catch (e) { console.error('Auto-accept failed:', e); }
                })();
              }
            }
          }
        }
        all.forEach((o) => seenIdsRef.current.add(o.id));
        initializedRef.current = true;
        setOrders(all);
      } catch (e) { console.error(e); }
    };
    sync();
    const unsub = subscribeAllOrdersRealtime(sync);
    // Polling fallback every 12s in case realtime misses events
    const poll = setInterval(sync, 4000);
    return () => { unsub(); clearInterval(poll); };
  }, []);

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

  const isInHistory = (o: OrderRecord) => o.isVisible === false || archivedIds.has(o.id) || o.status === 'histori';

  const counts = useMemo(() => {
    const visible = timeFiltered.filter((o) => !isInHistory(o));
    return {
      pending: visible.filter((o) => o.status === 'pending').length,
      approved: visible.filter((o) => ['approved', 'preparing', 'out_for_delivery', 'completed'].includes(o.status)).length,
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

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const arr = timeFiltered.filter((o) => {
      const inHistory = isInHistory(o);
      const matchesStatus = (() => {
        switch (statusFilter) {
          case 'history': return inHistory;
          case 'pending': return !inHistory && o.status === 'pending';
          case 'approved': return !inHistory && ['approved', 'preparing', 'out_for_delivery', 'completed'].includes(o.status);
          case 'rejected': return !inHistory && o.status === 'rejected';
          case 'active':
          default: return !inHistory;
        }
      })();
      if (!matchesStatus) return false;
      const effectiveLocFilter = caglOnly ? 'cagllavice' : locationFilter;
      if (effectiveLocFilter === 'cagllavice' && !isCagllavice(o)) return false;
      if (effectiveLocFilter === 'qender' && isCagllavice(o)) return false;
      if (!q) return true;
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
      if (ap !== bp) return bp - ap;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeFiltered, statusFilter, archivedIds, priorityIds, searchQuery, caglOnly, locationFilter]);

  const selected = useMemo(() => orders.find((o) => o.id === selectedId) ?? null, [orders, selectedId]);

  // Track last typing timestamp per order to gate SFX to first event only
  const typingMapRef = React.useRef<Record<string, { client?: number; staff?: number }>>({});
  typingMapRef.current = typingMap;

  // Subscribe to typing presence — hub-based, instant delivery
  const filteredIdKey = filtered.map((o) => o.id).join(',');
  useEffect(() => {
    const unsubs = filtered.map((o) =>
      subscribeOrderTyping(o.id, (role) => {
        const key = role === 'user' ? 'client' : 'staff';
        const prev = typingMapRef.current[o.id]?.[key];
        // Play chime only on fresh start (no recent event in last 7s)
        if (!prev || Date.now() - prev > 7000) playTypingChime();
        setTypingMap((pm) => ({
          ...pm,
          [o.id]: { ...pm[o.id], ...(role === 'user' ? { client: Date.now() } : { staff: Date.now() }) },
        }));
      })
    );
    const tick = setInterval(() => {
      setTypingMap((prev) => {
        const now = Date.now();
        const next = { ...prev };
        for (const id of Object.keys(next)) {
          if (next[id].client && now - next[id].client! > 7000) delete next[id].client;
          if (next[id].staff && now - next[id].staff! > 7000) delete next[id].staff;
          if (!next[id].client && !next[id].staff) delete next[id];
        }
        return next;
      });
    }, 1000);
    return () => { unsubs.forEach((u) => u()); clearInterval(tick); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredIdKey]);

  // Bell badge = unread messages + active typing orders
  useEffect(() => {
    const msgCount = Object.values(newMsgMap).reduce((s, v) => s + v.count, 0);
    const typCount = Object.keys(typingMap).length;
    onTypingCount?.(msgCount + typCount);
  }, [newMsgMap, typingMap, onTypingCount]);

  // Emit unread list for the bell dropdown
  useEffect(() => {
    const now = Date.now();
    const list = orders
      .filter((o) => newMsgMap[o.id])
      .map((o) => ({
        id: o.id,
        name: o.customerName || 'Anonim',
        count: newMsgMap[o.id].count,
        urgent: now - newMsgMap[o.id].firstMsgTs > 3 * 60 * 1000,
      }));
    onUnreadChange?.(list);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newMsgMap, orders]);

  // Jump to order when highlightId changes (triggered from bell dropdown)
  useEffect(() => {
    if (!highlightId) return;
    const target = orders.find((o) => o.id === highlightId);
    if (!target) return;
    setSelectedId(highlightId);
    if (isInHistory(target)) setStatusFilter('history');
    else setStatusFilter('active');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightId]);

  // Per-order message subscriptions — filtered postgres_changes (same pattern as subscribeOrderMessages,
  // which is proven to work). Re-subscribe when the orders list changes.
  const ordersIdKey = orders.map((o) => o.id).join(',');
  useEffect(() => {
    if (orders.length === 0) return;
    const unsubs = orders.map((o) => {
      const ch = (supabase as any)
        .channel(`admin-msg-${o.id}-${Date.now()}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'order_messages', filter: `order_id=eq.${o.id}` },
          (payload: any) => {
            const { sender } = payload.new ?? {};
            if (sender === 'user' || sender === 'driver') {
              playMessageChime();
              setNewMsgMap((prev) => {
                const ex = prev[o.id];
                return { ...prev, [o.id]: { count: (ex?.count ?? 0) + 1, firstMsgTs: ex?.firstMsgTs ?? Date.now(), sender: sender as 'user' | 'driver' } };
              });
            }
            if (sender === 'admin' || sender === 'driver') {
              setNewMsgMap((prev) => {
                if (!prev[o.id]) return prev;
                const { [o.id]: _, ...rest } = prev;
                return rest;
              });
            }
          },
        )
        .subscribe();
      return () => (supabase as any).removeChannel(ch);
    });
    return () => unsubs.forEach((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ordersIdKey]);

  // Restore unread notification state from DB on mount/reload so notifications survive page refresh.
  // An order has ClientGotHisAnswer=false when its newest messages are all from 'user' with no
  // subsequent admin or driver reply.
  useEffect(() => {
    const activeOrders = orders.filter((o) => !isInHistory(o));
    if (activeOrders.length === 0) return;
    const orderIds = activeOrders.map((o) => o.id);
    let cancelled = false;

    (async () => {
      const { data } = await (supabase as any)
        .from('order_messages')
        .select('order_id, sender, created_at')
        .in('order_id', orderIds)
        .order('created_at', { ascending: false });

      if (cancelled || !data?.length) return;

      const byOrder = new Map<string, Array<{ sender: string; created_at: string }>>();
      for (const row of data) {
        if (!byOrder.has(row.order_id)) byOrder.set(row.order_id, []);
        byOrder.get(row.order_id)!.push(row);
      }

      const hydrated: Record<string, { count: number; firstMsgTs: number; sender: 'user' | 'driver' }> = {};
      for (const [orderId, msgs] of byOrder.entries()) {
        let count = 0;
        let firstTs = Date.now();
        for (const msg of msgs) {
          if (msg.sender === 'admin' || msg.sender === 'driver') break;
          if (msg.sender === 'user') {
            count++;
            firstTs = new Date(msg.created_at).getTime();
          }
        }
        if (count > 0) {
          hydrated[orderId] = { count, firstMsgTs: firstTs, sender: 'user' };
        }
      }

      setNewMsgMap(hydrated);
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ordersIdKey, archivedIds]);

  const handleStatus = async (id: string, status: OrderStatus) => {
    try {
      await updateOrderStatus(id, status);
      toast.success(STATUS_LABEL[status] ?? status);
    } catch { toast.error('Gabim'); }
  };

  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const handleDelete = async (id: string) => {
    if (deletingIds.has(id)) return;
    setDeletingIds((prev) => { const n = new Set(prev); n.add(id); return n; });
    try {
      await softDeleteOrder(id);
      toast.success('U fshi · ruajtur në Histori');
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

  const performHardDelete = async (id: string) => {
    try {
      await hardDeleteOrder(id);
      toast.success('U fshi përfundimisht');
      setArchivedIds((prev) => { const next = new Set(prev); next.delete(id); saveArchive(next); return next; });
      if (selectedId === id) setSelectedId(null);
    } catch { toast.error('Gabim'); }
  };

  const performHardDeleteAll = async (ids: string[]) => {
    try {
      await hardDeleteOrdersBatch(ids);
      setArchivedIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        saveArchive(next);
        return next;
      });
      if (ids.includes(selectedId ?? '')) setSelectedId(null);
      toast.success(`U fshinë ${ids.length} porosi`);
    } catch { toast.error('Gabim'); }
  };

  const handleRestore = async (id: string) => {
    try {
      await restoreOrder(id);
      setArchivedIds((prev) => { const next = new Set(prev); next.delete(id); saveArchive(next); return next; });
      toast.success('U rikthye');
    } catch { toast.error('Gabim'); }
  };

  const handleBulkSoftDelete = async () => {
    const ids = Array.from(selectedOrderIds);
    await Promise.all(ids.map((id) => softDeleteOrder(id).catch(() => {})));
    setArchivedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      saveArchive(next);
      return next;
    });
    if (ids.includes(selectedId ?? '')) setSelectedId(null);
    toast.success(`${ids.length} porosi → Histori`);
    setMassSelectMode(false);
    setSelectedOrderIds(new Set());
    setShowBulkDeleteConfirm(false);
  };

  const handleEta = async (o: OrderRecord, minutes: number) => {
    try { await setOrderEta(o.id, minutes); toast.success(`ETA: ${minutes} min`); }
    catch { toast.error('Gabim'); }
  };

  const handlePrint = (o: OrderRecord) => { generateInvoice(o); };

  const handleCloseChat = async (orderId: string) => {
    setCloseChatTarget(null);
    try {
      await updateOrderStatus(orderId, 'completed');
      const { deleteOrderMessages } = await import('@/lib/orderMessagesApi');
      await deleteOrderMessages(orderId);
      toast.success('Biseda u mbyll · porosia u përfundua');
    } catch { toast.error('Gabim'); }
  };

  const openDrawer = (o: OrderRecord, mode: 'approve' | 'reject') => {
    setDrawerOrder(o);
    setDrawerMode(mode);
  };

  const handleForwardToDriver = async (o: OrderRecord) => {
    if (!o.assignedDriverId) {
      toast.error('Nuk ka shofer të caktuar ende');
      return;
    }
    try {
      const driverName = drivers.find((d) => d.id === o.assignedDriverId)?.name ?? 'Shoferi';
      await sendOrderMessage(o.id, 'admin', `🚴 ${driverName} do të kujdeset për dërgesën tuaj.`);
      toast.success(`Biseda u kalua tek ${driverName}`);
    } catch { toast.error('Gabim'); }
  };

  const historyOrders = useMemo(
    () => timeFiltered.filter(isInHistory),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [timeFiltered, archivedIds]
  );

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
      {/* Auto-Mode confirmation dialog */}
      {showAutoModeConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-foreground/50 backdrop-blur-sm" onClick={() => setShowAutoModeConfirm(false)} />
          <div className="relative bg-background rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-600 flex items-center justify-center shrink-0">
                <Zap className="w-5 h-5" />
              </span>
              <h3 className="font-bold text-base">Aktivizo Auto-Mode?</h3>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Porositë e reja do të pranohen <strong className="text-foreground">automatikisht</strong> dhe do t'i caktohen shoferit idle — pa asnjë konfirmim manual.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowAutoModeConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-secondary text-sm font-semibold hover:bg-secondary/80 transition-colors"
              >
                Anulo
              </button>
              <button
                onClick={() => { setAutoMode(true); setShowAutoModeConfirm(false); }}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 active:scale-[0.98] transition-all"
              >
                Aktivizo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pezullim reason picker */}
      {showPezullimModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-foreground/50 backdrop-blur-sm" onClick={() => setShowPezullimModal(false)} />
          <div className="relative bg-card rounded-2xl p-5 w-full max-w-sm shadow-xl space-y-3 border border-border">
            <p className="font-bold text-sm text-foreground">Zgjidh arsyen e pezullimit</p>
            {(['traffic', 'holiday'] as PezullimReason[]).map((r) => (
              <button key={r} onClick={() => setPendingReason(r)}
                className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                  pendingReason === r ? 'bg-primary/10 border-primary' : 'bg-secondary border-transparent hover:border-border'
                }`}
              >
                <div className="font-bold text-xs text-foreground">
                  {r === 'traffic' ? 'Trafik i rende' : 'Dite feste'}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{PEZULLIM_MESSAGES[r]}</div>
              </button>
            ))}
            <button onClick={() => setPendingReason('custom')}
              className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                pendingReason === 'custom' ? 'bg-primary/10 border-primary' : 'bg-secondary border-transparent hover:border-border'
              }`}
            >
              <div className="font-bold text-xs text-foreground">Tjeter arsye</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">Shkruaj arsyen vete</div>
            </button>
            {pendingReason === 'custom' && (
              <textarea
                autoFocus
                value={pendingCustomMsg}
                onChange={(e) => setPendingCustomMsg(e.target.value)}
                placeholder="p.sh. Jemi ne pushim, hapemi neser..."
                rows={2}
                className="w-full px-3 py-2 rounded-xl bg-secondary text-foreground text-xs placeholder:text-muted-foreground border border-border focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              />
            )}
            <div className="flex gap-2 pt-1">
              <button
                disabled={!pendingReason || (pendingReason === 'custom' && !pendingCustomMsg.trim())}
                onClick={() => {
                  if (pendingReason === 'custom') setCustomPezullimMsg(pendingCustomMsg.trim());
                  setPezullimReason(pendingReason!);
                  setAutoPezullim(true);
                  setShowPezullimModal(false);
                }}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 active:scale-[0.98] transition-all disabled:opacity-40"
              >
                Aktivizo Pezullimin
              </button>
              <button onClick={() => setShowPezullimModal(false)}
                className="px-4 py-2.5 rounded-xl bg-secondary text-sm font-semibold text-foreground hover:bg-secondary/80 transition-colors"
              >
                Anulo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk soft-delete confirm */}
      {showBulkDeleteConfirm && (
        <ConfirmDeleteDialog
          title={`Fshi ${selectedOrderIds.size} porosi → Histori`}
          description={`${selectedOrderIds.size} porosi të zgjedhura do të lëvizen në histori (mund të rikthehen). Ky veprim nuk fshi të dhënat përfundimisht.`}
          onConfirm={handleBulkSoftDelete}
          onCancel={() => setShowBulkDeleteConfirm(false)}
        />
      )}

      {/* Confirm-delete dialog */}
      {confirmDeleteTarget && (
        <ConfirmDeleteDialog
          title={'all' in confirmDeleteTarget ? 'Fshij të gjithë historinë' : 'Fshij porosinë përfundimisht'}
          description={
            'all' in confirmDeleteTarget
              ? `Do të fshihen ${historyOrders.length} porosi përfundimisht nga databaza. Ky veprim nuk mund të zhbëhet.`
              : 'Kjo porosi do të fshihet përfundimisht nga databaza. Ky veprim nuk mund të zhbëhet.'
          }
          onConfirm={async () => {
            if ('all' in confirmDeleteTarget) {
              await performHardDeleteAll(historyOrders.map((o) => o.id));
            } else {
              await performHardDelete(confirmDeleteTarget.id);
            }
            setConfirmDeleteTarget(null);
          }}
          onCancel={() => setConfirmDeleteTarget(null)}
        />
      )}

      {/* List */}
      <div className="space-y-3 overflow-y-auto" style={{ maxHeight: 'calc(100svh - 160px)' }}>
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

        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          <FilterTab k="hour" label="Kjo orë" />
          <FilterTab k="today" label="Sot" />
          <FilterTab k="week" label="Kjo javë" />
          <FilterTab k="month" label="Ky muaj" />
          <FilterTab k="custom" label="Intervali" />
          <FilterTab k="all" label="Të gjitha" />
        </div>

        {/* Location filter — hidden in caglOnly mode (AdminCg always shows cagllavice) */}
        {!caglOnly && (
          <div className="flex items-center gap-1.5">
            {([
              { key: 'all',        label: 'Të gjitha',   style: 'bg-secondary text-muted-foreground' },
              { key: 'qender',     label: 'Q Qendër',     style: 'bg-primary/10 text-primary' },
              { key: 'cagllavice', label: 'C Çagllavicë', style: 'bg-blue-500/10 text-blue-600' },
            ] as const).map(({ key, label, style }) => (
              <button
                key={key}
                onClick={() => setLocationFilter(key)}
                className={`px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all ${
                  locationFilter === key
                    ? `${style} ring-2 ring-offset-1 ring-current/30 shadow-sm`
                    : 'bg-secondary/60 text-muted-foreground hover:bg-secondary'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

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

        {/* 1-min unaccepted banner */}
        {(() => {
          const ALARM_MS = 60_000;
          const unaccepted = orders.filter(
            (o) => o.assignedDriverId && o.status === 'approved' && !isInHistory(o) && assignTimes[o.id] && now - assignTimes[o.id] > ALARM_MS
          );
          if (unaccepted.length === 0) return null;
          const driverName = (o: OrderRecord) => drivers.find((d) => d.id === o.assignedDriverId)?.name ?? 'Shoferi';
          return (
            <div className="rounded-2xl bg-red-500/10 border border-red-500/40 ring-1 ring-red-400/30 p-3 space-y-1.5 animate-pulse">
              <div className="flex items-center gap-2 text-red-600 font-bold text-xs uppercase tracking-wider">
                <AlertCircle className="w-4 h-4 shrink-0" />
                Shoferi nuk ka pranuar — më shumë se 1 min!
              </div>
              {unaccepted.map((o) => (
                <div key={o.id} className="flex items-center justify-between text-xs bg-background/60 rounded-xl px-3 py-2">
                  <span className="font-semibold">{o.customerName}</span>
                  <span className="text-red-600 font-mono font-bold">{driverName(o)} · {Math.floor((now - assignTimes[o.id]) / 60_000)}m {Math.floor(((now - assignTimes[o.id]) % 60_000) / 1000)}s</span>
                </div>
              ))}
            </div>
          );
        })()}

        {/* Auto-Mode toggle + Clients Map */}
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => setShowClientsMap((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold transition-colors ${
              showClientsMap ? 'bg-indigo-600 text-white' : 'bg-secondary text-muted-foreground hover:bg-indigo-500/10'
            }`}
          >
            🗺️ Harta e klientëve
          </button>
          <button
            onClick={() => autoMode ? setAutoMode(false) : setShowAutoModeConfirm(true)}
            className={`relative flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all ${
              autoMode
                ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/40 animate-pulse'
                : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
            }`}
          >
            <Zap className={`w-3.5 h-3.5 ${autoMode ? 'fill-white' : ''}`} />
            {autoMode ? 'AUTO-MODE ON' : 'Auto-Mode OFF'}
            {autoMode && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-300 rounded-full animate-ping" />
            )}
          </button>
          <button
            onClick={() => {
              if (isSunday) return;
              if (autoPezullim) { setAutoPezullim(false); setPezullimReason(null); }
              else { setPendingReason(null); setPendingCustomMsg(''); setShowPezullimModal(true); }
            }}
            title={isSunday ? 'E Diele — refuzim automatik i pandryshueshem' : undefined}
            className={`relative flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all ${
              autoPezullim || isSunday
                ? 'bg-red-500 text-white shadow-lg shadow-red-500/40 animate-pulse'
                : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
            }`}
          >
            <Ban className="w-3.5 h-3.5" />
            {isSunday ? 'E Diele — Auto' : autoPezullim ? `PEZULLIM · ${pezullimReason === 'custom' ? 'Tjeter' : pezullimReason}` : 'Auto-Pezullim'}
            {(autoPezullim || isSunday) && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-300 rounded-full animate-ping" />
            )}
          </button>
        </div>

        {showClientsMap && (
          <div style={{ height: 420 }} className="rounded-2xl overflow-hidden">
            <ClientsOverviewMap
              orders={orders}
              drivers={drivers}
              onClose={() => setShowClientsMap(false)}
            />
          </div>
        )}

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
              <p className="text-[10px] uppercase tracking-wider font-semibold text-amber-700 dark:text-amber-400">Duke pritur</p>
            </div>
            <p className="text-2xl font-bold text-amber-700 dark:text-white mt-0.5">{counts.pending}</p>
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
              <p className="text-[10px] uppercase tracking-wider font-semibold text-emerald-700 dark:text-emerald-400">Konfirmuar</p>
            </div>
            <p className="text-2xl font-bold text-emerald-700 dark:text-white mt-0.5">{counts.approved}</p>
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
              <p className="text-[10px] uppercase tracking-wider font-semibold text-red-700 dark:text-rose-400">Anuluar</p>
            </div>
            <p className="text-2xl font-bold text-red-700 dark:text-white mt-0.5">{counts.rejected}</p>
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
            <p className="text-2xl font-bold text-foreground dark:text-white mt-0.5">{counts.history}</p>
          </button>
        </div>

        {/* History export + delete-all toolbar */}
        {statusFilter === 'history' && historyOrders.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 bg-secondary/40 rounded-xl p-2.5">
            <span className="text-xs text-muted-foreground font-medium flex-1">{historyOrders.length} porosi në histori</span>
            <button
              onClick={() => exportOrdersCSV(historyOrders)}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-background border border-border/50 hover:bg-secondary transition-colors"
              title="Shkarko CSV"
            >
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
            <button
              onClick={() => exportOrdersJSON(historyOrders)}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-background border border-border/50 hover:bg-secondary transition-colors"
              title="Shkarko JSON"
            >
              <Download className="w-3.5 h-3.5" /> JSON
            </button>
            <button
              onClick={() => setConfirmDeleteTarget({ all: true })}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
              title="Fshij të gjithë historinë"
            >
              <Trash2 className="w-3.5 h-3.5" /> Fshij Historinë
            </button>
          </div>
        )}

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
          <div className="flex items-center gap-2">
            {massSelectMode && filtered.length > 0 && (
              <button
                onClick={() => {
                  if (selectedOrderIds.size === filtered.length) {
                    setSelectedOrderIds(new Set());
                  } else {
                    setSelectedOrderIds(new Set(filtered.map((o) => o.id)));
                  }
                }}
                className="text-[11px] font-bold text-primary hover:underline"
              >
                {selectedOrderIds.size === filtered.length ? 'Hiq të gjitha' : 'Zgjidhni të gjitha'}
              </button>
            )}
            {(statusFilter === 'approved' || statusFilter === 'pending' || statusFilter === 'active') && (
              <button
                onClick={() => { setMassSelectMode((v) => !v); setSelectedOrderIds(new Set()); }}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-full transition-colors ${
                  massSelectMode ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:bg-primary/10'
                }`}
              >
                🎯 MASA CAKTO
              </button>
            )}
            {statusFilter !== 'active' && statusFilter !== 'history' && (
              <button onClick={() => setStatusFilter('active')} className="text-[11px] text-primary font-medium hover:underline">
                Pastro filtrin
              </button>
            )}
          </div>
        </div>

        {/* Cluster suggestion tip */}
        {!massSelectMode && (() => {
          const cluster = findBestCluster(orders);
          if (!cluster) return null;
          const names = cluster.map((o) => o.deliveryAddress.split(',')[0]).join(' · ');
          return (
            <button
              onClick={() => {
                setMassSelectMode(true);
                setSelectedOrderIds(new Set(cluster.map((o) => o.id)));
              }}
              className="flex items-center gap-2 w-full text-left px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-400/30 hover:bg-amber-500/15 transition-colors"
            >
              <span className="text-base shrink-0">💡</span>
              <div>
                <p className="text-[11px] font-bold text-amber-700 dark:text-amber-300">Sugjerim: Bëji {cluster.length} porositë njëkohësisht</p>
                <p className="text-[10px] text-muted-foreground truncate">{names}</p>
              </div>
            </button>
          );
        })()}

        {filtered.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-12">
            {statusFilter === 'history' ? 'Asnjë porosi në histori.' : 'Asnjë porosi në këtë interval.'}
          </p>
        )}

        {/* ── Global notification strip — typing + unanswered messages across ALL orders ── */}
        {(() => {
          const now3 = Date.now();
          // Use ALL orders so completed / different-tab orders still surface
          const active = orders.filter((o) => {
            const ca = typingMap[o.id]?.client;
            const sa = typingMap[o.id]?.staff;
            return (ca && now3 - ca < 3000) || (sa && now3 - sa < 3000) || (newMsgMap[o.id]?.count ?? 0) > 0;
          });
          if (active.length === 0) return null;
          const hasAnyTyping = active.some((o) => {
            const ca = typingMap[o.id]?.client;
            const sa = typingMap[o.id]?.staff;
            return (ca && now3 - ca < 3000) || (sa && now3 - sa < 3000);
          });
          const hasUrgent = active.some((o) => {
            const e = newMsgMap[o.id];
            return e && now3 - e.firstMsgTs > 3 * 60 * 1000;
          });
          return (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-2xl border transition-all ${
              hasUrgent
                ? 'bg-red-500/10 border-red-400/30'
                : 'bg-violet-500/10 border-violet-400/25'
            }`}>
              {hasAnyTyping ? (
                <span className="flex gap-[3px] shrink-0">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className={`w-[5px] h-[5px] rounded-full animate-bounce ${hasUrgent ? 'bg-red-500' : 'bg-violet-500'}`} style={{ animationDelay: `${i * 0.18}s` }} />
                  ))}
                </span>
              ) : (
                <span className={`w-2 h-2 rounded-full shrink-0 ${hasUrgent ? 'bg-red-500 animate-pulse' : 'bg-violet-500'}`} />
              )}
              <span className={`text-[10px] font-bold shrink-0 uppercase tracking-wide ${hasUrgent ? 'text-red-600 dark:text-red-400' : 'text-violet-600 dark:text-violet-300'}`}>
                {hasUrgent ? '!!! Pa përgjigje' : hasAnyTyping ? 'Po shkruajnë' : 'Mesazhe të reja'}
              </span>
              <div className="flex items-center gap-1.5 flex-wrap flex-1">
                {active.map((o) => {
                  const entry = newMsgMap[o.id];
                  const isUrgent = entry && now3 - entry.firstMsgTs > 3 * 60 * 1000;
                  const navigate = () => {
                    setSelectedId(o.id);
                    if (isInHistory(o)) setStatusFilter('history');
                    else setStatusFilter('active');
                  };
                  return (
                    <button
                      key={o.id}
                      onClick={navigate}
                      className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full transition-colors ${
                        isUrgent
                          ? 'bg-red-500/15 hover:bg-red-500/25 text-red-700 dark:text-red-300'
                          : 'bg-violet-500/15 hover:bg-violet-500/25 text-violet-700 dark:text-violet-300'
                      }`}
                    >
                      {isUrgent && <span className="text-[10px] font-bold">!!!</span>}
                      {o.customerName || 'Anonim'}
                      {(entry?.count ?? 0) > 0 && (
                        <span className={`min-w-[14px] h-[14px] rounded-full text-white text-[8px] font-bold flex items-center justify-center px-0.5 ${isUrgent ? 'bg-red-500' : 'bg-violet-500'}`}>
                          {entry!.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })()}

        <div className="xl:grid xl:grid-cols-2 xl:gap-3 xl:items-start">
        <AnimatePresence initial={false}>
          {filtered.map((o) => {
            const isSelected = o.id === selectedId;
            const isMassSelected = selectedOrderIds.has(o.id);
            const isGlowing = glowingIds.has(o.id);
            const isPending = o.status === 'pending';
            const isArchived = isInHistory(o);
            const isDeleting = deletingIds.has(o.id);
            const ageMs = now - new Date(o.createdAt).getTime();
            const isOverdue = isPending && ageMs > 60_000;
            const isCagl = isCagllavice(o);
            const now2 = Date.now();
            const clientAge = typingMap[o.id]?.client != null ? now2 - typingMap[o.id].client! : null;
            const staffAge = typingMap[o.id]?.staff != null ? now2 - typingMap[o.id].staff! : null;
            const clientTyping = clientAge !== null && clientAge < 3000;
            const clientRecent = clientAge !== null && clientAge >= 3000 && clientAge < 7000;
            const staffTyping = staffAge !== null && staffAge < 3000;
            const staffRecent = staffAge !== null && staffAge >= 3000 && staffAge < 7000;
            const anyTyping = clientTyping || staffTyping;
            const anyTypingBanner = anyTyping || clientRecent || staffRecent;
            const typingRole = clientTyping ? 'Klienti' : staffTyping ? 'Stafi' : clientRecent ? 'Klienti' : 'Stafi';
            const hasNote = !!(o.notes?.trim());
            const msgEntry = newMsgMap[o.id];
            const hasNewMsg = !!(msgEntry && msgEntry.count > 0);
            const msgUrgent = hasNewMsg && (now - msgEntry!.firstMsgTs) > 3 * 60 * 1000;
            const msgSenderLabel = msgEntry?.sender === 'driver' ? 'Shoferi' : 'Klienti';
            return (
              <React.Fragment key={o.id}>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: isDeleting ? 0.45 : 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                drag={!isLg && !isPending && !isDeleting ? 'x' : false}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.4}
                style={{ touchAction: 'pan-y' }}
                onDragEnd={(_, info) => {
                  if (!isPending && Math.abs(info.offset.x) > 120) {
                    if (isArchived) unarchiveOrder(o.id);
                    else archiveOrder(o.id);
                  }
                }}
                className={`relative rounded-3xl p-4 shadow-card transition-all ${
                  o.status === 'out_for_delivery'
                  ? 'bg-sky-50 dark:bg-sky-950/30 border border-sky-200/50 dark:border-sky-700/30'
                  : isCagl
                    ? 'bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-400/30'
                    : 'bg-card'
                } ${
                  isMassSelected ? 'ring-2 ring-primary bg-primary/5' :
                  isSelected ? 'ring-2 ring-primary' :
                  isOverdue ? 'ring-2 ring-red-500/60 shadow-[0_0_24px_-4px_hsl(0_70%_50%/0.5)]' :
                  isGlowing ? 'ring-2 ring-primary/60 shadow-[0_0_24px_-4px_hsl(var(--primary)/0.5)]' :
                  isCagl ? 'ring-1 ring-blue-400/40 shadow-[0_0_16px_-4px_rgba(59,130,246,0.25)]' :
                  'hover:shadow-md'
                } ${!isLg && !isPending && !isDeleting ? 'cursor-grab active:cursor-grabbing' : ''} ${isDeleting ? 'pointer-events-none grayscale' : ''}`}
                onClick={() => {
                  if (massSelectMode) {
                    setSelectedOrderIds((prev) => {
                      const next = new Set(prev);
                      next.has(o.id) ? next.delete(o.id) : next.add(o.id);
                      return next;
                    });
                  } else {
                    setSelectedId(o.id);
                  }
                }}
              >
                {massSelectMode && (
                  <div className={`absolute top-2 left-2 z-10 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                    isMassSelected ? 'bg-primary border-primary text-primary-foreground' : 'bg-background border-border'
                  }`}>
                    {isMassSelected && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
                  </div>
                )}
                <div className="absolute top-2 right-2 z-10 flex items-center gap-3">
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
                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteTarget({ id: o.id }); }}
                        className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-all active:scale-90"
                        title="Fshij komplet nga historia"
                        aria-label="Fshij komplet"
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
                  className="w-full text-left space-y-2.5"
                >
                  {/* ── Notification banner ── */}
                  {(anyTypingBanner || hasNewMsg) && (
                    <div className={`-mx-0.5 flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-[11px] font-semibold transition-all ${
                      msgUrgent
                        ? 'bg-red-500/10 border-red-400/30 text-red-700 dark:text-red-300'
                        : anyTyping
                          ? 'bg-violet-500/10 border-violet-400/30 text-violet-700 dark:text-violet-300'
                          : 'bg-violet-500/8 border-violet-400/20 text-violet-600/80 dark:text-violet-300/80'
                    }`}>
                      <span className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 text-[12px] ${msgUrgent ? 'bg-red-500/15' : 'bg-violet-500/15'}`}>
                        {msgUrgent ? '🔴' : '💬'}
                      </span>
                      <span className="flex-1">
                        {anyTyping
                          ? `${typingRole} po shkruan`
                          : anyTypingBanner
                            ? `${typingRole} ka shkruajtur`
                            : msgUrgent
                              ? `${msgSenderLabel} ka shkruajtur — pa përgjigje !!!`
                              : `${msgSenderLabel} ka shkruajtur`}
                      </span>
                      {hasNewMsg && !anyTyping && (
                        <span className={`shrink-0 min-w-[18px] h-[18px] rounded-full text-white text-[9px] font-bold flex items-center justify-center px-1 ${msgUrgent ? 'bg-red-500' : 'bg-violet-500'}`}>
                          {msgEntry!.count}
                        </span>
                      )}
                      {anyTyping && (
                        <span className="flex gap-[3px]">
                          {[0, 1, 2].map((i) => (
                            <span key={i} className="w-[5px] h-[5px] rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: `${i * 0.18}s` }} />
                          ))}
                        </span>
                      )}
                    </div>
                  )}

                  {/* ── Row 1: Name + status ── */}
                  <div className="flex items-start justify-between gap-2 pr-16">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="font-bold text-base leading-tight truncate dark:text-white">{o.customerName || 'Anonim'}</h3>
                        <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground shrink-0">
                          {o.source === 'app' ? <><Smartphone className="w-2.5 h-2.5" /> App</> : <><Globe className="w-2.5 h-2.5" /> Web</>}
                        </span>
                        {isCagl && (
                          <span className="inline-flex text-[9px] px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 font-semibold border border-blue-400/30 shrink-0">
                            C Çagllavicë
                          </span>
                        )}
                        {isArchived && (
                          <span className="inline-flex text-[9px] px-1.5 py-0.5 rounded-full bg-foreground/10 text-muted-foreground font-semibold uppercase tracking-wider shrink-0">
                            E fshirë
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground dark:text-slate-300">
                        <span className="flex items-center gap-1"><Phone className="w-3 h-3 opacity-50 shrink-0" />{o.customerPhone}</span>
                        <span className="opacity-30">·</span>
                        <span>{new Date(o.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap shrink-0 mt-0.5 ${statusColor(o.status)}`}>
                      {STATUS_LABEL[o.status] ?? o.status}
                    </span>
                  </div>

                  {/* ── Address ── */}
                  <div className="flex items-start gap-1 text-[11px] text-muted-foreground dark:text-slate-400 -mt-1">
                    <MapPin className="w-3 h-3 shrink-0 mt-0.5 opacity-50" />
                    <span className="truncate leading-snug">{o.deliveryAddress}</span>
                  </div>

                  {/* ── Customer note banner ── */}
                  {hasNote && (
                    <div className="flex items-start gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-500/8 border border-amber-400/20 text-amber-900 dark:text-amber-100 text-[11px]">
                      <span className="w-4 h-4 rounded bg-amber-500/20 flex items-center justify-center shrink-0 mt-px text-[10px]">📋</span>
                      <span className="italic leading-snug line-clamp-2">{o.notes}</span>
                    </div>
                  )}

                  {/* ── Order items (inline, receipt style) ── */}
                  <div className="space-y-1 border-t border-border/30 pt-2">
                    {groupOrderItems(o.items).map((g) => (
                      <div key={g.id}>
                        <div className="flex items-center gap-1.5">
                          {g.image
                            ? <img src={getOptimizedImage(g.image)} alt="" className="w-6 h-6 rounded object-cover shrink-0 ring-1 ring-border/40" />
                            : <div className="w-6 h-6 rounded bg-muted/80 shrink-0 ring-1 ring-border/30" />
                          }
                          <span className="text-[12px] font-semibold leading-tight dark:text-white">{g.totalQty}x {g.name?.sq || g.name?.en || g.id}</span>
                          {g.category && <span className="text-[10px] text-muted-foreground shrink-0">({CATEGORY_LABEL[g.category] ?? g.category})</span>}
                        </div>
                        {g.modifiedItems.map((m, mi) => (
                          <div key={mi} className="pl-8 flex items-center flex-wrap gap-x-1 gap-y-0.5 mt-0.5">
                            <span className="text-[10px] text-muted-foreground shrink-0 font-medium">↳ {m.qty}x</span>
                            {m.removed.map((r, ri) => (
                              <span key={`r${ri}`} className="px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 text-[10px] font-semibold border border-red-500/20">
                                Pa {r}
                              </span>
                            ))}
                            {m.extras.map((ex, ei) => (
                              <span key={`e${ei}`} className="px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold border border-emerald-500/20">
                                + {ex.name?.sq || ex.name?.en}
                              </span>
                            ))}
                          </div>
                        ))}
                      </div>
                    ))}
                    <div className="flex justify-end pt-1 border-t border-border/20 mt-1">
                      <span className="text-primary font-bold text-[13px]">€{o.total.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* ── Driver row ── */}
                  {(() => {
                    const drv = o.assignedDriverId ? drivers.find((d) => d.id === o.assignedDriverId) : null;
                    if (!drv) return null;
                    const assignedMs = assignTimes[o.id];
                    const isLate = o.status === 'approved' && assignedMs && (now - assignedMs) > 60_000;
                    return (
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ background: drv.color || '#6b7280' }} />
                        <span className="text-[10px] font-bold" style={{ color: drv.color || undefined }}>{driverShortCode(drv)}</span>
                        <span className="text-[10px] text-muted-foreground truncate flex-1">{drv.name}</span>
                        {isLate && drv.phone && (
                          <a
                            href={`tel:${drv.phone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="relative flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500 text-white text-[10px] font-bold shadow-lg shadow-red-500/40 active:scale-95 transition-all shrink-0"
                            title={`Thirr ${drv.name}`}
                          >
                            <span className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-50" />
                            <Phone className="w-3 h-3 relative z-10" strokeWidth={2.5} />
                            <span className="relative z-10">Thirr</span>
                          </a>
                        )}
                      </div>
                    );
                  })()}

                  {/* ── Inline driver assign — approved, no driver ── */}
                  {o.status === 'approved' && !o.assignedDriverId && drivers.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap pt-1.5 border-t border-border/30" onClick={(e) => e.stopPropagation()}>
                      <span className="text-[10px] text-muted-foreground font-medium shrink-0">Cakto →</span>
                      {drivers.filter((d) => d.isActive).map((d) => {
                        const emoji = d.isReturning ? '🏁' : d.isPaused ? '☕' : '✅';
                        return (
                          <button
                            key={d.id}
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                await assignDriverToOrder(o.id, d.id, { customerName: o.customerName, address: o.deliveryAddress, total: o.total });
                                toast.success(`${d.name} u caktua`);
                              } catch { toast.error('Gabim'); }
                            }}
                            className="text-[10px] px-2 py-1 rounded-full font-medium bg-blue-500/10 text-blue-700 dark:text-blue-300 hover:bg-blue-500/20 transition-colors"
                          >
                            {emoji} {d.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </button>

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

              {/* Mobile inline detail — same content as desktop sidebar, rendered below the card */}
              {!isLg && selectedId === o.id && selected && (
                <motion.div
                  key={`detail-${o.id}`}
                  data-detail-id={o.id}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                  className="mt-3 overflow-hidden"
                >
                  <div className="bg-card/90 backdrop-blur-xl rounded-3xl shadow-card overflow-hidden border border-border/40">
                    <div className="p-4 border-b border-border/50 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-bold text-base flex items-center gap-2 dark:text-white">
                          {selected.customerName}
                          <CopyButton text={selected.customerName} />
                          <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">
                            {selected.source === 'app' ? <><Smartphone className="w-2.5 h-2.5" /> App</> : <><Globe className="w-2.5 h-2.5" /> Web</>}
                          </span>
                        </h3>
                        <span className="flex items-center gap-0.5">
                          <a href={`tel:${selected.customerPhone}`} className="text-xs text-primary font-medium">{selected.customerPhone}</a>
                          <CopyButton text={selected.customerPhone} />
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => handlePrint(selected)} className="p-2 rounded-full hover:bg-secondary" title="Print"><Printer className="w-4 h-4" /></button>
                        <button onClick={() => setSelectedId(null)} className="p-2 rounded-full hover:bg-secondary"><X className="w-4 h-4" /></button>
                      </div>
                    </div>

                    <div className="p-4 space-y-4 text-xs">
                      <div className="grid grid-cols-4 gap-2">
                        <a href={`tel:${selected.customerPhone}`} className="flex flex-col items-center justify-center gap-1 py-3 rounded-2xl bg-primary/10 text-primary hover:bg-primary/20 active:scale-95 transition-all" title="Telefono">
                          <Phone className="w-5 h-5" strokeWidth={2.4} />
                          <span className="text-[10px] font-semibold">Thirr</span>
                        </a>
                        <a href={`https://wa.me/${selected.customerPhone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center justify-center gap-1 py-3 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 active:scale-95 transition-all" title="WhatsApp">
                          <MessageCircle className="w-5 h-5" strokeWidth={2.4} />
                          <span className="text-[10px] font-semibold">WhatsApp</span>
                        </a>
                        {selected.deliveryLat !== null && selected.deliveryLng !== null ? (
                          <a href={`https://www.google.com/maps?q=${selected.deliveryLat},${selected.deliveryLng}`} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center justify-center gap-1 py-3 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 active:scale-95 transition-all" title="Hap në Maps">
                            <Navigation className="w-5 h-5" strokeWidth={2.4} />
                            <span className="text-[10px] font-semibold">Navigo</span>
                          </a>
                        ) : (
                          <div className="flex flex-col items-center justify-center gap-1 py-3 rounded-2xl bg-secondary/40 text-muted-foreground/50">
                            <Navigation className="w-5 h-5" strokeWidth={2.4} />
                            <span className="text-[10px] font-semibold">Pa Map</span>
                          </div>
                        )}
                        <button onClick={() => { const text = `${selected.customerName}\n${selected.customerPhone}\n${selected.deliveryAddress}\n€${selected.total.toFixed(2)}`; navigator.clipboard?.writeText(text).then(() => toast.success('U kopjua')); }} className="flex flex-col items-center justify-center gap-1 py-3 rounded-2xl bg-secondary text-foreground hover:bg-secondary/70 active:scale-95 transition-all" title="Kopjo detajet">
                          <Copy className="w-5 h-5" strokeWidth={2.4} />
                          <span className="text-[10px] font-semibold">Kopjo</span>
                        </button>
                      </div>

                      <OrderItemsReceipt items={selected.items} total={selected.total} />

                      <div className="flex items-start gap-2 text-muted-foreground">
                        <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <p className="leading-snug flex-1">{selected.deliveryAddress}</p>
                        <CopyButton text={selected.deliveryAddress} />
                      </div>

                      {selected.deliveryLat !== null && selected.deliveryLng !== null && (
                        <DeliveryRouteMap
                          customerLat={selected.deliveryLat}
                          customerLng={selected.deliveryLng}
                          customerLabel={selected.customerName}
                        />
                      )}

                      {/* Driver→Destination map (user-facing view) */}
                      {selected.assignedDriverId && selected.deliveryLat != null && selected.deliveryLng != null && (() => {
                        const drv = drivers.find((d) => d.id === selected.assignedDriverId);
                        if (!drv || drv.lat == null || drv.lng == null) return null;
                        return (
                          <div className="space-y-1.5">
                            <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground flex items-center gap-1">
                              <Bike className="w-3 h-3" /> Harta e shoferit · pamja e klientit
                            </p>
                            <CustomerDriverMap
                              driverLat={drv.lat}
                              driverLng={drv.lng}
                              customerLat={selected.deliveryLat}
                              customerLng={selected.deliveryLng}
                              etaMinutes={null}
                              driverCode={driverShortCode(drv)}
                              driverColor={drv.color || '#3b82f6'}
                              allowFullscreen
                            />
                          </div>
                        );
                      })()}

                      {selected.notes && (
                        <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-300/50 dark:border-amber-500/30 rounded-xl px-3 py-2">
                          <div className="flex items-center justify-between mb-0.5">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">Shënim klienti</p>
                            <CopyButton text={selected.notes!} />
                          </div>
                          <p className="italic text-foreground/90 text-xs">{selected.notes}</p>
                        </div>
                      )}

                      {selected.status === 'pending' && (
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <button onClick={() => openDrawer(selected, 'reject')} className="flex items-center justify-center gap-2 py-4 rounded-2xl bg-destructive/10 text-destructive font-bold text-sm hover:bg-destructive/20 active:scale-95 transition-all">
                            <X className="w-5 h-5" strokeWidth={2.5} /> Refuzo
                          </button>
                          <button onClick={() => openDrawer(selected, 'approve')} className="flex items-center justify-center gap-2 py-4 rounded-2xl bg-primary text-primary-foreground font-bold text-sm shadow-lg shadow-primary/30 hover:bg-primary/90 active:scale-95 transition-all">
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
                              <button onClick={() => handleStatus(selected.id, 'preparing')} disabled={selected.status === 'preparing'} className="text-xs px-2 py-2.5 rounded-xl font-semibold bg-secondary hover:bg-primary/10 disabled:opacity-40 disabled:cursor-not-allowed inline-flex flex-col items-center gap-1 active:scale-95 transition-all">
                                <ChefHat className="w-4 h-4" /> Përgatit
                              </button>
                              <button onClick={() => handleStatus(selected.id, 'out_for_delivery')} disabled={selected.status === 'out_for_delivery'} className="text-xs px-2 py-2.5 rounded-xl font-semibold bg-secondary hover:bg-primary/10 disabled:opacity-40 disabled:cursor-not-allowed inline-flex flex-col items-center gap-1 active:scale-95 transition-all">
                                <Bike className="w-4 h-4" /> Në rrugë
                              </button>
                              <button onClick={() => handleStatus(selected.id, 'completed')} className="text-xs px-2 py-2.5 rounded-xl font-bold bg-primary text-primary-foreground inline-flex flex-col items-center gap-1 shadow-md active:scale-95 transition-all">
                                <CheckCheck className="w-4 h-4" /> Përfundo
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {(selected.status === 'approved' || selected.status === 'preparing' || selected.status === 'out_for_delivery') && drivers.length > 0 && (
                        <div className="bg-blue-500/5 rounded-2xl p-3 border border-blue-500/20 space-y-2">
                          <p className="text-[10px] uppercase tracking-wider text-blue-600 font-bold flex items-center gap-1">
                            <Bike className="w-3 h-3" /> Shoferi
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {drivers.map((d) => {
                              const isAssigned = selected.assignedDriverId === d.id;
                              return (
                                <button key={d.id} onClick={async () => { try { await assignDriverToOrder(selected.id, d.id, { customerName: selected.customerName, address: selected.deliveryAddress, total: selected.total }); toast.success(`Shoferi ${d.name} u caktua`); } catch { toast.error('Gabim'); } }} className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all active:scale-95 ${isAssigned ? 'bg-blue-600 text-white shadow' : 'bg-secondary hover:bg-blue-500/10'}`}>
                                  {d.name}
                                </button>
                              );
                            })}
                          </div>
                          {selected.assignedDriverId && (
                            <button onClick={() => handleForwardToDriver(selected)} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600/10 text-blue-600 dark:text-blue-400 text-xs font-bold hover:bg-blue-600/20 active:scale-95 transition-all border border-blue-500/20">
                              <Share2 className="w-3.5 h-3.5" /> Kaloj bisedën te shoferi
                            </button>
                          )}
                          {selected.assignedDriverId && (() => {
                            const assignedDriver = drivers.find((d) => d.id === selected.assignedDriverId);
                            return assignedDriver ? (
                              <div className="space-y-2">
                                <button onClick={() => setShowDriverMap((v) => !v)} className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-emerald-500/10 text-emerald-600 text-xs font-bold hover:bg-emerald-500/20 active:scale-95 transition-all border border-emerald-500/20">
                                  <Navigation className="w-3.5 h-3.5" />
                                  {showDriverMap ? 'Fshih hartën' : 'Shiko pozicionin e shoferit'}
                                </button>
                                {showDriverMap && (
                                  <DriverLocationMap
                                    drivers={[assignedDriver]}
                                    deliveryLat={selected.deliveryLat}
                                    deliveryLng={selected.deliveryLng}
                                    height="220px"
                                    allowFullscreen
                                  />
                                )}
                              </div>
                            ) : null;
                          })()}
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
                          <button onClick={() => setConfirmDeleteTarget({ id: selected.id })} className="py-3 rounded-2xl bg-destructive/10 text-destructive text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 hover:bg-destructive/20 transition-all" title="Fshij komplet nga historia">
                            <Trash2 className="w-4 h-4" /> Fshij komplet
                          </button>
                        </div>
                      )}

                      {(selected.status === 'approved' || selected.status === 'preparing' || selected.status === 'out_for_delivery') && (
                        closeChatTarget === selected.id ? (
                          <div className="flex gap-2">
                            <button onClick={() => setCloseChatTarget(null)} className="flex-1 py-2.5 rounded-2xl bg-secondary text-xs font-semibold active:scale-95 transition-all">Anulo</button>
                            <button onClick={() => handleCloseChat(selected.id)} className="flex-[1.4] py-2.5 rounded-2xl bg-foreground text-background text-xs font-bold active:scale-95 transition-all">Konfirmo mbylljen</button>
                          </div>
                        ) : (
                          <button onClick={() => setCloseChatTarget(selected.id)} className="w-full py-3 rounded-2xl bg-foreground/90 text-background text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 hover:bg-foreground transition-all">
                            <CheckCheck className="w-4 h-4" /> Mbyll bisedën
                          </button>
                        )
                      )}

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
                </motion.div>
              )}
              </React.Fragment>
            );
          })}
        </AnimatePresence>
        </div>
      </div>

      {/* Detail panel — desktop sidebar only; mobile version renders inline in the list */}
      <div className="hidden lg:block lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100vh-100px)] lg:overflow-y-auto">
        {!selected && (
          <div className="bg-card rounded-3xl p-6 text-center text-sm text-muted-foreground shadow-card backdrop-blur-md">
            Zgjidh një porosi për të hapur detajet, hartën dhe chat.
          </div>
        )}
        {selected && (
          <div className="bg-card/90 backdrop-blur-xl rounded-3xl shadow-card overflow-hidden border border-border/40">
            <div className="p-4 border-b border-border/50 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-bold text-base flex items-center gap-2 dark:text-white">
                  {selected.customerName}
                  <CopyButton text={selected.customerName} />
                  <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">
                    {selected.source === 'app' ? <><Smartphone className="w-2.5 h-2.5" /> App</> : <><Globe className="w-2.5 h-2.5" /> Web</>}
                  </span>
                </h3>
                <span className="flex items-center gap-0.5">
                  <a href={`tel:${selected.customerPhone}`} className="text-xs text-primary font-medium">{selected.customerPhone}</a>
                  <CopyButton text={selected.customerPhone} />
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => handlePrint(selected)} className="p-2 rounded-full hover:bg-secondary" title="Print"><Printer className="w-4 h-4" /></button>
                <button onClick={() => setSelectedId(null)} className="p-2 rounded-full hover:bg-secondary"><X className="w-4 h-4" /></button>
              </div>
            </div>

            <div className="p-4 space-y-4 text-xs">
              {/* Quick actions row */}
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
              <OrderItemsReceipt items={selected.items} total={selected.total} />

              <div className="flex items-start gap-2 text-muted-foreground dark:text-slate-400">
                <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <p className="leading-snug flex-1">{selected.deliveryAddress}</p>
                <CopyButton text={selected.deliveryAddress} />
              </div>

              {selected.deliveryLat !== null && selected.deliveryLng !== null && (
                <DeliveryRouteMap
                  customerLat={selected.deliveryLat}
                  customerLng={selected.deliveryLng}
                  customerLabel={selected.customerName}
                />
              )}

              {/* Driver→Destination map (user-facing view) */}
              {selected.assignedDriverId && selected.deliveryLat != null && selected.deliveryLng != null && (() => {
                const drv = drivers.find((d) => d.id === selected.assignedDriverId);
                if (!drv || drv.lat == null || drv.lng == null) return null;
                return (
                  <div className="space-y-1.5">
                    <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground flex items-center gap-1">
                      <Bike className="w-3 h-3" /> Harta e shoferit · pamja e klientit
                    </p>
                    <CustomerDriverMap
                      driverLat={drv.lat}
                      driverLng={drv.lng}
                      customerLat={selected.deliveryLat}
                      customerLng={selected.deliveryLng}
                      etaMinutes={null}
                      driverCode={driverShortCode(drv)}
                      driverColor={drv.color || '#3b82f6'}
                      allowFullscreen
                    />
                  </div>
                );
              })()}

              {selected.notes && (
                <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-300/50 dark:border-amber-500/30 rounded-xl px-3 py-2">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">Shënim klienti</p>
                    <CopyButton text={selected.notes!} />
                  </div>
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
                <div className="bg-blue-500/5 rounded-2xl p-3 border border-blue-500/20 space-y-2">
                  <p className="text-[10px] uppercase tracking-wider text-blue-600 font-bold flex items-center gap-1">
                    <Bike className="w-3 h-3" /> Shoferi
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {drivers.map((d) => {
                      const isAssigned = selected.assignedDriverId === d.id;
                      return (
                        <button
                          key={d.id}
                          onClick={async () => {
                            try {
                              await assignDriverToOrder(selected.id, d.id, { customerName: selected.customerName, address: selected.deliveryAddress, total: selected.total });
                              toast.success(`Shoferi ${d.name} u caktua`);
                            } catch { toast.error('Gabim'); }
                          }}
                          className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all active:scale-95 ${
                            isAssigned ? 'bg-blue-600 text-white shadow' : 'bg-secondary hover:bg-blue-500/10'
                          }`}
                        >
                          {d.name}
                        </button>
                      );
                    })}
                  </div>
                  {/* Forward to driver button */}
                  {selected.assignedDriverId && (
                    <button
                      onClick={() => handleForwardToDriver(selected)}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600/10 text-blue-600 dark:text-blue-400 text-xs font-bold hover:bg-blue-600/20 active:scale-95 transition-all border border-blue-500/20"
                    >
                      <Share2 className="w-3.5 h-3.5" /> Kaloj bisedën te shoferi
                    </button>
                  )}
                  {/* Driver location map toggle */}
                  {selected.assignedDriverId && (() => {
                    const assignedDriver = drivers.find((d) => d.id === selected.assignedDriverId);
                    return assignedDriver ? (
                      <div className="space-y-2">
                        <button
                          onClick={() => setShowDriverMap((v) => !v)}
                          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-emerald-500/10 text-emerald-600 text-xs font-bold hover:bg-emerald-500/20 active:scale-95 transition-all border border-emerald-500/20"
                        >
                          <Navigation className="w-3.5 h-3.5" />
                          {showDriverMap ? 'Fshih hartën' : 'Shiko pozicionin e shoferit'}
                        </button>
                        {showDriverMap && (
                          <DriverLocationMap
                            drivers={[assignedDriver]}
                            deliveryLat={selected.deliveryLat}
                            deliveryLng={selected.deliveryLng}
                            height="220px"
                            allowFullscreen
                          />
                        )}
                      </div>
                    ) : null;
                  })()}
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
                  <button
                    onClick={() => setConfirmDeleteTarget({ id: selected.id })}
                    className="py-3 rounded-2xl bg-destructive/10 text-destructive text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 hover:bg-destructive/20 transition-all"
                    title="Fshij komplet nga historia"
                  >
                    <Trash2 className="w-4 h-4" /> Fshij komplet
                  </button>
                </div>
              )}

              {(selected.status === 'approved' || selected.status === 'preparing' || selected.status === 'out_for_delivery') && (
                closeChatTarget === selected.id ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCloseChatTarget(null)}
                      className="flex-1 py-2.5 rounded-2xl bg-secondary text-xs font-semibold active:scale-95 transition-all"
                    >
                      Anulo
                    </button>
                    <button
                      onClick={() => handleCloseChat(selected.id)}
                      className="flex-[1.4] py-2.5 rounded-2xl bg-foreground text-background text-xs font-bold active:scale-95 transition-all"
                    >
                      Konfirmo mbylljen
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setCloseChatTarget(selected.id)}
                    className="w-full py-3 rounded-2xl bg-foreground/90 text-background text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 hover:bg-foreground transition-all"
                  >
                    <CheckCheck className="w-4 h-4" /> Mbyll bisedën
                  </button>
                )
              )}

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

      <OrderActionDrawer
        order={drawerOrder}
        mode={drawerMode}
        onClose={() => {
          if (drawerOrder) setSelectedId(drawerOrder.id);
          setDrawerMode(null);
          setDrawerOrder(null);
        }}
      />

      {massSelectMode && (
        <BulkAssignBar
          selectedIds={selectedOrderIds}
          orders={orders}
          drivers={drivers}
          onDone={() => { setMassSelectMode(false); setSelectedOrderIds(new Set()); }}
          onSoftDelete={() => setShowBulkDeleteConfirm(true)}
        />
      )}
    </div>
  );
};

export default OrdersReview;
