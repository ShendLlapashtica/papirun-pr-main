import { useEffect, useMemo, useState } from 'react';
import { Mail, Search, Bell, BellOff, Download, Users, CheckCircle2, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

type Subscriber = {
  email: string;
  lang: string;
  consented_at: string | null;
  user_id: string | null;
  source: 'marketing' | 'order';
  hasOrder: boolean;
};

type FilterKey = 'all' | 'consented' | 'pending' | 'with_orders';

const SubscribersList = () => {
  const [rows, setRows] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');

  const load = async () => {
    setLoading(true);
    try {
      const client = supabase as any;
      const [{ data: subs }, { data: orderRows }] = await Promise.all([
        client
          .from('marketing_subscribers')
          .select('email, lang, consented_at, user_id')
          .order('consented_at', { ascending: false }),
        client
          .from('orders')
          .select('user_id, customer_name, customer_phone, created_at')
          .order('created_at', { ascending: false }),
      ]);

      const map = new Map<string, Subscriber>();
      (subs ?? []).forEach((s: any) => {
        map.set(String(s.email).toLowerCase(), {
          email: s.email,
          lang: s.lang || 'sq',
          consented_at: s.consented_at,
          user_id: s.user_id,
          source: 'marketing',
          hasOrder: false,
        });
      });

      const userIdsWithOrders = new Set<string>();
      (orderRows ?? []).forEach((o: any) => {
        if (o.user_id) userIdsWithOrders.add(o.user_id);
      });

      // Mark which subscribers have placed orders
      map.forEach((row) => {
        if (row.user_id && userIdsWithOrders.has(row.user_id)) {
          row.hasOrder = true;
        }
      });

      setRows(Array.from(map.values()));
    } catch (e) {
      console.error('Failed to load subscribers', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const client = supabase as any;
    const channel = client
      .channel('admin-subscribers')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'marketing_subscribers' }, () => load())
      .subscribe();
    return () => { client.removeChannel(channel); };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (q && !r.email.toLowerCase().includes(q)) return false;
      if (filter === 'consented') return !!r.consented_at;
      if (filter === 'pending') return !r.consented_at;
      if (filter === 'with_orders') return r.hasOrder;
      return true;
    });
  }, [rows, search, filter]);

  const counts = useMemo(() => ({
    all: rows.length,
    consented: rows.filter((r) => !!r.consented_at).length,
    pending: rows.filter((r) => !r.consented_at).length,
    with_orders: rows.filter((r) => r.hasOrder).length,
  }), [rows]);

  const exportCsv = () => {
    const header = 'email,lang,consented_at,has_order\n';
    const body = filtered
      .map((r) => `${r.email},${r.lang},${r.consented_at ?? ''},${r.hasOrder ? 'yes' : 'no'}`)
      .join('\n');
    const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `papirun-subscribers-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`rounded-2xl p-3 text-left border transition-all active:scale-[0.98] ${
            filter === 'all'
              ? 'bg-primary/15 border-primary/40 ring-2 ring-primary/30'
              : 'bg-secondary/60 border-border hover:bg-secondary'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-foreground" />
            <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Të gjithë</p>
          </div>
          <p className="text-2xl font-bold mt-0.5">{counts.all}</p>
        </button>

        <button
          onClick={() => setFilter('consented')}
          className={`rounded-2xl p-3 text-left border transition-all active:scale-[0.98] ${
            filter === 'consented'
              ? 'bg-emerald-500/20 border-emerald-500/50 ring-2 ring-emerald-500/40'
              : 'bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/15'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <Bell className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <p className="text-[10px] uppercase tracking-wider font-semibold text-emerald-700 dark:text-emerald-300">Konfirmuan</p>
          </div>
          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">{counts.consented}</p>
        </button>

        <button
          onClick={() => setFilter('pending')}
          className={`rounded-2xl p-3 text-left border transition-all active:scale-[0.98] ${
            filter === 'pending'
              ? 'bg-amber-500/20 border-amber-500/50 ring-2 ring-amber-500/40'
              : 'bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/15'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <BellOff className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <p className="text-[10px] uppercase tracking-wider font-semibold text-amber-700 dark:text-amber-300">Pa konfirmuar</p>
          </div>
          <p className="text-2xl font-bold text-amber-700 dark:text-amber-300 mt-0.5">{counts.pending}</p>
        </button>

        <button
          onClick={() => setFilter('with_orders')}
          className={`rounded-2xl p-3 text-left border transition-all active:scale-[0.98] ${
            filter === 'with_orders'
              ? 'bg-primary/20 border-primary/50 ring-2 ring-primary/40'
              : 'bg-primary/10 border-primary/20 hover:bg-primary/15'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
            <p className="text-[10px] uppercase tracking-wider font-semibold text-primary">Me porosi</p>
          </div>
          <p className="text-2xl font-bold text-primary mt-0.5">{counts.with_orders}</p>
        </button>
      </div>

      {/* Search + actions */}
      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Kërko email…"
            className="w-full h-10 pl-9 pr-3 rounded-xl bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <button
          onClick={exportCsv}
          className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold flex items-center gap-1.5 active:scale-[0.98] transition-transform"
        >
          <Download className="w-4 h-4" /> CSV
        </button>
      </div>

      {/* List */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Duke ngarkuar…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Asnjë rezultat.</div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((r) => (
              <div key={r.email} className="flex items-center gap-3 p-3 hover:bg-secondary/40 transition-colors">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Mail className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{r.email}</p>
                  <p className="text-[11px] text-muted-foreground flex items-center gap-2">
                    <span className="uppercase">{r.lang}</span>
                    {r.consented_at && (
                      <>
                        <span>·</span>
                        <Clock className="w-3 h-3" />
                        {new Date(r.consented_at).toLocaleDateString('sq')}
                      </>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  {r.consented_at ? (
                    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/30 font-semibold">
                      <Bell className="w-3 h-3" /> Konfirmuar
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/30 font-semibold">
                      <BellOff className="w-3 h-3" /> Pa konfirmuar
                    </span>
                  )}
                  {r.hasOrder && (
                    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary ring-1 ring-primary/30 font-semibold">
                      <CheckCircle2 className="w-3 h-3" /> Porosi
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground px-1">
        🔒 Sigurisht: Nuk ruajmë fjalëkalimet — ato menaxhohen vetëm nga sistemi i autentifikimit (OTP-only, jo password). Këtu duken vetëm email-at e regjistruar.
      </p>
    </div>
  );
};

export default SubscribersList;
