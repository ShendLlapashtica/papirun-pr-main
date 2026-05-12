import { useEffect, useState } from 'react';
import { Drawer } from 'vaul';
import { Check, X, Clock, Loader2, Bike, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { fetchQuickReplies, type QuickReply } from '@/lib/quickRepliesApi';
import { sendOrderMessage } from '@/lib/orderMessagesApi';
import { updateOrderStatus, setOrderEta, fetchAllOrders, type OrderRecord } from '@/lib/ordersApi';
import { fetchDrivers, assignDriverToOrder, type DeliveryDriver } from '@/lib/driversApi';

interface Props {
  order: OrderRecord | null;
  mode: 'approve' | 'reject' | null;
  onClose: () => void;
}

const ETA_OPTIONS = [15, 20, 30, 45];

/** ECT: sum remaining prep/delivery time for each active order assigned to a driver */
const calcDriverECT = (driverId: string, activeOrders: OrderRecord[]): number => {
  const driverOrders = activeOrders.filter(
    (o) =>
      o.assignedDriverId === driverId &&
      ['approved', 'preparing', 'out_for_delivery'].includes(o.status),
  );
  if (driverOrders.length === 0) return 0;
  const now = Date.now();
  return driverOrders.reduce((sum, o) => {
    const elapsedMins = (now - new Date(o.createdAt).getTime()) / 60_000;
    const etaMins = o.prepEtaMinutes ?? 20;
    return sum + Math.max(0, etaMins - elapsedMins);
  }, 0);
};

const getBestDriverECT = (drivers: DeliveryDriver[], activeOrders: OrderRecord[]): DeliveryDriver | null => {
  if (drivers.length === 0) return null;
  return drivers.reduce((best, d) => {
    return calcDriverECT(d.id, activeOrders) < calcDriverECT(best.id, activeOrders) ? d : best;
  }, drivers[0]);
};

const OrderActionDrawer = ({ order, mode, onClose }: Props) => {
  const [replies, setReplies] = useState<QuickReply[]>([]);
  const [note, setNote] = useState('');
  const [eta, setEta] = useState<number | null>(20);
  const [submitting, setSubmitting] = useState(false);
  const [drivers, setDrivers] = useState<DeliveryDriver[]>([]);
  const [allOrders, setAllOrders] = useState<OrderRecord[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState<string>('auto');

  const open = !!order && !!mode;
  const isApprove = mode === 'approve';

  useEffect(() => {
    if (!open) return;
    setNote('');
    setEta(isApprove ? 20 : null);
    setSelectedDriverId('auto');
    fetchQuickReplies(mode!).then(setReplies).catch(() => setReplies([]));
    if (isApprove) {
      fetchDrivers().then((d) => setDrivers(d.filter((x) => x.isActive))).catch(() => {});
      fetchAllOrders().then(setAllOrders).catch(() => {});
    }
  }, [open, mode, order?.id]);

  const handleConfirm = async () => {
    if (!order || !mode) return;
    setSubmitting(true);
    try {
      const trimmed = note.trim();
      if (isApprove) {
        // Send message FIRST so it's in DB before the status update triggers realtime on customer side
        const msg = trimmed || (eta ? `Po e përgatisim — gati për ~${eta} min ✓` : 'Porosia u aprovua ✓');
        await sendOrderMessage(order.id, 'admin', msg);
        await updateOrderStatus(order.id, 'approved', trimmed);
        if (eta) await setOrderEta(order.id, eta);

        // Assign driver via ECT or manual selection
        if (drivers.length > 0) {
          let targetDriver: DeliveryDriver | null = null;
          if (selectedDriverId === 'auto') {
            targetDriver = getBestDriverECT(drivers, allOrders);
          } else {
            targetDriver = drivers.find((d) => d.id === selectedDriverId) ?? null;
          }
          if (targetDriver) {
            await assignDriverToOrder(order.id, targetDriver.id);
            const mode = selectedDriverId === 'auto' ? 'ECT Auto' : 'Manual';
            toast.success(`Shoferi: ${targetDriver.name} (${mode})`);
          }
        }
        toast.success('Aprovuar');
      } else {
        const reason = trimmed || 'Porosia u refuzua';
        await updateOrderStatus(order.id, 'rejected', reason);
        await sendOrderMessage(order.id, 'admin', reason);
        toast.success('Refuzuar');
      }
      onClose();
    } catch (e) {
      console.error(e);
      toast.error('Gabim');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Drawer.Root open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-foreground/40 backdrop-blur-sm z-[70]" />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 z-[71] mt-24 flex flex-col rounded-t-[24px] bg-background/95 backdrop-blur-xl border-t border-border/40 max-h-[88vh]">
          <div className="mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-muted" />
          <div className="px-5 pt-4 pb-6 overflow-y-auto">
            <Drawer.Title className="font-display font-bold text-lg flex items-center gap-2">
              {isApprove ? (
                <>
                  <span className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                    <Check className="w-5 h-5" />
                  </span>
                  Aprovo porosinë
                </>
              ) : (
                <>
                  <span className="w-9 h-9 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center">
                    <X className="w-5 h-5" />
                  </span>
                  Refuzo porosinë
                </>
              )}
            </Drawer.Title>
            <p className="text-xs text-muted-foreground mt-1 mb-4">
              {order?.customerName} · €{order?.total.toFixed(2)}
            </p>

            {isApprove && (
              <div className="mb-4">
                <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Koha e përgatitjes
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {ETA_OPTIONS.map((m) => (
                    <button
                      key={m}
                      onClick={() => setEta(m)}
                      className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all ${
                        eta === m ? 'bg-primary text-primary-foreground shadow' : 'bg-secondary hover:bg-primary/10'
                      }`}
                    >
                      {m} min
                    </button>
                  ))}
                  <button
                    onClick={() => setEta(null)}
                    className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all ${
                      eta === null ? 'bg-foreground text-background' : 'bg-secondary hover:bg-foreground/10'
                    }`}
                  >
                    Pa ETA
                  </button>
                </div>
              </div>
            )}

            {/* Driver assignment — only shown when approving */}
            {isApprove && drivers.length > 0 && (
              <div className="mb-4 bg-blue-500/5 rounded-2xl p-3 border border-blue-500/20">
                <p className="text-[11px] uppercase tracking-wider font-semibold text-blue-600 dark:text-blue-400 mb-2 flex items-center gap-1">
                  <Bike className="w-3 h-3" /> Cakto Shoferin
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setSelectedDriverId('auto')}
                    className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all flex items-center gap-1 ${
                      selectedDriverId === 'auto'
                        ? 'bg-primary text-primary-foreground shadow'
                        : 'bg-secondary hover:bg-primary/10'
                    }`}
                  >
                    <Zap className="w-3 h-3" /> Auto (ECT)
                  </button>
                  {drivers.map((d) => {
                    const ect = calcDriverECT(d.id, allOrders);
                    return (
                      <button
                        key={d.id}
                        onClick={() => setSelectedDriverId(d.id)}
                        className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all ${
                          selectedDriverId === d.id
                            ? 'bg-blue-600 text-white shadow'
                            : 'bg-secondary hover:bg-blue-500/10'
                        }`}
                        title={`ECT: ${ect.toFixed(0)} min`}
                      >
                        {d.name}
                        {ect > 0 && (
                          <span className="ml-1 text-[9px] opacity-70">~{ect.toFixed(0)}m</span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {selectedDriverId === 'auto' && (
                  <p className="text-[10px] text-muted-foreground mt-1.5">
                    Sistemi zgjedh shoferin me kohën më të shkurtër të pritjes (ECT).
                  </p>
                )}
              </div>
            )}

            {replies.length > 0 && (
              <div className="mb-4">
                <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">
                  {isApprove ? 'Përgjigje të shpejta' : 'Arsye të zakonshme'}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {replies.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => setNote(r.textSq)}
                      className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all ${
                        note === r.textSq
                          ? isApprove ? 'bg-primary text-primary-foreground' : 'bg-destructive text-destructive-foreground'
                          : 'bg-secondary hover:bg-primary/10'
                      }`}
                    >
                      {r.textSq}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-4">
              <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">
                {isApprove ? 'Mesazh për klientin (opsional)' : 'Arsyeja'}
              </p>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder={isApprove ? 'p.sh. Faleminderit, po e përgatisim!' : 'Shkruaj arsyen...'}
                className="w-full px-4 py-3 rounded-2xl bg-secondary text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={onClose}
                disabled={submitting}
                className="flex-1 py-3 rounded-full bg-secondary text-sm font-semibold hover:bg-secondary/80 transition-colors disabled:opacity-50"
              >
                Anulo
              </button>
              <button
                onClick={handleConfirm}
                disabled={submitting}
                className={`flex-[1.4] py-3 rounded-full text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 ${
                  isApprove
                    ? 'bg-primary text-primary-foreground shadow-lg'
                    : 'bg-destructive text-destructive-foreground shadow-lg'
                }`}
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : isApprove ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                {isApprove ? 'Konfirmo Aprovimin' : 'Konfirmo Refuzimin'}
              </button>
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
};

export default OrderActionDrawer;
