#!/usr/bin/env node
/**
 * Links Adversus calls to Irish Databowl leads (when missing) and sets
 * "Call # for Lead" — the call's position in that lead's call history.
 *
 * Usage:
 *   AIRTABLE_API_KEY=pat_xxx node scripts/sync-call-sequence.mjs
 *   AIRTABLE_API_KEY=pat_xxx node scripts/sync-call-sequence.mjs --dry-run
 */

const BASE_ID = 'appZoN6xBB9mDv8h4';
const TABLE_CALLS = 'tblQcfo7qgQCv7o3n';
const TABLE_LEADS = 'tbllpLbEtTkmMQOY9';

const FIELD_LEAD_LINK = '☘ Databowl Leads';
const FIELD_DATABOWL_LEAD_ID = 'Databowl LeadId';
const FIELD_CALL_NUMBER = 'Call # for Lead';
const FIELD_SESSION_START = 'Session Start (No Offset)';
const FIELD_TIMESTAMP = 'Timestamp';
const FIELD_LEAD_DATABOWL_ID = 'Databowl Lead ID';

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

async function fetchAllRecords(tableId, fieldNames) {
  const records = [];
  let offset;
  do {
    const params = new URLSearchParams({ pageSize: '100' });
    if (offset) params.set('offset', offset);
    for (const field of fieldNames) params.append('fields[]', field);
    const data = await airtableFetch(`${tableId}?${params}`);
    records.push(...(data.records || []));
    offset = data.offset;
  } while (offset);
  return records;
}

function parseCallTime(record) {
  const fields = record.fields;
  const sessionStart = fields[FIELD_SESSION_START];
  if (sessionStart) {
    const parsed = Date.parse(sessionStart);
    if (!Number.isNaN(parsed)) return parsed;
  }
  const timestamp = fields[FIELD_TIMESTAMP];
  if (timestamp) {
    const parsed = Date.parse(timestamp);
    if (!Number.isNaN(parsed)) return parsed;
  }
  const created = Date.parse(record.createdTime);
  return Number.isNaN(created) ? 0 : created;
}

function leadIdFromCall(record) {
  const links = record.fields[FIELD_LEAD_LINK];
  return links?.[0] || null;
}

async function patchRecords(tableId, updates) {
  if (!updates.length) return;
  if (DRY_RUN) {
    console.log(`[dry-run] Would patch ${updates.length} record(s) on ${tableId}`);
    return;
  }
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const chunk = updates.slice(i, i + BATCH_SIZE);
    await airtableFetch(tableId, {
      method: 'PATCH',
      body: JSON.stringify({ records: chunk }),
    });
    console.log(`Patched ${Math.min(i + BATCH_SIZE, updates.length)}/${updates.length}`);
  }
}

async function main() {
  console.log(DRY_RUN ? 'Dry run — no writes.' : 'Syncing call links and call sequence numbers...');

  const [calls, leads] = await Promise.all([
    fetchAllRecords(TABLE_CALLS, [
      FIELD_LEAD_LINK,
      FIELD_DATABOWL_LEAD_ID,
      FIELD_CALL_NUMBER,
      FIELD_SESSION_START,
      FIELD_TIMESTAMP,
    ]),
    fetchAllRecords(TABLE_LEADS, [FIELD_LEAD_DATABOWL_ID]),
  ]);

  const leadByDatabowlId = new Map();
  for (const lead of leads) {
    const databowlId = lead.fields[FIELD_LEAD_DATABOWL_ID];
    if (databowlId != null) leadByDatabowlId.set(databowlId, lead.id);
  }

  const linkUpdates = [];
  let linkedNow = 0;
  for (const call of calls) {
    if (leadIdFromCall(call)) continue;
    const databowlId = call.fields[FIELD_DATABOWL_LEAD_ID];
    const leadId = databowlId != null ? leadByDatabowlId.get(databowlId) : null;
    if (!leadId) continue;
    linkUpdates.push({
      id: call.id,
      fields: { [FIELD_LEAD_LINK]: [leadId] },
    });
    call.fields[FIELD_LEAD_LINK] = [leadId];
    linkedNow++;
  }

  const callsByLead = new Map();
  for (const call of calls) {
    const leadId = leadIdFromCall(call);
    if (!leadId) continue;
    if (!callsByLead.has(leadId)) callsByLead.set(leadId, []);
    callsByLead.get(leadId).push(call);
  }

  const sequenceUpdates = [];
  let sequenceChanges = 0;
  for (const [, leadCalls] of callsByLead) {
    leadCalls.sort((a, b) => {
      const diff = parseCallTime(a) - parseCallTime(b);
      if (diff !== 0) return diff;
      return a.id.localeCompare(b.id);
    });

    leadCalls.forEach((call, index) => {
      const callNumber = index + 1;
      const current = call.fields[FIELD_CALL_NUMBER];
      if (current === callNumber) return;
      sequenceUpdates.push({
        id: call.id,
        fields: { [FIELD_CALL_NUMBER]: callNumber },
      });
      sequenceChanges++;
    });
  }

  console.log(`Calls: ${calls.length}`);
  console.log(`Leads: ${leads.length}`);
  console.log(`Calls linked to leads: ${calls.length - linkUpdates.length} existing, ${linkedNow} to link`);
  console.log(`Call # updates needed: ${sequenceChanges}`);

  await patchRecords(TABLE_CALLS, linkUpdates);
  await patchRecords(TABLE_CALLS, sequenceUpdates);

  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
