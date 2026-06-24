#!/usr/bin/env node
/**
 * Copies ⚙️ Call Week (formula) / ⚙️ Call Period (formula) into the
 * single-select fields ⚙️ Call Week / ⚙️ Call Period.
 *
 * Usage:
 *   AIRTABLE_API_KEY=pat_xxx node scripts/sync-call-week-period.mjs
 *   AIRTABLE_API_KEY=pat_xxx node scripts/sync-call-week-period.mjs --dry-run
 */

const BASE_ID = 'appZoN6xBB9mDv8h4';
const TABLE_CALLS = 'tblQcfo7qgQCv7o3n';

const FIELD_DATE = 'Date';
const FIELD_WEEK_FORMULA = '⚙️ Call Week (formula)';
const FIELD_PERIOD_FORMULA = '⚙️ Call Period (formula)';
const FIELD_WEEK_SELECT = '⚙️ Call Week';
const FIELD_PERIOD_SELECT = '⚙️ Call Period';

const API_BASE = 'https://api.airtable.com/v0';
const DRY_RUN = process.argv.includes('--dry-run');
const MIN_DELAY_MS = 220;
const BATCH_SIZE = 10;

const token = process.env.AIRTABLE_API_KEY;
if (!token) {
  console.error('Set AIRTABLE_API_KEY to your Airtable personal access token.');
  process.exit(1);
}

let lastRequestAt = 0;

async function throttle() {
  const wait = Math.max(0, MIN_DELAY_MS - (Date.now() - lastRequestAt));
  if (wait) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();
}

async function airtableFetch(path, options = {}) {
  await throttle();
  const resp = await fetch(`${API_BASE}/${BASE_ID}/${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await resp.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  if (!resp.ok) {
    const msg = body?.error?.message || resp.statusText;
    throw new Error(`Airtable ${resp.status}: ${msg}`);
  }
  return body;
}

async function fetchAllRecords(fieldNames) {
  const records = [];
  let offset;
  do {
    const params = new URLSearchParams({ pageSize: '100' });
    if (offset) params.set('offset', offset);
    for (const field of fieldNames) params.append('fields[]', field);
    const data = await airtableFetch(`${TABLE_CALLS}?${params}`);
    records.push(...(data.records || []));
    offset = data.offset;
  } while (offset);
  return records;
}

function selectValue(record, fieldName) {
  const val = record.fields[fieldName];
  return val == null || val === '' ? null : String(val);
}

async function patchRecords(updates) {
  if (!updates.length) return;
  if (DRY_RUN) {
    console.log(`[dry-run] Would patch ${updates.length} record(s)`);
    return;
  }
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const chunk = updates.slice(i, i + BATCH_SIZE);
    await airtableFetch(TABLE_CALLS, {
      method: 'PATCH',
      body: JSON.stringify({ records: chunk }),
    });
    console.log(`Patched ${Math.min(i + BATCH_SIZE, updates.length)}/${updates.length}`);
  }
}

async function main() {
  console.log(DRY_RUN ? 'Dry run — no writes.' : 'Syncing call week/period single selects...');

  const records = await fetchAllRecords([
    FIELD_DATE,
    FIELD_WEEK_FORMULA,
    FIELD_PERIOD_FORMULA,
    FIELD_WEEK_SELECT,
    FIELD_PERIOD_SELECT,
  ]);

  const updates = [];
  for (const record of records) {
    const week = selectValue(record, FIELD_WEEK_FORMULA);
    const period = selectValue(record, FIELD_PERIOD_FORMULA);
    const currentWeek = record.fields[FIELD_WEEK_SELECT] || null;
    const currentPeriod = record.fields[FIELD_PERIOD_SELECT] || null;

    const fields = {};
    if (week !== currentWeek) fields[FIELD_WEEK_SELECT] = week;
    if (period !== currentPeriod) fields[FIELD_PERIOD_SELECT] = period;
    if (!Object.keys(fields).length) continue;

    updates.push({ id: record.id, fields });
  }

  console.log(`Calls: ${records.length}`);
  console.log(`Single-select updates needed: ${updates.length}`);

  await patchRecords(updates);
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
