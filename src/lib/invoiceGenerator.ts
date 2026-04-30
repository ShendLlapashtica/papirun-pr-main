import type { OrderRecord } from '@/lib/ordersApi';

/**
 * Opens a professional invoice in a new window with Papirun branding,
 * customer details, items breakdown, timestamp, delivery ETA, and map link.
 */
export const generateInvoice = (order: OrderRecord) => {
  const w = window.open('', '_blank');
  if (!w) return;

  const createdAt = new Date(order.createdAt);
  const dateStr = createdAt.toLocaleDateString('sq-AL', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const timeStr = createdAt.toLocaleTimeString('sq-AL', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const etaText = order.prepEtaMinutes
    ? `~${order.prepEtaMinutes} minuta`
    : 'Pa ETA';

  const hasCoords = order.deliveryLat !== null && order.deliveryLng !== null;
  const mapLink = hasCoords
    ? `https://www.google.com/maps?q=${order.deliveryLat},${order.deliveryLng}`
    : null;

  const itemsHtml = order.items
    .map((it: any) => {
      const name = it.name?.sq || it.name?.en || it.id;
      const lineTotal = (it.quantity * (it.price || 0)).toFixed(2);
      const mods: string[] = [];
      if (it.removedIngredients?.length) {
        mods.push(...it.removedIngredients.map((ing: string) => `Pa ${ing}`));
      }
      if (it.addedExtras?.length) {
        mods.push(...it.addedExtras.map((ext: any) => `Me ${ext.name?.sq || ext.id} (+€${(ext.price || 0).toFixed(2)})`));
      }
      const modLine = mods.length > 0 ? `<div style="font-size:11px;color:#888;margin-left:24px;margin-top:2px">${mods.join(', ')}</div>` : '';
      const noteLine = it.customerNote?.trim() ? `<div style="font-size:11px;color:#888;margin-left:24px;font-style:italic">📝 ${it.customerNote}</div>` : '';
      return `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #f0f0f0">${it.quantity}x</td>
          <td style="padding:8px 0;border-bottom:1px solid #f0f0f0">${name}</td>
          <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;text-align:right">€${lineTotal}</td>
        </tr>
        ${modLine || noteLine ? `<tr><td colspan="3" style="padding:0 0 4px 0;border-bottom:1px solid #f0f0f0">${modLine}${noteLine}</td></tr>` : ''}
      `;
    })
    .join('');

  const html = `<!DOCTYPE html>
<html lang="sq">
<head>
  <meta charset="UTF-8">
  <title>Faturë · Papirun #${order.id.slice(0, 8).toUpperCase()}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color: #1a1a1a; background: #fff; }
    .invoice { max-width: 420px; margin: 0 auto; padding: 32px 24px; }
    .header { text-align: center; margin-bottom: 28px; padding-bottom: 20px; border-bottom: 2px solid #e8e8e8; }
    .logo { font-size: 28px; font-weight: 800; letter-spacing: -0.5px; color: #6b8f71; margin-bottom: 4px; }
    .logo-sub { font-size: 11px; color: #999; text-transform: uppercase; letter-spacing: 2px; }
    .invoice-id { font-family: monospace; font-size: 12px; color: #999; margin-top: 8px; letter-spacing: 1px; }
    .section { margin-bottom: 20px; }
    .section-title { font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; color: #999; font-weight: 700; margin-bottom: 8px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .info-item { font-size: 13px; }
    .info-label { font-size: 10px; color: #999; text-transform: uppercase; letter-spacing: 0.5px; }
    .info-value { font-weight: 600; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .total-row { border-top: 2px solid #1a1a1a; }
    .total-row td { padding-top: 12px; font-weight: 700; font-size: 16px; }
    .total-amount { color: #6b8f71; }
    .map-link { display: inline-block; margin-top: 8px; color: #6b8f71; font-size: 12px; text-decoration: none; font-weight: 600; }
    .map-link:hover { text-decoration: underline; }
    .footer { text-align: center; margin-top: 28px; padding-top: 20px; border-top: 2px solid #e8e8e8; }
    .footer p { font-size: 11px; color: #999; line-height: 1.6; }
    .eta-badge { display: inline-block; background: #6b8f7118; color: #6b8f71; font-size: 12px; font-weight: 700; padding: 4px 12px; border-radius: 20px; margin-top: 6px; }
    .notes-box { background: #fffbf0; border: 1px solid #f0e6c0; border-radius: 8px; padding: 10px 12px; font-size: 12px; font-style: italic; color: #8a7a40; }
    @media print {
      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="invoice">
    <div class="header">
      <div class="logo">🥗 Papirun</div>
      <div class="logo-sub">Fresh · Healthy · Prishtinë</div>
      <div class="invoice-id">FATURË #${order.id.slice(0, 8).toUpperCase()}</div>
    </div>

    <div class="section">
      <div class="section-title">Detajet e Klientit</div>
      <div class="info-grid">
        <div class="info-item">
          <div class="info-label">Emri</div>
          <div class="info-value">${order.customerName || 'Anonim'}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Telefoni</div>
          <div class="info-value">${order.customerPhone || '—'}</div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Data & Koha</div>
      <div class="info-grid">
        <div class="info-item">
          <div class="info-label">Data</div>
          <div class="info-value">${dateStr}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Ora</div>
          <div class="info-value">${timeStr}</div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Dërgesa</div>
      <div class="info-item">
        <div class="info-label">Adresa</div>
        <div class="info-value">${order.deliveryAddress || '—'}</div>
      </div>
      <div style="margin-top:6px" class="info-item">
        <div class="info-label">Koha e Pritshme</div>
        <span class="eta-badge">⏱ ${etaText}</span>
      </div>
      ${mapLink ? `<a href="${mapLink}" target="_blank" class="map-link">📍 Hap në Google Maps →</a>` : ''}
    </div>

    <div class="section">
      <div class="section-title">Artikujt</div>
      <table>
        <thead>
          <tr style="border-bottom:2px solid #e8e8e8">
            <th style="text-align:left;padding:6px 0;font-size:10px;text-transform:uppercase;color:#999;letter-spacing:1px">Sasia</th>
            <th style="text-align:left;padding:6px 0;font-size:10px;text-transform:uppercase;color:#999;letter-spacing:1px">Produkti</th>
            <th style="text-align:right;padding:6px 0;font-size:10px;text-transform:uppercase;color:#999;letter-spacing:1px">Çmimi</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>
      <table style="margin-top:12px">
        <tr>
          <td style="padding:4px 0;font-size:12px;color:#999">Nëntotali</td>
          <td style="padding:4px 0;text-align:right;font-size:12px">€${order.subtotal.toFixed(2)}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;font-size:12px;color:#999">Dërgesa</td>
          <td style="padding:4px 0;text-align:right;font-size:12px">€${order.deliveryFee.toFixed(2)}</td>
        </tr>
        <tr class="total-row">
          <td>Totali</td>
          <td style="text-align:right" class="total-amount">€${order.total.toFixed(2)}</td>
        </tr>
      </table>
    </div>

    ${order.notes ? `
    <div class="section">
      <div class="section-title">Shënimi i Klientit</div>
      <div class="notes-box">${order.notes}</div>
    </div>
    ` : ''}

    <div class="footer">
      <p>Faleminderit që zgjedhët Papirun!</p>
      <p style="margin-top:4px">📞 +383 45 262 323 · Prishtinë, Kosovë</p>
    </div>

    <div style="text-align:center;margin-top:20px" class="no-print">
      <button onclick="window.print()" style="background:#6b8f71;color:#fff;border:none;padding:10px 28px;border-radius:12px;font-size:14px;font-weight:600;cursor:pointer">
        🖨 Printo Faturën
      </button>
    </div>
  </div>
</body>
</html>`;

  w.document.write(html);
  w.document.close();
};
