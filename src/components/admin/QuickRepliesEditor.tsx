import { useEffect, useState } from 'react';
import { Plus, Trash2, Save, MessageSquare, ThumbsUp, ThumbsDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { fetchQuickReplies, upsertQuickReply, deleteQuickReply, subscribeQuickReplies, type QuickReply, type QuickReplyType } from '@/lib/quickRepliesApi';

const TYPE_META: Record<QuickReplyType, { label: string; icon: typeof MessageSquare; color: string }> = {
  chat: { label: 'Chat', icon: MessageSquare, color: 'text-primary' },
  approve: { label: 'Pranim', icon: ThumbsUp, color: 'text-green-600' },
  reject: { label: 'Refuzim', icon: ThumbsDown, color: 'text-destructive' },
};

const QuickRepliesEditor = () => {
  const [replies, setReplies] = useState<QuickReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeType, setActiveType] = useState<QuickReplyType>('chat');
  const [newSq, setNewSq] = useState('');
  const [newEn, setNewEn] = useState('');
  const [editing, setEditing] = useState<Record<string, { sq: string; en: string }>>({});

  useEffect(() => {
    const sync = () => fetchQuickReplies().then((rows) => { setReplies(rows); setLoading(false); }).catch(console.error);
    sync();
    const unsub = subscribeQuickReplies(sync);
    return () => { unsub(); };
  }, []);

  const filtered = replies.filter((r) => r.type === activeType);

  const handleAdd = async () => {
    if (!newSq.trim() || !newEn.trim()) {
      toast.error('Plotëso të dyja gjuhët');
      return;
    }
    try {
      await upsertQuickReply({
        type: activeType,
        textSq: newSq.trim(),
        textEn: newEn.trim(),
        sortOrder: filtered.length,
      });
      setNewSq('');
      setNewEn('');
      toast.success('U shtua');
    } catch (e) { console.error(e); toast.error('Gabim'); }
  };

  const handleSave = async (r: QuickReply) => {
    const e = editing[r.id];
    if (!e) return;
    try {
      await upsertQuickReply({
        id: r.id,
        type: r.type,
        textSq: e.sq,
        textEn: e.en,
        sortOrder: r.sortOrder,
        isActive: r.isActive,
      });
      setEditing((prev) => { const { [r.id]: _, ...rest } = prev; return rest; });
      toast.success('Ruajtur');
    } catch (err) { console.error(err); toast.error('Gabim'); }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Fshi këtë përgjigje?')) return;
    try { await deleteQuickReply(id); toast.success('U fshi'); }
    catch (e) { console.error(e); toast.error('Gabim'); }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(Object.keys(TYPE_META) as QuickReplyType[]).map((t) => {
          const Icon = TYPE_META[t].icon;
          return (
            <button
              key={t}
              onClick={() => setActiveType(t)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium transition-all ${
                activeType === t ? 'bg-primary text-primary-foreground' : 'bg-secondary'
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {TYPE_META[t].label}
            </button>
          );
        })}
      </div>

      <div className="bg-card rounded-2xl p-4 shadow-card space-y-3">
        <h3 className="font-semibold text-sm">Shto përgjigje të re ({TYPE_META[activeType].label})</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input value={newSq} onChange={(e) => setNewSq(e.target.value)} placeholder="Shqip..." className="px-3 py-2 rounded-lg bg-secondary text-sm" />
          <input value={newEn} onChange={(e) => setNewEn(e.target.value)} placeholder="English..." className="px-3 py-2 rounded-lg bg-secondary text-sm" />
        </div>
        <button onClick={handleAdd} className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
          <Plus className="w-3.5 h-3.5" /> Shto
        </button>
      </div>

      {loading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Duke ngarkuar...</div>}

      <div className="space-y-2">
        {filtered.length === 0 && !loading && (
          <p className="text-sm text-muted-foreground text-center py-6">Asnjë përgjigje në këtë kategori.</p>
        )}
        {filtered.map((r) => {
          const isEditing = !!editing[r.id];
          const e = editing[r.id];
          return (
            <div key={r.id} className="bg-card rounded-xl p-3 shadow-card">
              {isEditing ? (
                <div className="space-y-2">
                  <input value={e.sq} onChange={(ev) => setEditing((prev) => ({ ...prev, [r.id]: { ...prev[r.id], sq: ev.target.value } }))}
                    className="w-full px-3 py-2 rounded-lg bg-secondary text-sm" />
                  <input value={e.en} onChange={(ev) => setEditing((prev) => ({ ...prev, [r.id]: { ...prev[r.id], en: ev.target.value } }))}
                    className="w-full px-3 py-2 rounded-lg bg-secondary text-sm" />
                  <div className="flex gap-2">
                    <button onClick={() => handleSave(r)} className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-medium">
                      <Save className="w-3 h-3" /> Ruaj
                    </button>
                    <button onClick={() => setEditing((prev) => { const { [r.id]: _, ...rest } = prev; return rest; })} className="px-3 py-1.5 rounded-full bg-secondary text-xs">
                      Anulo
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-2">
                  <button
                    onClick={() => setEditing((prev) => ({ ...prev, [r.id]: { sq: r.textSq, en: r.textEn } }))}
                    className="text-left flex-1 min-w-0"
                  >
                    <div className="text-sm font-medium truncate">{r.textSq}</div>
                    <div className="text-xs text-muted-foreground truncate">{r.textEn}</div>
                  </button>
                  <button onClick={() => handleDelete(r.id)} className="p-1.5 rounded-full text-destructive hover:bg-destructive/10">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default QuickRepliesEditor;
