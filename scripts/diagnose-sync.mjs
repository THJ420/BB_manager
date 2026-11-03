#!/usr/bin/env node
/**
 * Reproduces the BB Manager terminal's PocketBase traffic outside the device and
 * prints the exact rejection reason.
 *
 *   node scripts/diagnose-sync.mjs --email manager@example.com --password '...'
 *
 * The email/password are only used for the auth probe; the script then mirrors
 * the payloads the outbox sends (menu item create + price edit) and deletes the
 * temporary record it created.
 *
 * Options:
 *   --url <url>       PocketBase base URL (default: EXPO_PUBLIC_POCKETBASE_URL from .env)
 *   --email <email>   staff account to test (default: DIAG_EMAIL)
 *   --password <pw>   staff password (default: DIAG_PASSWORD)
 *   --json            print the raw JSON responses too
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function readEnvUrl() {
  try {
    const env = readFileSync(join(root, '.env'), 'utf8');
    const line = env
      .split(/\r?\n/)
      .find((entry) => entry.startsWith('EXPO_PUBLIC_POCKETBASE_URL='));
    return line ? line.split('=').slice(1).join('=').trim().replace(/^"|"$/g, '') : '';
  } catch {
    return '';
  }
}

const argv = process.argv.slice(2);
const flag = (name) => {
  const index = argv.indexOf(`--${name}`);
  return index === -1 ? undefined : argv[index + 1];
};
const has = (name) => argv.includes(`--${name}`);

const rawUrl = flag('url') || process.env.EXPO_PUBLIC_POCKETBASE_URL || readEnvUrl();
const email = flag('email') || process.env.DIAG_EMAIL || '';
const password = flag('password') || process.env.DIAG_PASSWORD || '';
const verbose = has('json');

if (!rawUrl) {
  console.error('No PocketBase URL. Pass --url or set EXPO_PUBLIC_POCKETBASE_URL.');
  process.exit(2);
}

const url = rawUrl.trim().replace(/\/+$/, '');
const base = `${url}/api`;
let failures = 0;

function report(ok, label, detail = '') {
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  [${detail}]` : ''}`);
}

async function call(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json', 'User-Agent': 'okhttp/4.12.0' };
  if (token) headers.Authorization = token;
  let response;
  try {
    response = await fetch(base + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: 'follow',
    });
  } catch (error) {
    return { status: 0, data: {}, networkError: String(error?.cause?.message || error) };
  }
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text.slice(0, 300) };
  }
  return { status: response.status, data, contentType: response.headers.get('content-type') };
}

function explain(status, data) {
  if (status === 0) return 'Network/TLS failure — the device cannot reach the host.';
  if (status === 401) return 'Auth rejected — token missing/expired. Sign in again on the terminal.';
  if (status === 403) return 'Forbidden — account lacks access (role or branch).';
  if (status === 404) return 'Record not found — the dependent create never landed.';
  if (status === 400 && data && typeof data === 'object' && Object.keys(data.data || {}).length > 0)
    return 'Field validation failed — see the per-field detail above.';
  if (status === 400) return 'PocketBase collection rule denied the write (role/branch mismatch).';
  return 'Unexpected response.';
}

function jwtExpiry(token) {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const parsed = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
    return typeof parsed.exp === 'number' ? new Date(parsed.exp * 1000).toISOString() : 'unknown';
  } catch {
    return 'unknown';
  }
}

console.log('=== BB Manager sync diagnostics ===');
console.log('URL:', url);
if (/localhost|127\.0\.0\.1|192\.168\.|10\.\d+\./.test(url)) {
  console.log('WARN  The URL is a local/LAN address; a physical device cannot reach it.');
}
if (rawUrl !== url) console.log('NOTE  trailing slash in the configured URL was normalised away');

const health = await call('/health');
report(health.status === 200, 'PocketBase reachable', `HTTP ${health.status}`);
if (health.status !== 200) {
  console.log('  body:', JSON.stringify(health.data).slice(0, 300));
  console.log('  hint:', explain(health.status, health.data));
  process.exit(1);
}

let token = '';
let me = {};
if (!email || !password) {
  console.log('SKIP  auth probe (pass --email and --password to test a staff session)');
} else {
  const auth = await call('/collections/staff_users/auth-with-password', {
    method: 'POST',
    body: { identity: email, password },
  });
  report(auth.status === 200, 'staff login', `HTTP ${auth.status}`);
  if (auth.status === 200) {
    token = auth.data.token;
    me = auth.data.record || {};
    console.log('  record:', me.id, '| email:', me.email, '| role:', me.role, '| branch:', me.branch_id);
    console.log('  token expires:', jwtExpiry(token));
    if (!me.branch_id) {
      report(false, 'staff record carries branch_id', 'missing — every write will be denied');
    }
  } else {
    console.log('  body:', JSON.stringify(auth.data).slice(0, 300));
    console.log(
      '  hint: wrong email/password, the account is disabled, or Cloudflare throttled the request.'
    );
  }
}

if (token) {
  const list = await call(
    `/collections/menu_items/records?perPage=50&filter=${encodeURIComponent(
      `branch_id='${me.branch_id}'`
    )}`,
    { token }
  );
  const items = list.data.items || [];
  report(list.status === 200, 'branch-scoped menu read', `HTTP ${list.status} rows=${items.length}`);
  const foreign = items.filter((item) => item.branch_id !== me.branch_id);
  report(foreign.length === 0, 'no foreign-branch rows returned', `${foreign.length} leaked`);

  const id = `d${Date.now().toString(36)}`.padEnd(15, '0').slice(0, 15);
  const create = await call('/collections/menu_items/records', {
    method: 'POST',
    token,
    body: {
      id,
      branch_id: me.branch_id,
      name: 'Diagnostic Probe',
      category: 'Diagnostics',
      description: 'Temporary record created by scripts/diagnose-sync.mjs',
      price: 9.99,
      currency: 'PLN',
      in_stock: true,
      is_visible: true,
      prep_minutes: 5,
      image_url: '',
      modifiers: [],
    },
  });
  report(create.status === 200, 'menu item create (same payload as the outbox)', `HTTP ${create.status}`);
  if (verbose) console.log('  body:', JSON.stringify(create.data).slice(0, 400));
  if (create.status !== 200) {
    console.log('  hint:', explain(create.status, create.data));
    if (create.status === 400) {
      console.log(
        '  role check: menu_items.createRule allows manager|kitchen_lead only. Current role:',
        me.role
      );
    }
  } else {
    const update = await call(`/collections/menu_items/records/${id}`, {
      method: 'PATCH',
      token,
      body: { price: 11.5, branch_id: me.branch_id },
    });
    report(update.status === 200, 'menu price edit', `HTTP ${update.status}`);
    if (update.status !== 200) console.log('  hint:', explain(update.status, update.data));
    const remove = await call(`/collections/menu_items/records/${id}`, { method: 'DELETE', token });
    report(remove.status === 204, 'cleanup probe record', `HTTP ${remove.status}`);
  }

  console.log('\nOutbox mapping:');
  console.log('  CREATE_MENU_ITEM / UPDATE_MENU_ITEM -> menu_items');
  console.log('  TOGGLE_MENU_STOCK / UPDATE_MENU_PRICE -> menu_items (price/in_stock only)');
  console.log('  UPDATE_STORE_HOURS / UPDATE_SETTINGS  -> branch_settings');
  console.log('  UPDATE_RESERVATION_STATUS             -> reservations');
  console.log('  UPDATE_ORDER_STATUS                   -> orders (status only)');
}

console.log('\n=== RESULT ===');
console.log(failures === 0 ? 'All probes passed.' : `${failures} probe(s) failed — see hints above.`);
process.exit(failures === 0 ? 0 : 1);
