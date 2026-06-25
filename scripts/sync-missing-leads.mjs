#!/usr/bin/env node
/**
 * Copies leads present in appwocx9mhLR8Mh33 but missing from appZoN6xBB9mDv8h4
 * (matched by Databowl Lead ID).
 */

const BASE_MAIN = 'appZoN6xBB9mDv8h4';
const BASE_OTHER = 'appwocx9mhLR8Mh33';
const TABLE = 'tbllpLbEtTkmMQOY9';
const KEY_FIELD = 'Databowl Lead ID';

const WRITABLE_FIELDS = new Set([
  'Lead',
  'Databowl Lead ID',
  'Lead Status',
  'Email',
  'First Name',
  'Last Name',
  'Phone',
  'Dog Name',
  'Dog Age',
  'Dog Weight',
  'Lead Date',
  'Date',
  'LLID',
  'Source',
  '⚙️ Lead Period',
  '⚙️ Lead Week',
  '⚙️ Called?',
  'Lead open/closed',
  'Time lead has been called (single select)',
  'Adversus Lead Status (single select)',
]);

const API_BASE = 'https://api.airtable.com/v0';
const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_SIZE = 10;
const MIN_DELAY_MS = 220;

const token = process.env.AIRTABLE_API_KEY;
if (!token) {
  console.error('Set AIRTABLE_API_KEY');
  process.exit(1);
}

let lastRequestAt = 0;

async function throttle() {
  const wait = Math.max(0, MIN_DELAY_MS - (Date.now() - lastRequestAt));
  if (wait) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();
}

async function airtableFetch(base, path, options = {}) {
  await throttle();
  const resp = await fetch(`${API_BASE}/${base}/${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await resp.text();
  const body = text ? JSON.parse(text) : {};
  if (!resp.ok) throw new Error(`Airtable ${resp.status}: ${body?.error?.message || resp.statusText}`);
  return body;
}

async function fetchAllRecords(base) {
  const records = [];
  let offset;
  do {
    const params = new URLSearchParams({ pageSize: '100' });
    if (offset) params.set('offset', offset);
    const data = await airtableFetch(base, `${TABLE}?${params}`);
    records.push(...(data.records || []));
    offset = data.offset;
  } while (offset);
  return records;
}

function pickWritableFields(fields) {
  const out = {};
  for (const [key, value] of Object.entries(fields)) {
    if (!WRITABLE_FIELDS.has(key)) continue;
    if (value === null || value === undefined || value === '') continue;
    out[key] = value;
  }
  return out;
}

async function main() {
  const [mainRecords, otherRecords] = await Promise.all([
    fetchAllRecords(BASE_MAIN),
    fetchAllRecords(BASE_OTHER),
  ]);

  const mainIds = new Set(
    mainRecords.map((r) => r.fields[KEY_FIELD]).filter((v) => v != null)
  );

  const toCreate = otherRecords.filter((r) => {
    const id = r.fields[KEY_FIELD];
    return id != null && !mainIds.has(id);
  });

  console.log(`Main: ${mainRecords.length}, Other: ${otherRecords.length}`);
  console.log(`Missing in main: ${toCreate.length}`);

  if (!toCreate.length) {
    console.log('Nothing to add.');
    return;
  }

  const payloads = toCreate.map((r) => ({ fields: pickWritableFields(r.fields) }));

  if (DRY_RUN) {
    console.log('[dry-run] Would create:', payloads.map((p) => p.fields[KEY_FIELD]).join(', '));
    return;
  }

  for (let i = 0; i < payloads.length; i += BATCH_SIZE) {
    const chunk = payloads.slice(i, i + BATCH_SIZE);
    const result = await airtableFetch(BASE_MAIN, TABLE, {
      method: 'POST',
      body: JSON.stringify({ records: chunk }),
    });
    console.log(`Created ${Math.min(i + BATCH_SIZE, payloads.length)}/${payloads.length}`);
    for (const rec of result.records || []) {
      console.log(`  + ${rec.fields[KEY_FIELD]} ${rec.fields['First Name'] || ''} ${rec.fields['Last Name'] || ''}`.trim());
    }
  }

  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
