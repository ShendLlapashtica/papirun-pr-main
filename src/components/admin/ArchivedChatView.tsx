import { useEffect, useState } from 'react';
import { Loader2, Archive } from 'lucide-react';
import { fetchArchivedOrderMessages, type ArchivedMessage } from '@/lib/orderMessagesApi';

interface Props {
  orderId: string;
}

const formatTime = (iso: string) => {
  try { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
  catch { return ''; }
};
const formatDate = (iso: string) => {
  try { return new Date(iso).toLocaleDateString(); }
  catch { return ''; }
};

/**
 * Read-only view of archived (deleted) chat messages for a given order.
 * Used inside the admin "Histori" tab so deleted conversations remain auditable.
 */
const ArchivedChatView = ({ orderId }: Props) => {
  const [messages, setMessages] = useState<ArchivedMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchArchivedOrderMessages(orderId)
      .then((rows) => { if (active) { setMessages(rows); setLoading(false); } })
      .catch(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [orderId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-3 text-xs text-muted-foreground gap-2">
        <Loader2 className="w-3 h-3 animate-spin" />
        Po ngarkohet arkivi...
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="text-center text-[11px] text-muted-foreground py-3 italic">
        Asnjë bisedë e arkivuar për këtë porosi.
      </div>
    );
  }

  return (
    <div className="bg-secondary/30 rounded-2xl border border-border/40 overflow-hidden">
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-background/60 border-b border-border/30">
        <Archive className="w-3 h-3 text-muted-foreground" />
        <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
          Bisedë e arkivuar · {messages.length} mesazhe
        </span>
      </div>
      <div className="p-3 space-y-2 max-h-72 overflow-y-auto">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.sender === 'admin' ? 'justify-start' : 'justify-end'}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-3 py-1.5 text-sm ${
                m.sender === 'admin'
                  ? 'bg-background text-foreground rounded-bl-sm border border-border/40'
                  : 'bg-primary/15 text-foreground rounded-br-sm border border-primary/20'
              }`}
            >
              <div className="text-[10px] font-semibold mb-0.5 opacity-70">
                {m.sender === 'admin' ? 'Papirun' : 'Klienti'}
              </div>
              <div className="whitespace-pre-wrap leading-snug">{m.message}</div>
              <div className="text-[9px] opacity-60 mt-0.5">
                {formatDate(m.originalCreatedAt)} · {formatTime(m.originalCreatedAt)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ArchivedChatView;
