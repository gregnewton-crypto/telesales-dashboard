#!/usr/bin/env node
/**
 * Links Adversus calls to Databowl leads (Irish or UK when missing) and sets
 * "Call # for Lead" — the call's position in that lead's call history.
 *
 * Groups by Databowl LeadId when present so linked and unlinked calls for the
 * same lead share one sequence.
 *
 * Usage:
 *   AIRTABLE_API_KEY=pat_xxx node scripts/sync-call-sequence.mjs
 *   AIRTABLE_API_KEY=pat_xxx node scripts/sync-call-sequence.mjs --dry-run
 */

const BASE_ID = 'appZoN6xBB9mDv8h4';
const TABLE_CALLS = 'tblQcfo7qgQCv7o3n';
const TABLE_LEADS_IE = 'tbllpLbEtTkmMQOY9';
const TABLE_LEADS_UK = 'tblKCC8nxriWKXrEG';

// Field IDs on Adversus API (tblQcfo7qgQCv7o3n) — use IDs for writes
const FIELD_LEAD_LINK_IE_ID = 'fldXoPVNNChnJBYJE';
const FIELD_LEAD_LINK_UK_ID = 'fldsqdT38k8fgtUom';
const FIELD_DATABOWL_LEAD_ID_ID = 'fld2NtZbn2LQQ2mSH';
const FIELD_LEAD_ID_ID = 'fld51LngNnwaIRJfn';
const FIELD_CALL_NUMBER_ID = 'fldMSlD63aHqYAjPG';
const FIELD_SESSION_START_ID = 'fldUFKmef3lg0sRLn';
const FIELD_TIMESTAMP_ID = 'fldXQGEGMg4gxxPhI';

// Field names — Airtable returns these as keys in record.fields
const FIELD_LEAD_LINK_IE = '☘ Databowl Leads';
const FIELD_LEAD_LINK_UK = '🇬🇧 UK Databowl leads';
const FIELD_DATABOWL_LEAD_ID = 'Databowl LeadId';
const FIELD_LEAD_ID = 'Lead ID';
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

/** Group key — Databowl LeadId, then Adversus Lead ID, then lead link. */
function groupKeyFromCall(record) {
  const databowlId = record.fields[FIELD_DATABOWL_LEAD_ID];
  if (databowlId != null) return `db:${databowlId}`;
  const leadId = record.fields[FIELD_LEAD_ID];
  if (leadId != null) return `adv:${leadId}`;
  const irish = record.fields[FIELD_LEAD_LINK_IE]?.[0];
  if (irish) return `ie:${irish}`;
  const uk = record.fields[FIELD_LEAD_LINK_UK]?.[0];
  if (uk) return `uk:${uk}`;
  return null;
}

function hasLeadLink(record) {
  return Boolean(
    record.fields[FIELD_LEAD_LINK_IE]?.length ||
      record.fields[FIELD_LEAD_LINK_UK]?.length
  );
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

  const [calls, leadsIe, leadsUk] = await Promise.all([
    fetchAllRecords(TABLE_CALLS, [
      FIELD_LEAD_LINK_IE,
      FIELD_LEAD_LINK_UK,
      FIELD_DATABOWL_LEAD_ID,
      FIELD_LEAD_ID,
      FIELD_CALL_NUMBER,
      FIELD_SESSION_START,
      FIELD_TIMESTAMP,
    ]),
    fetchAllRecords(TABLE_LEADS_IE, [FIELD_LEAD_DATABOWL_ID]),
    fetchAllRecords(TABLE_LEADS_UK, [FIELD_LEAD_DATABOWL_ID]),
  ]);

  const leadByDatabowlIdIe = new Map();
  for (const lead of leadsIe) {
    const databowlId = lead.fields[FIELD_LEAD_DATABOWL_ID];
    if (databowlId != null) leadByDatabowlIdIe.set(databowlId, lead.id);
  }

  const leadByDatabowlIdUk = new Map();
  for (const lead of leadsUk) {
    const databowlId = lead.fields[FIELD_LEAD_DATABOWL_ID];
    if (databowlId != null) leadByDatabowlIdUk.set(databowlId, lead.id);
  }

  const linkUpdates = [];
  let linkedIe = 0;
  let linkedUk = 0;
  for (const call of calls) {
    if (hasLeadLink(call)) continue;
    const databowlId = call.fields[FIELD_DATABOWL_LEAD_ID];
    if (databowlId == null) continue;

    const ieLeadId = leadByDatabowlIdIe.get(databowlId);
    const ukLeadId = leadByDatabowlIdUk.get(databowlId);

    if (ieLeadId) {
      linkUpdates.push({
        id: call.id,
        fields: { [FIELD_LEAD_LINK_IE_ID]: [ieLeadId] },
      });
      call.fields[FIELD_LEAD_LINK_IE] = [ieLeadId];
      linkedIe++;
    } else if (ukLeadId) {
      linkUpdates.push({
        id: call.id,
        fields: { [FIELD_LEAD_LINK_UK_ID]: [ukLeadId] },
      });
      call.fields[FIELD_LEAD_LINK_UK] = [ukLeadId];
      linkedUk++;
    }
  }

  const callsByGroup = new Map();
  for (const call of calls) {
    const groupKey = groupKeyFromCall(call);
    if (!groupKey) continue;
    if (!callsByGroup.has(groupKey)) callsByGroup.set(groupKey, []);
    callsByGroup.get(groupKey).push(call);
  }

  const sequenceUpdates = [];
  let sequenceChanges = 0;
  for (const [, groupCalls] of callsByGroup) {
    groupCalls.sort((a, b) => {
      const diff = parseCallTime(a) - parseCallTime(b);
      if (diff !== 0) return diff;
      return a.id.localeCompare(b.id);
    });

    groupCalls.forEach((call, index) => {
      const callNumber = index + 1;
      const current = call.fields[FIELD_CALL_NUMBER];
      if (current === callNumber) return;
      sequenceUpdates.push({
        id: call.id,
        fields: { [FIELD_CALL_NUMBER_ID]: callNumber },
      });
      sequenceChanges++;
    });
  }

  const alreadyLinked = calls.filter(hasLeadLink).length - linkUpdates.length;
  const groupable = calls.filter((c) => groupKeyFromCall(c)).length;

  console.log(`Calls: ${calls.length}`);
  console.log(`Irish leads: ${leadsIe.length}, UK leads: ${leadsUk.length}`);
  console.log(`Already linked: ${alreadyLinked}`);
  console.log(`New links — Irish: ${linkedIe}, UK: ${linkedUk}`);
  console.log(`Groupable calls (by Databowl LeadId or link): ${groupable}`);
  console.log(`Call # updates needed: ${sequenceChanges}`);

  await patchRecords(TABLE_CALLS, linkUpdates);
  await patchRecords(TABLE_CALLS, sequenceUpdates);

  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
