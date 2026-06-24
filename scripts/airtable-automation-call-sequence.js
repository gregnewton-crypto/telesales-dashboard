/**
 * Airtable Automation script — paste into Automations → Run script
 *
 * Trigger: When a record is created or updated in "Adversus API"
 *   (especially when "☘ Databowl Leads" or "Session Start (No Offset)" changes)
 *
 * Action input variable:
 *   recordId — from the trigger step (record ID)
 */
const CALLS_TABLE = 'Adversus API';
const LEAD_LINK_FIELD = '☘ Databowl Leads';
const CALL_NUMBER_FIELD = 'Call # for Lead';
const SESSION_START_FIELD = 'Session Start (No Offset)';
const TIMESTAMP_FIELD = 'Timestamp';

const { recordId } = input.config();
const callsTable = base.getTable(CALLS_TABLE);

function parseTime(fields) {
  const sessionStart = fields[SESSION_START_FIELD];
  if (sessionStart) {
    const parsed = Date.parse(sessionStart);
    if (!Number.isNaN(parsed)) return parsed;
  }
  const timestamp = fields[TIMESTAMP_FIELD];
  if (timestamp) {
    const parsed = Date.parse(timestamp);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return 0;
}

const triggerRecord = await callsTable.selectRecordAsync(recordId, {
  fields: [LEAD_LINK_FIELD, SESSION_START_FIELD, TIMESTAMP_FIELD, CALL_NUMBER_FIELD],
});

if (!triggerRecord) {
  output.set('status', 'Trigger record not found');
} else {
  const leadLinks = triggerRecord.getCellValue(LEAD_LINK_FIELD);
  if (!leadLinks || leadLinks.length === 0) {
    if (triggerRecord.getCellValue(CALL_NUMBER_FIELD) !== null) {
      await callsTable.updateRecordAsync(recordId, { [CALL_NUMBER_FIELD]: null });
    }
    output.set('status', 'No lead linked — call number cleared');
  } else {
    const leadId = leadLinks[0].id;
    const query = await callsTable.selectRecordsAsync({
      fields: [LEAD_LINK_FIELD, SESSION_START_FIELD, TIMESTAMP_FIELD, CALL_NUMBER_FIELD],
    });

    const leadCalls = query.records
      .filter((record) => {
        const links = record.getCellValue(LEAD_LINK_FIELD);
        return links && links[0] && links[0].id === leadId;
      })
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

    output.set('status', `Updated ${leadCalls.length} call(s) for lead ${leadId}`);
  }
}
