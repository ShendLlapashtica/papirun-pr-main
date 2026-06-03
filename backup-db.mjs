/**
 * Supabase full-data backup — exports every table to a timestamped JSON file.
 * Run with: node backup-db.mjs
 */

// Load from .env (never commit secrets)
const { readFileSync } = await import('fs');
function loadEnv() {
  try {
    return Object.fromEntries(
      readFileSync('.env', 'utf8').split('\n')
        .filter(l => l.includes('=') && !l.startsWith('#'))
        .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
    );
  } catch { return {}; }
}
const env = { ...loadEnv(), ...process.env };
const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const TABLES = [
  'orders',
  'order_messages',
  'order_messages_archive',
  'delivery_drivers',
  'products',
  'storefront_offers',
  'storefront_settings',
  'storefront_locations',
  'menu_extras',
  'quick_replies',
  'user_addresses',
  'user_favorites',
  'marketing_subscribers',
  'email_send_log',
  'email_send_state',
  'email_unsubscribe_tokens',
  'suppressed_emails',
];

const headers = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'count=exact',
};

async function fetchTable(table) {
  let all = [];
  let offset = 0;
  const pageSize = 1000;

  while (true) {
    const url = `${SUPABASE_URL}/rest/v1/${table}?select=*&limit=${pageSize}&offset=${offset}`;
    const res = await fetch(url, { headers });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${table}: HTTP ${res.status} — ${text}`);
    }

    const rows = await res.json();
    all = all.concat(rows);

    if (rows.length < pageSize) break;
    offset += pageSize;
  }

  return all;
}

async function main() {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `backup-${ts}.json`;

  console.log(`Starting backup → ${filename}`);

  const backup = { exportedAt: new Date().toISOString(), tables: {} };

  for (const table of TABLES) {
    process.stdout.write(`  ${table}... `);
    try {
      const rows = await fetchTable(table);
      backup.tables[table] = rows;
      console.log(`${rows.length} rows`);
    } catch (err) {
      console.log(`ERROR: ${err.message}`);
      backup.tables[table] = { error: err.message };
    }
  }

  const { writeFileSync } = await import('fs');
  writeFileSync(filename, JSON.stringify(backup, null, 2), 'utf8');
  console.log(`\nBackup saved: ${filename}`);
}

main().catch(err => { console.error(err); process.exit(1); });
