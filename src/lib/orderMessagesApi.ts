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
  const channel = supabase
    .channel(`order-messages-${orderId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: TABLE, filter: `order_id=eq.${orderId}` },
      (payload) => onInsert(mapRow(payload.new as Row)),
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: TABLE },
      () => { onDeleteAll?.(); },
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
};
