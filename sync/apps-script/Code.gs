/**
 * Airtable → Google Sheets sync (Apps Script)
 *
 * Setup:
 * 1. Open your Google Sheet
 * 2. Extensions → Apps Script
 * 3. Select ALL existing code, delete it, paste this entire file
 * 4. Replace pat_PASTE_YOUR_TOKEN_HERE with your Airtable token
 * 5. Save, then run "setup" once
 */

const CONFIG = {
  AIRTABLE_TOKEN: 'pat_PASTE_YOUR_TOKEN_HERE',
  BASE_ID: 'appZoN6xBB9mDv8h4',
  TABLE_ID: 'tblQcfo7qgQCv7o3n',
  SHEET_NAME: 'Adversus API',
  STATUS_SHEET: 'Sync Status',
};

function setup() {
  const props = PropertiesService.getScriptProperties();
  props.setProperty('AIRTABLE_TOKEN', CONFIG.AIRTABLE_TOKEN);

  syncNow();
  createSyncTrigger_();

  SpreadsheetApp.getUi().alert(
    'Setup complete',
    'Sync ran once and will repeat every 15 minutes.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function syncNow() {
  const token = PropertiesService.getScriptProperties().getProperty('AIRTABLE_TOKEN') || CONFIG.AIRTABLE_TOKEN;
  if (!token || token.indexOf('PASTE_YOUR_TOKEN') !== -1) {
    throw new Error('Set your Airtable token in CONFIG.AIRTABLE_TOKEN, then run setup() again.');
  }

  const records = fetchAllAirtableRecords_(token, CONFIG.BASE_ID, CONFIG.TABLE_ID);
  const parsed = recordsToRows_(records);
  const headers = parsed.headers;
  const rows = parsed.rows;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getOrCreateSheet_(ss, CONFIG.SHEET_NAME);

  sheet.clear();
  if (headers.length === 0) {
    writeStatus_(ss, 0, 'No records returned from Airtable.');
    return;
  }

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#522A10')
    .setFontColor('#FFE180');
  sheet.setFrozenRows(1);

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }

  writeStatus_(ss, rows.length, 'OK');
}

function fetchAllAirtableRecords_(token, baseId, tableId) {
  const records = [];
  let offset = null;

  do {
    let url = 'https://api.airtable.com/v0/' + baseId + '/' + tableId + '?pageSize=100';
    if (offset) {
      url += '&offset=' + encodeURIComponent(offset);
    }

    const response = UrlFetchApp.fetch(url, {
      method: 'get',
      muteHttpExceptions: true,
      headers: { Authorization: 'Bearer ' + token },
    });

    if (response.getResponseCode() !== 200) {
      throw new Error('Airtable error ' + response.getResponseCode() + ': ' + response.getContentText());
    }

    const data = JSON.parse(response.getContentText());
    records.push.apply(records, data.records || []);
    offset = data.offset || null;
  } while (offset);

  return records;
}

function recordsToRows_(records) {
  const fieldNames = [];
  const seen = {};

  records.forEach(function (record) {
    Object.keys(record.fields || {}).forEach(function (field) {
      if (!seen[field]) {
        seen[field] = true;
        fieldNames.push(field);
      }
    });
  });

  const headers = ['Record ID', 'Created Time'].concat(fieldNames);
  const rows = records.map(function (record) {
    const fields = record.fields || {};
    return [record.id || '', record.createdTime || ''].concat(
      fieldNames.map(function (name) {
        return flattenValue_(fields[name]);
      })
    );
  });

  return { headers: headers, rows: rows };
}

function flattenValue_(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value.map(function (item) {
      if (typeof item === 'string') return item;
      if (item && item.name) return item.name;
      if (item && item.email) return item.email;
      if (item && item.url) return item.url;
      return JSON.stringify(item);
    }).join(', ');
  }
  if (typeof value === 'object') {
    if (value.name) return String(value.name);
    if (value.url) return String(value.url);
    return JSON.stringify(value);
  }
  return String(value);
}

function getOrCreateSheet_(ss, name) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}

function writeStatus_(ss, recordCount, message) {
  const sheet = getOrCreateSheet_(ss, CONFIG.STATUS_SHEET);
  const now = Utilities.formatDate(new Date(), 'UTC', "yyyy-MM-dd HH:mm:ss 'UTC'");
  sheet.clear();
  sheet.getRange(1, 1, 4, 2).setValues([
    ['Last Sync (UTC)', now],
    ['Records Synced', recordCount],
    ['Status', message],
    ['Table', CONFIG.TABLE_ID],
  ]);
}

function createSyncTrigger_() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === 'syncNow') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger('syncNow')
    .timeBased()
    .everyMinutes(15)
    .create();
}
