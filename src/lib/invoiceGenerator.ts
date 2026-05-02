import type { OrderRecord } from '@/lib/ordersApi';
import logo from '@/assets/logo.png';

export const generateInvoice = (order: OrderRecord) => {
  const w = window.open('', '_blank');
  if (!w) return;

  const createdAt = new Date(order.createdAt);
  const dateStr = createdAt.toLocaleDateString('sq-AL', { day: '2-digit', month: 'long', year: 'numeric' });
  const timeStr = createdAt.toLocaleTimeString('sq-AL', { hour: '2-digit', minute: '2-digit' });
  const invoiceNum = `PAP-${order.id.slice(0, 8).toUpperCase()}`;

  const logoUrl = `${window.location.origin}${logo}`;
  const etaText = order.prepEtaMinutes ? `~${order.prepEtaMinutes} min` : '—';
  const hasCoords = order.deliveryLat !== null && order.deliveryLng !== null;
  const mapLink = hasCoords ? `https://www.google.com/maps?q=${order.deliveryLat},${order.deliveryLng}` : null;

  const itemsHtml = order.items
    .map((it: any) => {
      const name = it.name?.sq || it.name?.en || it.id;
      const unitPrice = Number(it.price || 0);
      const extrasTotal = (it.addedExtras || []).reduce((s: number, e: any) => s + Number(e.price || 0), 0);
      const lineTotal = (it.quantity * (unitPrice + extrasTotal)).toFixed(2);
      const mods: string[] = [];
      if (it.removedIngredients?.length) mods.push(...it.removedIngredients.map((ing: string) => `Pa ${ing}`));
      if (it.addedExtras?.length) mods.push(...it.addedExtras.map((e: any) => `+ ${e.name?.sq || e.id} (€${Number(e.price || 0).toFixed(2)})`));
      return `
        <tr>
          <td class="qty">${it.quantity}×</td>
          <td class="item-name">
            ${name}
            ${mods.length ? `<div class="mods">${mods.join(' · ')}</div>` : ''}
            ${it.customerNote?.trim() ? `<div class="mods note">📝 ${it.customerNote}</div>` : ''}
          </td>
          <td class="amount">€${lineTotal}</td>
        </tr>`;
    })
    .join('');

  const html = `<!DOCTYPE html>
<html lang="sq">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Faturë ${invoiceNum} · Papirun</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Inter',system-ui,sans-serif;background:#f5f5f0;color:#1a1a1a;min-height:100vh;display:flex;align-items:flex-start;justify-content:center;padding:32px 16px}
    .page{width:100%;max-width:480px}
    .card{background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.09)}

    /* Header */
    .header{background:linear-gradient(135deg,#5a7a5f 0%,#749d79 100%);padding:28px 28px 24px;color:#fff;position:relative;overflow:hidden}
    .header::after{content:'';position:absolute;bottom:-40px;right:-40px;width:140px;height:140px;border-radius:50%;background:rgba(255,255,255,0.08)}
    .logo-row{display:flex;align-items:center;gap:14px;margin-bottom:20px}
    .logo-img{width:52px;height:52px;border-radius:14px;background:#fff;object-fit:cover;box-shadow:0 2px 8px rgba(0,0,0,0.18)}
    .brand-name{font-size:22px;font-weight:800;letter-spacing:-0.5px}
    .brand-sub{font-size:11px;opacity:0.75;font-weight:500;margin-top:2px}
    .invoice-meta{display:flex;justify-content:space-between;align-items:flex-end}
    .invoice-title{font-size:13px;font-weight:600;opacity:0.85;text-transform:uppercase;letter-spacing:1.5px}
    .invoice-num{font-family:monospace;font-size:13px;opacity:0.9;background:rgba(255,255,255,0.15);padding:3px 10px;border-radius:20px;border:1px solid rgba(255,255,255,0.25)}

    /* Body */
    .body{padding:24px 28px}
    .section{margin-bottom:20px}
    .section-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#888;margin-bottom:10px}
    .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
    .info-item .label{font-size:10px;color:#aaa;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px}
    .info-item .value{font-size:13px;font-weight:600;color:#1a1a1a}
    .address-value{font-size:13px;font-weight:600;color:#1a1a1a;line-height:1.4}
    .eta-chip{display:inline-flex;align-items:center;gap:4px;background:#5a7a5f14;color:#5a7a5f;font-size:12px;font-weight:700;padding:4px 12px;border-radius:20px;border:1px solid #5a7a5f22;margin-top:8px}
    .map-btn{display:inline-flex;align-items:center;gap:5px;margin-top:8px;color:#5a7a5f;font-size:12px;font-weight:600;text-decoration:none;background:#5a7a5f0d;padding:5px 12px;border-radius:20px;border:1px solid #5a7a5f20}

    /* Items table */
    .divider{height:1px;background:#f0f0f0;margin:0 0 20px}
    table{width:100%;border-collapse:collapse;font-size:13px}
    thead tr th{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#aaa;padding:0 0 10px;text-align:left}
    thead tr th.amount{text-align:right}
    tbody tr{border-bottom:1px solid #f8f8f8}
    td{padding:9px 0;vertical-align:top}
    td.qty{color:#888;font-weight:600;width:28px;padding-right:8px}
    td.item-name{flex:1}
    td.amount{text-align:right;font-weight:600;white-space:nowrap;padding-left:8px}
    .mods{font-size:11px;color:#aaa;margin-top:2px}
    .mods.note{font-style:italic;color:#b8860b}

    /* Totals */
    .totals{margin-top:14px;border-top:2px solid #1a1a1a;padding-top:14px}
    .total-row{display:flex;justify-content:space-between;align-items:center;font-size:12px;color:#888;margin-bottom:6px}
    .grand-total{display:flex;justify-content:space-between;align-items:center;font-size:18px;font-weight:800;color:#1a1a1a;margin-top:10px}
    .grand-amount{color:#5a7a5f;font-size:22px}

    /* Notes */
    .notes-box{background:#fffbf0;border:1px solid #f0e0b0;border-radius:10px;padding:12px 14px;font-size:12px;font-style:italic;color:#8a7040;margin-top:6px}

    /* Footer */
    .footer{background:#fafafa;border-top:1px solid #f0f0f0;padding:18px 28px;text-align:center}
    .footer p{font-size:11px;color:#aaa;line-height:1.7}
    .footer .thank{font-size:13px;font-weight:700;color:#5a7a5f;margin-bottom:4px}

    /* Print button */
    .print-row{text-align:center;margin-top:20px}
    .print-btn{background:linear-gradient(135deg,#5a7a5f,#749d79);color:#fff;border:none;padding:12px 32px;border-radius:50px;font-size:14px;font-weight:700;cursor:pointer;box-shadow:0 4px 14px rgba(90,122,95,0.4);font-family:inherit}
    .print-btn:hover{opacity:0.92}

    @media print{
      body{background:#fff;padding:0}
      .page,.card{max-width:100%;box-shadow:none;border-radius:0}
      .header::after{display:none}
      .print-row{display:none}
    }
  </style>
</head>
<body>
<div class="page">
  <div class="card">
    <div class="header">
      <div class="logo-row">
        <img src="${logoUrl}" alt="Papirun" class="logo-img">
        <div>
          <div class="brand-name">Papirun</div>
          <div class="brand-sub">Fresh · Healthy · Prishtinë</div>
        </div>
      </div>
      <div class="invoice-meta">
        <div class="invoice-title">Faturë</div>
        <div class="invoice-num">${invoiceNum}</div>
      </div>
    </div>

    <div class="body">
      <div class="section">
        <div class="section-label">Klienti</div>
        <div class="info-grid">
          <div class="info-item">
            <div class="label">Emri</div>
            <div class="value">${order.customerName || 'Anonim'}</div>
          </div>
          <div class="info-item">
            <div class="label">Telefoni</div>
            <div class="value">${order.customerPhone || '—'}</div>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-label">Data &amp; Ora</div>
        <div class="info-grid">
          <div class="info-item">
            <div class="label">Data</div>
            <div class="value">${dateStr}</div>
          </div>
          <div class="info-item">
            <div class="label">Ora</div>
            <div class="value">${timeStr}</div>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-label">Dërgesa</div>
        <div class="address-value">${order.deliveryAddress || '—'}</div>
        <div class="eta-chip">⏱ ${etaText}</div>
        ${mapLink ? `<br><a href="${mapLink}" target="_blank" class="map-btn">📍 Hap në Google Maps →</a>` : ''}
      </div>

      <div class="divider"></div>

      <div class="section">
        <div class="section-label">Artikujt</div>
        <table>
          <thead>
            <tr>
              <th style="width:28px">#</th>
              <th>Produkti</th>
              <th class="amount">Çmimi</th>
            </tr>
          </thead>
          <tbody>${itemsHtml}</tbody>
        </table>

        <div class="totals">
          <div class="total-row">
            <span>Nëntotali</span>
            <span>€${order.subtotal.toFixed(2)}</span>
          </div>
          <div class="total-row">
            <span>Dërgesa</span>
            <span>${order.deliveryFee > 0 ? `€${order.deliveryFee.toFixed(2)}` : 'Falas'}</span>
          </div>
          <div class="grand-total">
            <span>Totali</span>
            <span class="grand-amount">€${order.total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      ${order.notes ? `
      <div class="section">
        <div class="section-label">Shënimi i Klientit</div>
        <div class="notes-box">${order.notes}</div>
      </div>` : ''}
    </div>

    <div class="footer">
      <div class="thank">Faleminderit që zgjedhët Papirun!</div>
      <p>📞 +383 45 262 323</p>
      <p>📍 Prishtinë, Kosovë · papirun.net</p>
    </div>
  </div>

  <div class="print-row">
    <button class="print-btn" onclick="window.print()">🖨 Printo Faturën</button>
  </div>
</div>
</body>
</html>`;

  w.document.write(html);
  w.document.close();
};
