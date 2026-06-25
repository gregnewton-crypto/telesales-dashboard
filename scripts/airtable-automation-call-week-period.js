/**
 * Airtable Automation script — paste into Automations → Run script
 *
 * Trigger: When a record is created or updated in "Adversus API"
 *   (especially when "Date" changes)
 *
 * Input variable:
 *   record → Airtable record ID (from the trigger step)
 *
 * Uses field IDs (not names) for stability.
 */
const CALLS_TABLE = 'Adversus API';

const FIELD_WEEK_FORMULA_ID = 'fldKqkIw6F4fSn7G0';   // ⚙️ Call Week (formula)
const FIELD_PERIOD_FORMULA_ID = 'fldOBCNahqAV4qzoq'; // ⚙️ Call Period (formula)
const FIELD_WEEK_SELECT_ID = 'flddaroXPNRnG4ZWB';   // ⚙️ Call Week
const FIELD_PERIOD_SELECT_ID = 'fld9AlkEM7bzxck6c';  // ⚙️ Call Period

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
const weekFormulaField = callsTable.getField(FIELD_WEEK_FORMULA_ID);
const periodFormulaField = callsTable.getField(FIELD_PERIOD_FORMULA_ID);
const weekSelectField = callsTable.getField(FIELD_WEEK_SELECT_ID);
const periodSelectField = callsTable.getField(FIELD_PERIOD_SELECT_ID);

const record = await callsTable.selectRecordAsync(recordId, {
  fields: [
    weekFormulaField,
    periodFormulaField,
    weekSelectField,
    periodSelectField,
  ],
});

if (!record) {
  output.set('status', 'Trigger record not found');
} else {
  const week = record.getCellValue(weekFormulaField);
  const period = record.getCellValue(periodFormulaField);
  const fields = {};

  if (week) {
    fields[weekSelectField.id] = { name: week };
  } else if (record.getCellValue(weekSelectField)) {
    fields[weekSelectField.id] = null;
  }

  if (period) {
    fields[periodSelectField.id] = { name: period };
  } else if (record.getCellValue(periodSelectField)) {
    fields[periodSelectField.id] = null;
  }

  if (Object.keys(fields).length) {
    await callsTable.updateRecordAsync(recordId, fields);
  }

  output.set('status', `Set week=${week || '(blank)'} period=${period || '(blank)'}`);
}
