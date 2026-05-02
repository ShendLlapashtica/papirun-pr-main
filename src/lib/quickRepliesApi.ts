import { supabase } from '@/integrations/supabase/client';

export type QuickReplyType = 'reject' | 'approve' | 'chat';

export interface QuickReply {
  id: string;
  type: QuickReplyType;
  textSq: string;
  textEn: string;
  sortOrder: number;
  isActive: boolean;
}

interface Row {
  id: string;
  type: QuickReplyType;
  text_sq: string;
  text_en: string;
  sort_order: number;
  is_active: boolean;
}

const TABLE = 'quick_replies';

const mapRow = (r: Row): QuickReply => ({
  id: r.id,
  type: r.type,
  textSq: r.text_sq,
  textEn: r.text_en,
  sortOrder: r.sort_order,
  isActive: r.is_active,
});

export const fetchQuickReplies = async (type?: QuickReplyType): Promise<QuickReply[]> => {
  const client = supabase as any;
  let query = client.from(TABLE).select('*').eq('is_active', true).order('sort_order', { ascending: true });
  if (type) query = query.eq('type', type);
  const { data, error } = await query;
  if (error) throw error;
  return (data as Row[]).map(mapRow);
};

export const upsertQuickReply = async (input: Partial<QuickReply> & { type: QuickReplyType; textSq: string; textEn: string }) => {
  const client = supabase as any;
  const payload: any = {
    type: input.type,
    text_sq: input.textSq,
    text_en: input.textEn,
    sort_order: input.sortOrder ?? 0,
    is_active: input.isActive ?? true,
  };
  if (input.id) payload.id = input.id;
  const { data, error } = await client.from(TABLE).upsert(payload).select('*').single();
  if (error) throw error;
  return mapRow(data as Row);
};

export const deleteQuickReply = async (id: string) => {
  const client = supabase as any;
  const { error } = await client.from(TABLE).delete().eq('id', id);
  if (error) throw error;
};

export const subscribeQuickReplies = (onChange: () => void) => {
  const channel = supabase
    .channel('quick-replies-live')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: TABLE },
      onChange
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
};
