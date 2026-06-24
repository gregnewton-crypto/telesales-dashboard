/**
 * Airtable Automation script — paste into Automations → Run script
 *
 * Trigger: When a record is created or updated in "Adversus API"
 *   (especially when "Date" changes)
 *
 * Input variable:
 *   record → Airtable record ID (from the trigger step)
 */
const CALLS_TABLE = 'Adversus API';
const FIELD_WEEK_FORMULA = '⚙️ Call Week (formula)';
const FIELD_PERIOD_FORMULA = '⚙️ Call Period (formula)';
const FIELD_WEEK_SELECT = '⚙️ Call Week';
const FIELD_PERIOD_SELECT = '⚙️ Call Period';

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

const record = await callsTable.selectRecordAsync(recordId, {
  fields: [FIELD_WEEK_FORMULA, FIELD_PERIOD_FORMULA, FIELD_WEEK_SELECT, FIELD_PERIOD_SELECT],
});

if (!record) {
  output.set('status', 'Trigger record not found');
} else {
  const week = record.getCellValue(FIELD_WEEK_FORMULA);
  const period = record.getCellValue(FIELD_PERIOD_FORMULA);
  const fields = {};

  if (week) {
    fields[FIELD_WEEK_SELECT] = { name: week };
  } else if (record.getCellValue(FIELD_WEEK_SELECT)) {
    fields[FIELD_WEEK_SELECT] = null;
  }

  if (period) {
    fields[FIELD_PERIOD_SELECT] = { name: period };
  } else if (record.getCellValue(FIELD_PERIOD_SELECT)) {
    fields[FIELD_PERIOD_SELECT] = null;
  }

  if (Object.keys(fields).length) {
    await callsTable.updateRecordAsync(recordId, fields);
  }

  output.set('status', `Set week=${week || '(blank)'} period=${period || '(blank)'}`);
}
