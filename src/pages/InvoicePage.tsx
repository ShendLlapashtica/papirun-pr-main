import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fetchOrder, type OrderRecord } from '@/lib/ordersApi';

export default function InvoicePage() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<OrderRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) { setNotFound(true); setLoading(false); return; }
    fetchOrder(id)
      .then((o) => { if (o) setOrder(o); else setNotFound(true); })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, system-ui, sans-serif', background: '#f5f5f0' }}>
      <p style={{ color: '#888' }}>Duke ngarkuar faturën…</p>
    </div>
  );

  if (notFound || !order) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, system-ui, sans-serif', background: '#f5f5f0' }}>
      <p style={{ color: '#888' }}>Fatura nuk u gjet.</p>
    </div>
  );

  const createdAt = new Date(order.createdAt);
  const dateStr = createdAt.toLocaleDateString('sq-AL', { day: '2-digit', month: 'long', year: 'numeric' });
  const timeStr = createdAt.toLocaleTimeString('sq-AL', { hour: '2-digit', minute: '2-digit' });
  const invoiceNum = `PAP-${order.id.slice(0, 8).toUpperCase()}`;
  const etaText = order.prepEtaMinutes ? `~${order.prepEtaMinutes} min` : '—';

  const statusLabel: Record<string, string> = {
    pending: 'Në pritje',
    approved: 'Aprovuar',
    preparing: 'Duke u përgatitur',
    out_for_delivery: 'Në rrugë',
    completed: 'Përfunduar',
    rejected: 'Refuzuar',
    histori: 'Histori',
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f0', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '32px 16px', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ width: '100%', maxWidth: 480 }}>
        <div style={{ background: '#fff', borderRadius: 20, overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.09)' }}>
          {/* Header */}
          <div style={{ background: 'linear-gradient(135deg,#5a7a5f 0%,#749d79 100%)', padding: '28px 28px 24px', color: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>Papirun</div>
                <div style={{ fontSize: 11, opacity: 0.75, fontWeight: 500, marginTop: 2 }}>Prishtinë · papirun.net</div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <div style={{ fontSize: 13, fontWeight: 600, opacity: 0.85, textTransform: 'uppercase', letterSpacing: 1.5 }}>Faturë</div>
              <div style={{ fontFamily: 'monospace', fontSize: 13, opacity: 0.9, background: 'rgba(255,255,255,0.15)', padding: '3px 10px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.25)' }}>{invoiceNum}</div>
            </div>
          </div>

          {/* Body */}
          <div style={{ padding: '24px 28px' }}>
            {/* Status chip */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#5a7a5f14', color: '#5a7a5f', fontSize: 12, fontWeight: 700, padding: '5px 14px', borderRadius: 20, border: '1px solid #5a7a5f22' }}>
                Statusi: {statusLabel[order.status] ?? order.status}
              </div>
            </div>

            {/* Customer */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, color: '#888', marginBottom: 10 }}>Klienti</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 10, color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>Emri</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{order.customerName || 'Anonim'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>Telefoni</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{order.customerPhone || '—'}</div>
                </div>
              </div>
            </div>

            {/* Date */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, color: '#888', marginBottom: 10 }}>Data &amp; Ora</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 10, color: '#aaa', marginBottom: 3 }}>Data</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{dateStr}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#aaa', marginBottom: 3 }}>Ora</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{timeStr}</div>
                </div>
              </div>
            </div>

            {/* Delivery */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, color: '#888', marginBottom: 10 }}>Dërgesa</div>
              <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4 }}>{order.deliveryAddress || '—'}</div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#5a7a5f14', color: '#5a7a5f', fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 20, border: '1px solid #5a7a5f22', marginTop: 8 }}>⏱ {etaText}</div>
            </div>

            <div style={{ height: 1, background: '#f0f0f0', margin: '0 0 20px' }} />

            {/* Items */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, color: '#888', marginBottom: 10 }}>Artikujt</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#aaa', padding: '0 0 10px', textAlign: 'left', width: 28 }}>#</th>
                    <th style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#aaa', padding: '0 0 10px', textAlign: 'left' }}>Produkti</th>
                    <th style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#aaa', padding: '0 0 10px', textAlign: 'right' }}>Çmimi</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((it: any, idx: number) => {
                    const name = it.name?.sq || it.name?.en || it.id;
                    const unitPrice = Number(it.price || 0);
                    const extrasTotal = (it.addedExtras || []).reduce((s: number, e: any) => s + Number(e.price || 0), 0);
                    const lineTotal = (it.quantity * (unitPrice + extrasTotal)).toFixed(2);
                    const mods: string[] = [];
                    if (it.removedIngredients?.length) mods.push(...it.removedIngredients.map((ing: string) => `Pa ${ing}`));
                    if (it.addedExtras?.length) mods.push(...it.addedExtras.map((e: any) => `+ ${e.name?.sq || e.id} (€${Number(e.price || 0).toFixed(2)})`));
                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid #f8f8f8' }}>
                        <td style={{ color: '#888', fontWeight: 600, width: 28, paddingRight: 8, padding: '9px 8px 9px 0', verticalAlign: 'top' }}>{it.quantity}×</td>
                        <td style={{ padding: '9px 0', verticalAlign: 'top' }}>
                          {name}
                          {mods.length > 0 && <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>{mods.join(' · ')}</div>}
                          {it.customerNote?.trim() && <div style={{ fontSize: 11, color: '#b8860b', fontStyle: 'italic', marginTop: 2 }}>📝 {it.customerNote}</div>}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap', paddingLeft: 8, padding: '9px 0 9px 8px', verticalAlign: 'top' }}>€{lineTotal}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div style={{ marginTop: 14, borderTop: '2px solid #1a1a1a', paddingTop: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#888', marginBottom: 6 }}>
                  <span>Nëntotali</span><span>€{order.subtotal.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#888', marginBottom: 6 }}>
                  <span>Dërgesa</span><span>{order.deliveryFee > 0 ? `€${order.deliveryFee.toFixed(2)}` : 'Falas'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 800, marginTop: 10 }}>
                  <span>Totali</span><span style={{ color: '#5a7a5f', fontSize: 22 }}>€{order.total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {order.notes && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, color: '#888', marginBottom: 10 }}>Shënimi i Klientit</div>
                <div style={{ background: '#fffbf0', border: '1px solid #f0e0b0', borderRadius: 10, padding: '12px 14px', fontSize: 12, fontStyle: 'italic', color: '#8a7040' }}>{order.notes}</div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ background: '#fafafa', borderTop: '1px solid #f0f0f0', padding: '18px 28px', textAlign: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#5a7a5f', marginBottom: 4 }}>Faleminderit që zgjedhët Papirun!</div>
            <p style={{ fontSize: 11, color: '#aaa', lineHeight: 1.7 }}>📞 +383 45 262 323</p>
            <p style={{ fontSize: 11, color: '#aaa', lineHeight: 1.7 }}>📍 Prishtinë, Kosovë · papirun.net</p>
          </div>
        </div>
      </div>
    </div>
  );
}
