/**
 * Airtable Automation script — paste into a "Run script" action.
 *
 * Recommended triggers (create two automations if needed):
 *  1. When a record is updated in "☘ Databowl Leads"
 *  2. When a record is created/updated in "Adversus Calls" (linked lead)
 *
 * Input config: add input variable `recordId` mapped to the Databowl Leads
 * record ID from the trigger step.
 */

const TABLE_NAME = "☘ Databowl Leads";

const FIELD_CALLED = "⚙ Called?";
const FIELD_TIME_CALLED = "Time lead has been called (single select)";
const FIELD_STATUS = "Adversus Lead Status (single select)";
const FIELD_OPEN_CLOSED = "Lead open/closed";
const FIELD_TIMES_CALLED = "Times Lead has been Called";
const FIELD_STATUS_LOOKUP = "Adversus Lead Status";

const CLOSED_STATUSES = new Set([
  "Not interested",
  "Invalid",
  "Success",
  "Unqualified",
]);
const OPEN_STATUSES = new Set([
  "Automatic redial",
  "VIP callback",
  "Private callback",
  "Shared callback",
]);
const VALID_STATUSES = new Set([...CLOSED_STATUSES, ...OPEN_STATUSES]);
const MAX_TIME_BUCKET = 20;

function latestLookupStatus(lookup) {
  if (!lookup || lookup.length === 0) return null;
  for (let i = lookup.length - 1; i >= 0; i -= 1) {
    if (VALID_STATUSES.has(lookup[i])) return lookup[i];
  }
  return lookup[lookup.length - 1];
}

function computeOpenClosed(status) {
  if (CLOSED_STATUSES.has(status)) return "Closed ";
  if (OPEN_STATUSES.has(status)) return "Open ";
  return "Open ";
}

const table = base.getTable(TABLE_NAME);
const record = await table.selectRecordAsync(input.config().recordId);

const times = record.getCellValue(FIELD_TIMES_CALLED) || 0;
const updates = {};

const called = times > 0 ? "Yes" : "No";
if (record.getCellValueAsString(FIELD_CALLED) !== called) {
  updates[FIELD_CALLED] = { name: called };
}

if (times > 0) {
  const timeValue = String(Math.min(times, MAX_TIME_BUCKET));
  if (record.getCellValueAsString(FIELD_TIME_CALLED) !== timeValue) {
    updates[FIELD_TIME_CALLED] = { name: timeValue };
  }
} else if (record.getCellValue(FIELD_TIME_CALLED)) {
  updates[FIELD_TIME_CALLED] = null;
}

const lookupRaw = record.getCellValue(FIELD_STATUS_LOOKUP) || [];
const lookupValues = lookupRaw.map((entry) =>
  typeof entry === "string" ? entry : entry?.name ?? String(entry)
);
const lookupStatus = latestLookupStatus(lookupValues);

if (lookupStatus && VALID_STATUSES.has(lookupStatus)) {
  if (record.getCellValueAsString(FIELD_STATUS) !== lookupStatus) {
    updates[FIELD_STATUS] = { name: lookupStatus };
  }
} else if (record.getCellValue(FIELD_STATUS)) {
  updates[FIELD_STATUS] = null;
}

const effectiveStatus =
  lookupStatus ||
  updates[FIELD_STATUS]?.name ||
  record.getCellValueAsString(FIELD_STATUS);
const openClosed = computeOpenClosed(effectiveStatus);
if (record.getCellValueAsString(FIELD_OPEN_CLOSED) !== openClosed) {
  updates[FIELD_OPEN_CLOSED] = { name: openClosed };
}

if (Object.keys(updates).length > 0) {
  await table.updateRecordAsync(record.id, updates);
}
