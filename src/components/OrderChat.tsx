import { useEffect, useRef, useState } from 'react';
import { Loader2, Send, Zap, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  fetchOrderMessages,
  sendOrderMessage,
  subscribeOrderMessages,
  deleteOrderMessages,
  type OrderMessage,
  type MessageSender,
} from '@/lib/orderMessagesApi';
import { fetchQuickReplies, type QuickReply } from '@/lib/quickRepliesApi';

interface Props {
  orderId: string;
  viewerSide: MessageSender;
  disabled?: boolean;
  maxHeightClass?: string;
  allowDelete?: boolean;
  onMessagesCountChange?: (count: number) => void;
}

const formatTime = (iso: string) => {
  try { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
  catch { return ''; }
};

const SENDER_LABEL: Record<MessageSender, string> = {
  user: 'Klient',
  admin: 'Papirun',
  driver: 'Shofer',
};

// Temp ID prefix for optimistic messages — deduplication checks for this
const OPTIMISTIC_PREFIX = 'opt-';

const OrderChat = ({ orderId, viewerSide, disabled, maxHeightClass = 'max-h-64', allowDelete, onMessagesCountChange }: Props) => {
  const { language } = useLanguage();
  const [messages, setMessages] = useState<OrderMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [showReplies, setShowReplies] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);

    fetchOrderMessages(orderId)
      .then((rows) => {
        if (!active) return;
        setMessages(rows);
        setLoading(false);
        onMessagesCountChange?.(rows.length);
        // Single retry if empty — covers residual race with admin approval message not yet committed
        if (rows.length === 0) {
          setTimeout(() => {
            if (!active) return;
            fetchOrderMessages(orderId).then((retry) => {
              if (!active || retry.length === 0) return;
              setMessages(retry);
              onMessagesCountChange?.(retry.length);
            }).catch(() => {});
          }, 1500);
        }
      })
      .catch(() => { if (active) setLoading(false); });

    const unsub = subscribeOrderMessages(
      orderId,
      // onInsert — deduplicate against optimistic messages by body+sender match
      (m) => {
        setMessages((prev) => {
          // Already confirmed (same real id)
          if (prev.some((x) => x.id === m.id)) return prev;
          // Replace matching optimistic message (same body + sender) — avoids duplicate bubble
          const optIdx = prev.findIndex(
            (x) => x.id.startsWith(OPTIMISTIC_PREFIX) && x.sender === m.sender && x.message === m.message
          );
          const next = optIdx !== -1
            ? prev.map((x, i) => (i === optIdx ? m : x))
            : [...prev, m];
          onMessagesCountChange?.(next.length);
          return next;
        });
      },
      // onDeleteAll — clear state directly, no refetch needed
      () => {
        if (!active) return;
        setMessages([]);
        onMessagesCountChange?.(0);
      },
    );

    if (viewerSide === 'admin') {
      fetchQuickReplies('chat').then((rows) => { if (active) setQuickReplies(rows); }).catch(() => {});
    }

    return () => { active = false; unsub(); };
  }, [orderId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  const handleDeleteChat = async () => {
    if (!window.confirm(language === 'sq' ? 'Fshi gjithë bisedën?' : 'Delete entire chat?')) return;
    try {
      await deleteOrderMessages(orderId);
      // State cleared by realtime onDeleteAll
      toast.success(language === 'sq' ? 'Biseda u fshi' : 'Chat deleted');
    } catch (e) {
      console.error(e);
      toast.error(language === 'sq' ? 'Gabim' : 'Failed');
    }
  };

  const handleSend = async (override?: string) => {
    const body = (override ?? text).trim();
    if (!body || sending || disabled) return;

    // Optimistic insert — sender sees message immediately, no waiting for server
    const tempId = `${OPTIMISTIC_PREFIX}${Date.now()}`;
    const optimistic: OrderMessage = {
      id: tempId,
      orderId,
      sender: viewerSide,
      message: body,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => {
      const next = [...prev, optimistic];
      onMessagesCountChange?.(next.length);
      return next;
    });
    setText('');
    setShowReplies(false);
    setSending(true);

    try {
      const confirmed = await sendOrderMessage(orderId, viewerSide, body);
      // Replace optimistic bubble immediately with the real server message.
      // Realtime may also fire — deduplication in onInsert will no-op if id already present.
      setMessages((prev) => {
        if (prev.some((x) => x.id === confirmed.id)) return prev;
        const next = prev.map((x) => x.id === tempId ? confirmed : x);
        onMessagesCountChange?.(next.length);
        return next;
      });
    } catch (e) {
      console.error(e);
      // Roll back optimistic message on failure
      setMessages((prev) => {
        const next = prev.filter((m) => m.id !== tempId);
        onMessagesCountChange?.(next.length);
        return next;
      });
      setText(body);
      toast.error(language === 'sq' ? 'Mesazhi nuk u dërgua' : 'Message failed');
    } finally {
      setSending(false);
    }
  };

  const placeholder = viewerSide === 'admin'
    ? (language === 'sq' ? 'Përgjigju klientit...' : 'Reply to customer...')
    : viewerSide === 'driver'
      ? (language === 'sq' ? 'Mesazh klientit...' : 'Message customer...')
      : (language === 'sq' ? 'Shkruaj Papirun-it...' : 'Message Papirun...');

  return (
    <div className="flex flex-col bg-secondary/30 rounded-2xl overflow-hidden border border-border/40">
      {allowDelete && messages.length > 0 && (
        <div className="flex items-center justify-end px-2 py-1.5 border-b border-border/30 bg-background/50">
          <button
            type="button"
            onClick={handleDeleteChat}
            className="flex items-center gap-1 text-[10px] font-semibold text-destructive/80 hover:text-destructive px-2 py-1 rounded-full hover:bg-destructive/10 transition-colors"
            title={language === 'sq' ? 'Fshi bisedën' : 'Delete chat'}
          >
            <Trash2 className="w-3 h-3" />
            {language === 'sq' ? 'Fshi bisedën' : 'Delete chat'}
          </button>
        </div>
      )}
      <div ref={scrollRef} className={`flex-1 overflow-y-auto p-3 space-y-2 ${maxHeightClass} min-h-[120px]`}>
        {loading && (
          <div className="flex items-center justify-center py-4 text-xs text-muted-foreground gap-2">
            <Loader2 className="w-3 h-3 animate-spin" />
            {language === 'sq' ? 'Po ngarkohen mesazhet...' : 'Loading messages...'}
          </div>
        )}
        {!loading && messages.length === 0 && (
          <div className="text-center py-6 text-xs text-muted-foreground">
            {viewerSide === 'user'
              ? (language === 'sq' ? 'Bisedo me Papirun këtu 👋' : 'Chat with Papirun here 👋')
              : (language === 'sq' ? 'Asnjë mesazh ende.' : 'No messages yet.')}
          </div>
        )}
        {messages.map((m) => {
          const isOptimistic = m.id.startsWith(OPTIMISTIC_PREFIX);
          const mine = m.sender === viewerSide;
          const isStockNote = m.sender === 'admin' && /pa\s*stok|nuk\s*ka(më)?|jasht[eë]\s*stok|out\s*of\s*stock|unavailable|s'ka|sosur/i.test(m.message);

          let bubbleClass = '';
          let labelEl: JSX.Element | null = null;

          if (mine) {
            bubbleClass = `px-3 py-1.5 bg-primary text-primary-foreground rounded-br-sm${isOptimistic ? ' opacity-70' : ''}`;
          } else if (m.sender === 'admin') {
            if (isStockNote) {
              bubbleClass = 'px-4 py-3 bg-amber-50 dark:bg-amber-500/10 text-foreground border border-amber-300/50 dark:border-amber-500/30 rounded-bl-sm shadow-sm';
            } else {
              bubbleClass = 'px-3 py-1.5 bg-background text-foreground rounded-bl-sm border border-border/40 shadow-sm';
            }
            if (viewerSide === 'user') {
              labelEl = (
                <div className={`text-[10px] font-semibold mb-0.5 ${isStockNote ? 'text-amber-700 dark:text-amber-400 uppercase tracking-wider' : 'text-primary'}`}>
                  {isStockNote ? 'Shënim nga Papirun' : SENDER_LABEL.admin}
                </div>
              );
            }
          } else if (m.sender === 'driver') {
            bubbleClass = 'px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-foreground rounded-bl-sm border border-blue-200/60 dark:border-blue-700/40 shadow-sm';
            if (viewerSide === 'user' || viewerSide === 'admin') {
              labelEl = (
                <div className="text-[10px] font-semibold mb-0.5 text-blue-600 dark:text-blue-400">
                  {SENDER_LABEL.driver}
                </div>
              );
            }
          } else {
            bubbleClass = 'px-3 py-1.5 bg-background text-foreground rounded-bl-sm border border-border/40';
          }

          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl text-sm ${bubbleClass}`}>
                {labelEl}
                <div className="whitespace-pre-wrap leading-snug">{m.message}</div>
                <div className={`text-[9px] mt-0.5 ${mine ? 'opacity-80' : 'opacity-60'}`}>
                  {isOptimistic
                    ? (language === 'sq' ? 'Duke dërguar…' : 'Sending…')
                    : formatTime(m.createdAt)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {!disabled && (
        <div className="border-t border-border/40 bg-background">
          {showReplies && quickReplies.length > 0 && (
            <div className="flex flex-wrap gap-1.5 p-2 border-b border-border/40">
              {quickReplies.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => handleSend(language === 'sq' ? r.textSq : r.textEn)}
                  className="text-[11px] px-2.5 py-1 rounded-full bg-secondary hover:bg-primary/10 hover:text-primary transition-colors"
                >
                  {language === 'sq' ? r.textSq : r.textEn}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-1.5 p-2">
            {quickReplies.length > 0 && viewerSide === 'admin' && (
              <button
                type="button"
                onClick={() => setShowReplies((v) => !v)}
                className={`p-2 rounded-full transition-colors ${showReplies ? 'bg-primary/10 text-primary' : 'hover:bg-secondary text-muted-foreground'}`}
                title={language === 'sq' ? 'Përgjigjet e shpejta' : 'Quick replies'}
              >
                <Zap className="w-3.5 h-3.5" />
              </button>
            )}
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder={placeholder}
              className="flex-1 bg-secondary rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <button
              type="button"
              onClick={() => handleSend()}
              disabled={!text.trim() || sending}
              className="p-2.5 rounded-full bg-primary text-primary-foreground disabled:opacity-50 active:scale-95 transition-all"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderChat;
