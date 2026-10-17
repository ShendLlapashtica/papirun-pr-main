#!/usr/bin/env node
/**
 * Morning health check: can a customer actually place an order right now?
 *
 * Written after the 2026-10-17 outage, where /api/place-order returned 500
 * FUNCTION_INVOCATION_FAILED for a full day and not one order came in. Local
 * tests and typecheck both passed the whole time — that bug only existed in
 * the deployed Vercel bundle, so the only thing that catches it is poking the
 * live endpoint.
 *
 * SAFETY: every check here is read-only. Nothing in this script can create an
 * order. The checkout probe sends an empty body on purpose, which is rejected
 * at the field-validation step long before anything touches the database.
 *
 * Usage:
 *   node scripts/order-health-check.mjs
 *   node scripts/order-health-check.mjs --json
 *
 * Exit codes:
 *   0 = ordering works
 *   1 = ordering is broken (or the site is down)
 */

const BASE = process.env.PAPIRUN_BASE_URL ?? 'https://www.papirun.net';
const TIMEOUT_MS = 20000;
const JSON_OUT = process.argv.includes('--json');

const results = [];

function record(name, ok, detail, fatal = true) {
  results.push({ name, ok, detail, fatal });
  return ok;
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal, redirect: 'follow' });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * THE check. An empty body must come back 400 ("missing field: customerName").
 *
 * A 500 here is the exact outage signature: it means the function is dying at
 * module load, before it reads a single field, so every real checkout is
 * failing too and customers are seeing "Gabim gjate porosise. provo perseri".
 */
async function checkCheckoutEndpoint() {
  let res;
  try {
    res = await fetchWithTimeout(`${BASE}/api/place-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
  } catch (e) {
    return record('checkout endpoint', false, `request failed: ${e.message}`);
  }

  if (res.status === 400) {
    return record('checkout endpoint', true, 'HTTP 400 — loads and validates correctly');
  }

  if (res.status === 500) {
    const vercelError = res.headers.get('x-vercel-error') ?? 'none';
    return record(
      'checkout endpoint',
      false,
      `HTTP 500 (x-vercel-error: ${vercelError}) — CUSTOMERS CANNOT ORDER. ` +
        'The function is crashing before it reads any fields. Usual causes: a ' +
        'broken import inside api/place-order.ts, or a missing env var ' +
        '(VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY) on the production scope.',
    );
  }

  return record(
    'checkout endpoint',
    false,
    `HTTP ${res.status} — expected 400. Something changed in the request contract; check api/place-order.ts.`,
  );
}

/** The storefront itself has to load, or there is nowhere to order from. */
async function checkStorefront() {
  try {
    const res = await fetchWithTimeout(BASE, { method: 'GET' });
    return res.ok
      ? record('storefront', true, `HTTP ${res.status}`)
      : record('storefront', false, `HTTP ${res.status} — site is not serving`);
  } catch (e) {
    return record('storefront', false, `request failed: ${e.message}`);
  }
}

/**
 * Isolates env-var problems from code problems. These two endpoints also build
 * a Supabase client at module load, so if checkout is 500 but these are
 * healthy, the fault is inside place-order.ts, not the environment. That
 * distinction is what made yesterday's diagnosis quick.
 */
async function checkSiblingApis() {
  let allOk = true;
  for (const ep of ['keep-alive', 'driver-orders']) {
    try {
      const res = await fetchWithTimeout(`${BASE}/api/${ep}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      // 405 is the healthy answer: the module loaded, then refused the method.
      const ok = res.status !== 500;
      allOk = record(`api/${ep}`, ok, `HTTP ${res.status}`, false) && allOk;
    } catch (e) {
      allOk = record(`api/${ep}`, false, `request failed: ${e.message}`, false) && allOk;
    }
  }
  return allOk;
}

const checks = [checkStorefront, checkCheckoutEndpoint, checkSiblingApis];
for (const check of checks) await check();

const fatalFailures = results.filter((r) => !r.ok && r.fatal);
const healthy = fatalFailures.length === 0;

if (JSON_OUT) {
  console.log(JSON.stringify({ healthy, checkedAt: new Date().toISOString(), base: BASE, results }, null, 2));
} else {
  const stamp = new Date().toLocaleString('en-GB', { timeZone: 'Europe/Belgrade' });
  console.log(`Papirun order health — ${stamp} (Kosovo time)\n`);
  for (const r of results) {
    const mark = r.ok ? 'OK  ' : r.fatal ? 'FAIL' : 'WARN';
    console.log(`  [${mark}] ${r.name}: ${r.detail}`);
  }
  console.log(
    healthy
      ? '\nORDERING WORKS — customers can check out.'
      : '\nORDERING IS BROKEN — customers cannot check out. Fix before the lunch rush.',
  );
}

process.exit(healthy ? 0 : 1);
