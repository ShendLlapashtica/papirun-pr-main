import { supabase } from '@/integrations/supabase/client';

export type MessageSender = 'user' | 'admin' | 'driver';

export interface OrderMessage {
  id: string;
  orderId: string;
  sender: MessageSender;
  message: string;
  createdAt: string;
}

interface Row {
  id: string;
  order_id: string;
  sender: MessageSender;
  message: string;
  created_at: string;
}

const TABLE = 'order_messages';

const mapRow = (r: Row): OrderMessage => ({
  id: r.id,
  orderId: r.order_id,
  sender: r.sender,
  message: r.message,
  createdAt: r.created_at,
});

export const fetchOrderMessages = async (orderId: string): Promise<OrderMessage[]> => {
  const client = supabase as any;
  const { data, error } = await client
    .from(TABLE)
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data as Row[]).map(mapRow);
};

export const sendOrderMessage = async (
  orderId: string,
  sender: MessageSender,
  message: string,
): Promise<OrderMessage> => {
  const client = supabase as any;
  const { data, error } = await client
    .from(TABLE)
    .insert({ order_id: orderId, sender, message })
    .select('*')
    .single();
  if (error) throw error;
  return mapRow(data as Row);
};

/**
 * Delete the live chat for an order, but FIRST snapshot every message into
 * `order_messages_archive` so it survives in admin history. This is what makes
 * the "deleted but recoverable in history" requirement work.
 */
export const deleteOrderMessages = async (orderId: string): Promise<void> => {
  const client = supabase as any;
  // 1) Snapshot to archive
  try {
    const { data: existing } = await client
      .from(TABLE)
      .select('*')
      .eq('order_id', orderId);
    const rows = (existing as Row[] | null) ?? [];
    if (rows.length > 0) {
      const archivePayload = rows.map((r) => ({
        order_id: r.order_id,
        sender: r.sender,
        message: r.message,
        original_created_at: r.created_at,
      }));
      await client.from('order_messages_archive').insert(archivePayload);
    }
  } catch (e) {
    // Don't block deletion on archive failure — log and continue
    console.warn('chat archive failed:', e);
  }
  // 2) Delete live messages
  const { error } = await client.from(TABLE).delete().eq('order_id', orderId);
  if (error) throw error;
};

export interface ArchivedMessage {
  id: string;
  orderId: string;
  sender: MessageSender;
  message: string;
  originalCreatedAt: string;
  archivedAt: string;
}

export const fetchArchivedOrderMessages = async (orderId: string): Promise<ArchivedMessage[]> => {
  const client = supabase as any;
  const { data, error } = await client
    .from('order_messages_archive')
    .select('*')
    .eq('order_id', orderId)
    .order('original_created_at', { ascending: true });
  if (error) throw error;
  return (data as any[]).map((r) => ({
    id: r.id,
    orderId: r.order_id,
    sender: r.sender,
    message: r.message,
    originalCreatedAt: r.original_created_at,
    archivedAt: r.archived_at,
  }));
};

export const subscribeOrderMessages = (
  orderId: string,
  onInsert: (m: OrderMessage) => void,
  onDeleteAll?: () => void,
) => {
  // Unique suffix prevents supabase.channel() from returning a still-alive old channel
  // (removeChannel is async; stable names caused "cannot add callbacks after subscribe()" crashes)
  const channel = supabase
    .channel(`order-messages-${orderId}-${Date.now()}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: TABLE, filter: `order_id=eq.${orderId}` },
      (payload) => onInsert(mapRow(payload.new as Row)),
    )
    .on(
      'postgres_changes',
      // Filter DELETE to this order — avoids firing on other orders' deletes
      { event: 'DELETE', schema: 'public', table: TABLE, filter: `order_id=eq.${orderId}` },
      () => { onDeleteAll?.(); },
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
};

// ── Typing presence hub ────────────────────────────────────────────────────────
// Single persistent broadcast channel. selfBroadcast:true lets the admin see
// their own typing reflected in the order-card list.
// Sends are queued until SUBSCRIBED so the first keystroke is never dropped.
let _typingHub: any = null;
let _typingHubReady = false;
const _pendingSends: Array<{ orderId: string; role: 'user' | 'admin' }> = [];
const _typingHandlers = new Map<string, Set<(role: 'user' | 'admin') => void>>();

const _hubSend = (orderId: string, role: 'user' | 'admin') =>
  _typingHub?.send({ type: 'broadcast', event: 'typing', payload: { orderId, role } });

const ensureTypingHub = (): any => {
  if (_typingHub) return _typingHub;
  try {
    _typingHub = (supabase as any)
      .channel('papirun-typing-hub', { config: { broadcast: { self: true } } })
      .on('broadcast', { event: 'typing' }, ({ payload }: { payload: { orderId: string; role: string } }) => {
        const { orderId, role } = payload ?? {};
        if (!orderId || (role !== 'user' && role !== 'admin')) return;
        _typingHandlers.get(orderId)?.forEach((h) => h(role as 'user' | 'admin'));
      })
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          _typingHubReady = true;
          _pendingSends.splice(0).forEach(({ orderId, role }) => _hubSend(orderId, role));
        }
      });
  } catch { _typingHub = null; }
  return _typingHub;
};

// Pre-warm the hub (call on component mount so hub is ready before first keystroke)
export const initTypingHub = (): void => { ensureTypingHub(); };

// Queue if hub not yet SUBSCRIBED — the flush above delivers it
export const broadcastTyping = (orderId: string, role: 'user' | 'admin'): void => {
  ensureTypingHub();
  if (_typingHubReady) {
    _hubSend(orderId, role);
  } else {
    // Keep only latest per orderId to avoid stale queue build-up
    const i = _pendingSends.findIndex((p) => p.orderId === orderId);
    if (i >= 0) _pendingSends[i] = { orderId, role };
    else _pendingSends.push({ orderId, role });
  }
};

// Returns unsubscribe — uses local JS handler routing, zero extra WS channels
export const subscribeOrderTyping = (
  orderId: string,
  onTyping: (role: 'user' | 'admin') => void,
): (() => void) => {
  ensureTypingHub();
  if (!_typingHandlers.has(orderId)) _typingHandlers.set(orderId, new Set());
  _typingHandlers.get(orderId)!.add(onTyping);
  return () => {
    _typingHandlers.get(orderId)?.delete(onTyping);
    if (_typingHandlers.get(orderId)?.size === 0) _typingHandlers.delete(orderId);
  };
};

// ── SFX ────────────────────────────────────────────────────────────────────────
let _sfxCtx: AudioContext | null = null;
const _sfx = (): AudioContext | null => {
  try {
    if (!_sfxCtx) _sfxCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    return _sfxCtx;
  } catch { return null; }
};

export const playTypingChime = (): void => {
  const ctx = _sfx(); if (!ctx) return;
  try {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(540, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(680, ctx.currentTime + 0.07);
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.06, ctx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22);
    o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.25);
  } catch {}
};

export const playMessageChime = (): void => {
  const ctx = _sfx(); if (!ctx) return;
  try {
    [[880, 0], [1100, 0.13]].forEach(([freq, delay]) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(freq, ctx.currentTime + delay);
      g.gain.setValueAtTime(0.0001, ctx.currentTime + delay);
      g.gain.exponentialRampToValueAtTime(0.14, ctx.currentTime + delay + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + 0.28);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + delay); o.stop(ctx.currentTime + delay + 0.32);
    });
  } catch {}
};
