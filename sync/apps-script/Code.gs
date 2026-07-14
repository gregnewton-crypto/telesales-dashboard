/**
 * Airtable → Google Sheets sync (Apps Script)
 *
 * Setup:
 * 1. Paste this file, set your token, Save
 * 2. Run "setup" once
 *
 * Large tables: each scheduled run syncs ONE tab only (alternates).
 * To sync manually: run syncAdversusApi or syncDatabowlLeads
 */

const CONFIG = {
  AIRTABLE_TOKEN: 'pat_PASTE_YOUR_TOKEN_HERE',
  BASE_ID: 'appZoN6xBB9mDv8h4',
  STATUS_SHEET: 'Sync Status',
  WRITE_BATCH_SIZE: 500,
  TABLES: [
    { id: 'tblQcfo7qgQCv7o3n', sheet: 'Adversus API' },
    { id: 'tbllpLbEtTkmMQOY9', sheet: 'Databowl Leads' },
  ],
};

function setup() {
  const props = PropertiesService.getScriptProperties();
  props.setProperty('AIRTABLE_TOKEN', CONFIG.AIRTABLE_TOKEN);
  props.setProperty('SYNC_INDEX', '0');

  syncDatabowlLeads();

  createSyncTrigger_();

  SpreadsheetApp.getUi().alert(
    'Setup complete',
    'Databowl Leads synced. Scheduled sync alternates tabs every 15 minutes.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

/** Scheduled trigger — syncs one table per run to avoid timeouts */
function syncNow() {
  runWithLock_(function () {
    const props = PropertiesService.getScriptProperties();
    const index = parseInt(props.getProperty('SYNC_INDEX') || '0', 10);
    const table = CONFIG.TABLES[index % CONFIG.TABLES.length];

    syncOneTable_(table);

    props.setProperty('SYNC_INDEX', String((index + 1) % CONFIG.TABLES.length));
  });
}

function syncAdversusApi() {
  runWithLock_(function () {
    syncOneTable_(CONFIG.TABLES[0]);
  });
}

function syncDatabowlLeads() {
  runWithLock_(function () {
    syncOneTable_(CONFIG.TABLES[1]);
  });
}

function syncOneTable_(table) {
  const token = getToken_();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let result;

  try {
    const count = syncTable_(token, ss, table.id, table.sheet);
    result = { sheet: table.sheet, records: count, status: 'OK' };
  } catch (err) {
    result = { sheet: table.sheet, records: 0, status: 'ERROR: ' + String(err.message || err) };
    writeStatus_(ss, [result]);
    throw err;
  }

  writeStatus_(ss, [result]);
  SpreadsheetApp.flush();
}

function getToken_() {
  const token = PropertiesService.getScriptProperties().getProperty('AIRTABLE_TOKEN') || CONFIG.AIRTABLE_TOKEN;
  if (!token || token.indexOf('PASTE_YOUR_TOKEN') !== -1) {
    throw new Error('Set your Airtable token in CONFIG.AIRTABLE_TOKEN, then run setup() again.');
  }
  return token;
}

function runWithLock_(fn) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) {
    throw new Error('Sync already running. Wait for it to finish.');
  }
  try {
    fn();
  } finally {
    lock.releaseLock();
  }
}

function syncTable_(token, ss, tableId, sheetName) {
  const records = fetchAllAirtableRecords_(token, CONFIG.BASE_ID, tableId);
  const parsed = recordsToRows_(records);
  const headers = parsed.headers;
  const rows = parsed.rows;

  const sheet = getOrCreateSheet_(ss, sheetName);

  if (headers.length === 0) {
    sheet.clearContents();
    return 0;
  }

  sheet.clearContents();

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#522A10')
    .setFontColor('#FFE180');
  sheet.setFrozenRows(1);

  if (rows.length > 0) {
    writeRowsInBatches_(sheet, 2, headers.length, rows);
  }

  SpreadsheetApp.flush();
  return rows.length;
}

function writeRowsInBatches_(sheet, startRow, numCols, rows) {
  const batchSize = CONFIG.WRITE_BATCH_SIZE;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    sheet.getRange(startRow + i, 1, batch.length, numCols).setValues(batch);

    if (i > 0 && i % (batchSize * 4) === 0) {
      SpreadsheetApp.flush();
      Utilities.sleep(250);
    }
  }
}

function fetchAllAirtableRecords_(token, baseId, tableId) {
  const records = [];
  let offset = null;
  let page = 0;

  do {
    page++;
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

    if (page % 10 === 0) {
      Utilities.sleep(200);
    }
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

function writeStatus_(ss, results) {
  const sheet = getOrCreateSheet_(ss, CONFIG.STATUS_SHEET);
  const now = Utilities.formatDate(new Date(), 'UTC', "yyyy-MM-dd HH:mm:ss 'UTC'");

  const rows = [
    ['Last Sync (UTC)', now],
    [],
    ['Sheet Tab', 'Records Synced', 'Status'],
  ];

  results.forEach(function (result) {
    rows.push([result.sheet, result.records, result.status]);
  });

  sheet.clearContents();
  sheet.getRange(1, 1, rows.length, 3).setValues(rows);
  sheet.getRange(1, 1, 1, 3)
    .setFontWeight('bold')
    .setBackground('#522A10')
    .setFontColor('#FFE180');
  sheet.setFrozenRows(1);
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
