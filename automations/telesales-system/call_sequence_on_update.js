/**
 * Airtable Automation script — paste into Automations → Run script
 *
 * Trigger: When a record is created or updated in "Adversus API"
 *
 * Input variable:
 *   record → Airtable record ID (from the trigger step)
 */
const CALLS_TABLE = 'Adversus API';
const LEAD_LINK_IE = '☘ Databowl Leads';
const LEAD_LINK_UK = '🇬🇧 UK Databowl leads';
const CALL_NUMBER_FIELD = 'Call # for Lead';
const SESSION_START_FIELD = 'Session Start (No Offset)';
const TIMESTAMP_FIELD = 'Timestamp';

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

function parseTime(record) {
  const sessionStart = record.getCellValue(SESSION_START_FIELD);
  if (sessionStart) {
    const parsed = Date.parse(sessionStart);
    if (!Number.isNaN(parsed)) return parsed;
  }
  const timestamp = record.getCellValue(TIMESTAMP_FIELD);
  if (timestamp) {
    const parsed = Date.parse(timestamp);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return 0;
}

function leadKeyFromRecord(record) {
  const irish = record.getCellValue(LEAD_LINK_IE);
  if (irish?.length) return `ie:${irish[0].id}`;
  const uk = record.getCellValue(LEAD_LINK_UK);
  if (uk?.length) return `uk:${uk[0].id}`;
  return null;
}

const triggerRecord = await callsTable.selectRecordAsync(recordId, {
  fields: [LEAD_LINK_IE, LEAD_LINK_UK, SESSION_START_FIELD, TIMESTAMP_FIELD, CALL_NUMBER_FIELD],
});

if (!triggerRecord) {
  output.set('status', 'Trigger record not found');
} else {
  const leadKey = leadKeyFromRecord(triggerRecord);
  if (!leadKey) {
    if (triggerRecord.getCellValue(CALL_NUMBER_FIELD) !== null) {
      await callsTable.updateRecordAsync(recordId, { [CALL_NUMBER_FIELD]: null });
    }
    output.set('status', 'No lead linked — call number cleared');
  } else {
    const query = await callsTable.selectRecordsAsync({
      fields: [LEAD_LINK_IE, LEAD_LINK_UK, SESSION_START_FIELD, TIMESTAMP_FIELD, CALL_NUMBER_FIELD],
    });

    const leadCalls = query.records
      .filter((record) => leadKeyFromRecord(record) === leadKey)
      .sort((a, b) => {
        const diff = parseTime(a) - parseTime(b);
        if (diff !== 0) return diff;
        return a.id.localeCompare(b.id);
      });

    const updates = [];
    leadCalls.forEach((record, index) => {
      const callNumber = index + 1;
      if (record.getCellValue(CALL_NUMBER_FIELD) !== callNumber) {
        updates.push({
          id: record.id,
          fields: { [CALL_NUMBER_FIELD]: callNumber },
        });
      }
    });

    while (updates.length) {
      await callsTable.updateRecordsAsync(updates.splice(0, 50));
    }

    output.set('status', `Updated ${leadCalls.length} call(s) for ${leadKey}`);
  }
}
