/**
 * Airtable Automation script — paste into Automations → Run script
 *
 * Trigger: When a record is created or updated in "Adversus API"
 *   (especially when lead link or Databowl LeadId / session time changes)
 *
 * Input variable:
 *   record → Airtable record ID (from the trigger step)
 *
 * Uses field IDs (not names) for stability.
 */
const CALLS_TABLE = 'Adversus API';

const FIELD_LEAD_LINK_IE_ID = 'fldXoPVNNChnJBYJE';     // ☘ Databowl Leads
const FIELD_LEAD_LINK_UK_ID = 'fldsqdT38k8fgtUom';     // 🇬🇧 UK Databowl leads
const FIELD_DATABOWL_LEAD_ID = 'fld2NtZbn2LQQ2mSH';    // Databowl LeadId
const FIELD_LEAD_ID = 'fld51LngNnwaIRJfn';             // Lead ID (Adversus)
const FIELD_CALL_NUMBER_ID = 'fldMSlD63aHqYAjPG';      // Call # for Lead
const FIELD_SESSION_START_ID = 'fldUFKmef3lg0sRLn';    // Session Start (No Offset)
const FIELD_TIMESTAMP_ID = 'fldXQGEGMg4gxxPhI';         // Timestamp

const config = input.config();

const recordId =
  (typeof config.recordId === 'string' && config.recordId) ||
  (typeof config.record === 'string' && config.record) ||
  (config.record && config.record.id) ||
  (config.triggerRecord && config.triggerRecord.id);

if (!recordId) {
  throw new Error(
    'No record passed to script. Add input variable "record" mapped to Record ID from the trigger.'
  );
}

const callsTable = base.getTable(CALLS_TABLE);
const leadLinkIeField = callsTable.getField(FIELD_LEAD_LINK_IE_ID);
const leadLinkUkField = callsTable.getField(FIELD_LEAD_LINK_UK_ID);
const databowlLeadIdField = callsTable.getField(FIELD_DATABOWL_LEAD_ID);
const leadIdField = callsTable.getField(FIELD_LEAD_ID);
const callNumberField = callsTable.getField(FIELD_CALL_NUMBER_ID);
const sessionStartField = callsTable.getField(FIELD_SESSION_START_ID);
const timestampField = callsTable.getField(FIELD_TIMESTAMP_ID);

const queryFields = [
  leadLinkIeField,
  leadLinkUkField,
  databowlLeadIdField,
  leadIdField,
  callNumberField,
  sessionStartField,
  timestampField,
];

function parseTime(record) {
  const sessionStart = record.getCellValue(sessionStartField);
  if (sessionStart) {
    const parsed = Date.parse(sessionStart);
    if (!Number.isNaN(parsed)) return parsed;
  }
  const timestamp = record.getCellValue(timestampField);
  if (timestamp) {
    const parsed = Date.parse(timestamp);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return 0;
}

function groupKeyFromRecord(record) {
  const databowlId = record.getCellValue(databowlLeadIdField);
  if (databowlId != null) return `db:${databowlId}`;
  const leadId = record.getCellValue(leadIdField);
  if (leadId != null) return `adv:${leadId}`;
  const irish = record.getCellValue(leadLinkIeField);
  if (irish?.length) return `ie:${irish[0].id}`;
  const uk = record.getCellValue(leadLinkUkField);
  if (uk?.length) return `uk:${uk[0].id}`;
  return null;
}

const triggerRecord = await callsTable.selectRecordAsync(recordId, {
  fields: queryFields,
});

if (!triggerRecord) {
  output.set('status', 'Trigger record not found');
} else {
  const groupKey = groupKeyFromRecord(triggerRecord);
  if (!groupKey) {
    if (triggerRecord.getCellValue(callNumberField) !== null) {
      await callsTable.updateRecordAsync(recordId, {
        [callNumberField.id]: null,
      });
    }
    output.set('status', 'No Databowl LeadId, Lead ID, or lead link — call number cleared');
  } else {
    const query = await callsTable.selectRecordsAsync({
      fields: queryFields,
    });

    const groupCalls = query.records
      .filter((record) => groupKeyFromRecord(record) === groupKey)
      .sort((a, b) => {
        const diff = parseTime(a) - parseTime(b);
        if (diff !== 0) return diff;
        return a.id.localeCompare(b.id);
      });

    const updates = [];
    groupCalls.forEach((record, index) => {
      const callNumber = index + 1;
      if (record.getCellValue(callNumberField) !== callNumber) {
        updates.push({
          id: record.id,
          fields: { [callNumberField.id]: callNumber },
        });
      }
    });

    while (updates.length) {
      await callsTable.updateRecordsAsync(updates.splice(0, 50));
    }

    output.set('status', `Updated ${groupCalls.length} call(s) for ${groupKey}`);
  }
}
