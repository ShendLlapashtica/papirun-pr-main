import { useEffect, useState } from 'react';
import { Drawer } from 'vaul';
import { Check, X, Clock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { fetchQuickReplies, type QuickReply } from '@/lib/quickRepliesApi';
import { sendOrderMessage } from '@/lib/orderMessagesApi';
import { updateOrderStatus, setOrderEta, type OrderRecord } from '@/lib/ordersApi';

interface Props {
  order: OrderRecord | null;
  mode: 'approve' | 'reject' | null;
  onClose: () => void;
}

const ETA_OPTIONS = [15, 20, 30, 45];

const OrderActionDrawer = ({ order, mode, onClose }: Props) => {
  const [replies, setReplies] = useState<QuickReply[]>([]);
  const [note, setNote] = useState('');
  const [eta, setEta] = useState<number | null>(20);
  const [submitting, setSubmitting] = useState(false);

  const open = !!order && !!mode;

  useEffect(() => {
    if (!mode) return;
    setNote('');
    setEta(mode === 'approve' ? 20 : null);
    fetchQuickReplies(mode).then(setReplies).catch(() => setReplies([]));
  }, [mode, order?.id]);

  const handleConfirm = async () => {
    if (!order || !mode) return;
    setSubmitting(true);
    try {
      const trimmed = note.trim();
      if (mode === 'approve') {
        await updateOrderStatus(order.id, 'approved', trimmed);
        if (eta) await setOrderEta(order.id, eta);
        const msg = trimmed || (eta ? `Po e përgatisim — gati për ~${eta} min ✓` : 'Porosia u aprovua ✓');
        await sendOrderMessage(order.id, 'admin', msg);
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

  const isApprove = mode === 'approve';

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
