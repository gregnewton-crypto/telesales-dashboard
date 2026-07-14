#!/usr/bin/env node
/**
 * Syncs lead_id / llid on 2026 Databowl Marro API between both bases,
 * and copies any missing records so both tables stay aligned.
 *
 * Usage:
 *   AIRTABLE_API_KEY=pat_xxx node scripts/sync-marro-lead-ids.mjs
 *   AIRTABLE_API_KEY=pat_xxx node scripts/sync-marro-lead-ids.mjs --dry-run
 */

const BASE_MAIN = 'appZoN6xBB9mDv8h4';
const BASE_OTHER = 'appwocx9mhLR8Mh33';
const TABLE = 'tblPosmpZAiDpHAkS';

const FIELD_LEAD_ID = 'fld0TOshdyaPZiYT2';
const FIELD_LLID = 'fldC48fdMX0LorA3z';

const MATCH_FIELDS = ['lead_id', 'llid', 'email', 'phone1', 'firstname', 'lastname', 'timestamp'];

const WRITABLE_FIELDS = new Set([
  'lead_id',
  'lead_status',
  'timestamp',
  'lead_message',
  'email',
  'title',
  'firstname',
  'lastname',
  'phone1',
  'age',
  'security_phrase',
  'phone_code',
  'llid',
  'mappingname',
  'cat_breed',
  'cat_name',
  'cat_age',
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
    for (const field of MATCH_FIELDS) params.append('fields[]', field);
    const data = await airtableFetch(base, `${TABLE}?${params}`);
    records.push(...(data.records || []));
    offset = data.offset;
  } while (offset);
  return records;
}

function normPhone(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits;
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

function buildLookups(records) {
  const byId = new Map(records.map((r) => [r.id, r]));
  const byEmail = new Map();
  const byPhone = new Map();

  for (const record of records) {
    const fields = record.fields;
    if (!fields.lead_id) continue;
    const payload = {
      lead_id: String(fields.lead_id),
      llid: fields.llid ? String(fields.llid) : null,
    };
    const email = (fields.email || '').toLowerCase().trim();
    const phone = normPhone(fields.phone1);
    if (email) byEmail.set(email, payload);
    if (phone) byPhone.set(phone, payload);
  }

  return { byId, byEmail, byPhone };
}

function findLeadSource(record, sourceById, sourceByEmail, sourceByPhone) {
  const fromId = sourceById.get(record.id);
  if (fromId?.fields?.lead_id) {
    return {
      lead_id: String(fromId.fields.lead_id),
      llid: fromId.fields.llid ? String(fromId.fields.llid) : null,
    };
  }

  const fields = record.fields;
  const email = (fields.email || '').toLowerCase().trim();
  const phone = normPhone(fields.phone1);
  if (email && sourceByEmail.has(email)) return sourceByEmail.get(email);
  if (phone && sourceByPhone.has(phone)) return sourceByPhone.get(phone);
  return null;
}

function buildLeadIdUpdates(targetRecords, sourceById, sourceByEmail, sourceByPhone) {
  const updates = [];

  for (const record of targetRecords) {
    if (record.fields.lead_id) continue;
    const src = findLeadSource(record, sourceById, sourceByEmail, sourceByPhone);
    if (!src) continue;

    const fields = { [FIELD_LEAD_ID]: src.lead_id };
    if (src.llid) fields[FIELD_LLID] = src.llid;
    updates.push({ id: record.id, fields });
  }

  return updates;
}

function recordsMissingFrom(sourceRecords, targetIds, targetEmails) {
  return sourceRecords.filter((r) => {
    if (targetIds.has(r.id)) return false;
    const email = (r.fields.email || '').toLowerCase().trim();
    if (email && targetEmails.has(email)) return false;
    return true;
  });
}

async function patchRecords(base, updates, label) {
  if (!updates.length) {
    console.log(`No lead_id updates for ${label}.`);
    return 0;
  }

  if (DRY_RUN) {
    console.log(`[dry-run] Would patch ${updates.length} on ${label}`);
    return updates.length;
  }

  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const chunk = updates.slice(i, i + BATCH_SIZE);
    await airtableFetch(base, TABLE, {
      method: 'PATCH',
      body: JSON.stringify({ records: chunk }),
    });
    console.log(`Patched ${label}: ${Math.min(i + BATCH_SIZE, updates.length)}/${updates.length}`);
  }

  return updates.length;
}

async function createRecords(targetBase, records, label) {
  if (!records.length) {
    console.log(`No new records for ${label}.`);
    return 0;
  }

  const payloads = records.map((r) => ({ fields: pickWritableFields(r.fields) }));

  if (DRY_RUN) {
    console.log(`[dry-run] Would create ${payloads.length} in ${label}`);
    return payloads.length;
  }

  for (let i = 0; i < payloads.length; i += BATCH_SIZE) {
    const chunk = payloads.slice(i, i + BATCH_SIZE);
    await airtableFetch(targetBase, TABLE, {
      method: 'POST',
      body: JSON.stringify({ records: chunk }),
    });
    console.log(`Created in ${label}: ${Math.min(i + BATCH_SIZE, payloads.length)}/${payloads.length}`);
  }

  return payloads.length;
}

async function main() {
  const [mainRecords, otherRecords] = await Promise.all([
    fetchAllRecords(BASE_MAIN),
    fetchAllRecords(BASE_OTHER),
  ]);

  const mainIds = new Set(mainRecords.map((r) => r.id));
  const otherIds = new Set(otherRecords.map((r) => r.id));
  const mainEmails = new Set(
    mainRecords.map((r) => (r.fields.email || '').toLowerCase().trim()).filter(Boolean)
  );
  const otherEmails = new Set(
    otherRecords.map((r) => (r.fields.email || '').toLowerCase().trim()).filter(Boolean)
  );

  const mainLookups = buildLookups(mainRecords);
  const otherLookups = buildLookups(otherRecords);

  const updateOther = buildLeadIdUpdates(
    otherRecords,
    mainLookups.byId,
    mainLookups.byEmail,
    mainLookups.byPhone
  );
  const updateMain = buildLeadIdUpdates(
    mainRecords,
    otherLookups.byId,
    otherLookups.byEmail,
    otherLookups.byPhone
  );

  const missingInMain = recordsMissingFrom(otherRecords, mainIds, mainEmails);
  const missingInOther = recordsMissingFrom(mainRecords, otherIds, otherEmails);

  console.log(`Main records: ${mainRecords.length}, Other records: ${otherRecords.length}`);
  console.log(`Missing lead_id — main: ${mainRecords.filter((r) => !r.fields.lead_id).length}, other: ${otherRecords.filter((r) => !r.fields.lead_id).length}`);
  console.log(`Lead_id updates — other: ${updateOther.length}, main: ${updateMain.length}`);
  console.log(`Missing records — in main: ${missingInMain.length}, in other: ${missingInOther.length}`);

  const patchedOther = await patchRecords(BASE_OTHER, updateOther, 'other');
  const patchedMain = await patchRecords(BASE_MAIN, updateMain, 'main');
  const createdOther = await createRecords(BASE_OTHER, missingInOther, 'other');
  const createdMain = await createRecords(BASE_MAIN, missingInMain, 'main');

  console.log(`Summary: patched ${patchedOther} other + ${patchedMain} main; created ${createdOther} other + ${createdMain} main`);
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
