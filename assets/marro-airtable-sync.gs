/**
 * Marro Data → Airtable (Google Apps Script)
 *
 * Script properties: AIRTABLE_PAT, AIRTABLE_BASE_ID, AIRTABLE_TABLE_ID, SHEET_NAME,
 *   HEADER_ROW, FIRST_DATA_ROW, COL_RECORD_ID (42), COL_LAST_SYNCED (44), COL_SYNC_ERROR (45)
 *
 * Run: runSyncMaxRows(5) first, then runSync() for all rows.
 * Schedule: run setupDailyMorningTrigger() once (default 7:00, script timezone).
 * Optional property: SYNC_HOUR (0–23, e.g. 7 for 7am).
 */

function getConfig_() {
  const p = PropertiesService.getScriptProperties();
  const cfg = {
    pat: p.getProperty('AIRTABLE_PAT'),
    baseId: p.getProperty('AIRTABLE_BASE_ID'),
    tableId: p.getProperty('AIRTABLE_TABLE_ID'),
    sheetName: (p.getProperty('SHEET_NAME') || '').trim(),
    firstDataRow: Number(p.getProperty('FIRST_DATA_ROW') || '2'),
    colRecordId: Number(p.getProperty('COL_RECORD_ID') || '42'),
    colLastSynced: Number(p.getProperty('COL_LAST_SYNCED') || '44'),
    colSyncError: Number(p.getProperty('COL_SYNC_ERROR') || '45'),
    lastDataCol: 41,
  };
  ['pat', 'baseId', 'tableId', 'sheetName'].forEach(function (key) {
    if (!cfg[key]) throw new Error('Missing script property for: ' + key);
  });
  return cfg;
}

function str_(v) {
  if (v === null || v === undefined || v === '') return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(v).trim();
}

/** Columns A–AO (1-based 4, 19, 39, 6) → sync_key */
function buildSyncKey_(row) {
  const created = str_(row[3]);
  const cat = str_(row[18]);
  const email = str_(row[5]).toLowerCase();
  const adminLink = str_(row[38]);
  if (!created || !cat) return '';
  const m = adminLink.match(/\/users\/(\d+)/);
  const userId = m ? m[1] : email;
  if (!userId) return '';
  return userId + '|' + cat.toLowerCase() + '|' + created;
}

function rowToFields_(row) {
  const pc = str_(row[26]);
  let part1 = str_(row[27]);
  let part2 = str_(row[28]);
  if (pc && (!part1 || !part2)) {
    const bits = pc.split(/\s+/);
    if (bits.length >= 2) {
      if (!part2) part2 = bits[bits.length - 1];
      if (!part1) part1 = bits.slice(0, -1).join(' ');
    } else if (bits.length === 1 && !part1) {
      part1 = bits[0];
    }
  }
  return {
    'Box 1 Week': str_(row[0]),
    'Created Week': str_(row[1]),
    'Sales Rep': str_(row[2]),
    'Created Date': str_(row[3]),
    'Customer Name': str_(row[4]),
    Email: str_(row[5]),
    Phone: str_(row[6]),
    'Box 1 Date': str_(row[7]),
    'Box 2 Date': str_(row[8]),
    Retained: str_(row[9]),
    'Days to Box 2': str_(row[10]),
    'Buyers Remorse': str_(row[11]),
    'Pause Date': str_(row[12]),
    'Sale To Pause': str_(row[13]),
    'Box 1 to Pause': str_(row[14]),
    Reason: str_(row[15]),
    'Pause Reason': str_(row[16]),
    'Sub Reason': str_(row[17]),
    'Cat Name': str_(row[18]),
    'Cat Breed': str_(row[19]),
    'Cat Weight': str_(row[20]),
    'Cat Age': str_(row[21]),
    'Body Type': str_(row[22]),
    'Eater Type': str_(row[23]),
    'Activity Level': str_(row[24]),
    'Health Issue': str_(row[25]),
    Postcode: pc,
    'Postcode part 1': part1,
    'Postcode part 2': part2,
    County: str_(row[29]),
    PASSED: str_(row[30]),
    'Days to Box 1': str_(row[31]),
    'Box 1- 2': str_(row[32]),
    'Box 1 to Pause (v1)': str_(row[33]),
    'Sale to Pause (v1)': str_(row[34]),
    'BOX 1 TO PAUSE (v2)': str_(row[35]),
    'Buyers Remorse (This ONe)': str_(row[36]),
    'Pouch Size In Grams': str_(row[37]),
    'Admin User Link': str_(row[38]),
    'Trial Box Duration In Days': str_(row[39]),
    'Count Animals': str_(row[40]),
  };
}

function escapeFormulaSingle_(s) {
  return String(s).replace(/'/g, "''");
}

function airtableFetch_(cfg, method, query, body) {
  let url =
    'https://api.airtable.com/v0/' +
    cfg.baseId +
    '/' +
    cfg.tableId +
    (query || '');
  const opts = {
    method: method,
    headers: {
      Authorization: 'Bearer ' + cfg.pat,
      'Content-Type': 'application/json',
    },
    muteHttpExceptions: true,
  };
  if (body) opts.payload = JSON.stringify(body);
  const resp = UrlFetchApp.fetch(url, opts);
  const code = resp.getResponseCode();
  const text = resp.getContentText();
  if (code >= 200 && code < 300) {
    return text ? JSON.parse(text) : {};
  }
  throw new Error('Airtable ' + code + ': ' + text);
}

function findRecordIdBySyncKey_(cfg, syncKey) {
  const formula =
    "{sync_key}='" + escapeFormulaSingle_(syncKey) + "'";
  const q =
    '?maxRecords=1&filterByFormula=' + encodeURIComponent(formula);
  const data = airtableFetch_(cfg, 'get', q);
  const rec = data.records && data.records[0];
  return rec ? rec.id : '';
}

function createRecord_(cfg, fields) {
  const data = airtableFetch_(cfg, 'post', '', {
    records: [{ fields: fields }],
  });
  return data.records[0].id;
}

function patchRecord_(cfg, recordId, fields) {
  airtableFetch_(cfg, 'patch', '', {
    records: [{ id: recordId, fields: fields }],
  });
}

function processRow_(cfg, sheet, rowNum, row, stats) {
  const syncKey = buildSyncKey_(row);
  if (!syncKey) {
    stats.skipped++;
    sheet.getRange(rowNum, cfg.colSyncError).setValue(
      'Missing sync key: need Created Date, Cat Name, and Admin User Link or Email'
    );
    return;
  }

  const fields = rowToFields_(row);
  fields.sync_key = syncKey;

  let recordId = str_(row[cfg.colRecordId - 1]);
  if (!recordId) {
    recordId = findRecordIdBySyncKey_(cfg, syncKey);
  }

  if (recordId) {
    patchRecord_(cfg, recordId, fields);
    stats.updated++;
  } else {
    recordId = createRecord_(cfg, fields);
    stats.created++;
  }

  sheet.getRange(rowNum, cfg.colRecordId).setValue(recordId);
  sheet.getRange(rowNum, cfg.colLastSynced).setValue(new Date().toISOString());
  sheet.getRange(rowNum, cfg.colSyncError).setValue('');
}

function getDataSheet_(cfg) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(cfg.sheetName);
  if (sheet) return sheet;
  const names = ss.getSheets().map(function (s) {
    return '"' + s.getName() + '"';
  });
  throw new Error(
    'Sheet not found: "' +
      cfg.sheetName +
      '". Tabs in this file: ' +
      names.join(', ') +
      '. Fix Script property SHEET_NAME to match exactly (or rename the tab).'
  );
}

/** Run once to log every tab name — pick one for SHEET_NAME */
function listSheetNames() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.getSheets().forEach(function (s, i) {
    Logger.log(i + 1 + ': "' + s.getName() + '"');
  });
}

function runSyncInternal_(maxRows) {
  const cfg = getConfig_();
  const sheet = getDataSheet_(cfg);

  const lastRow = sheet.getLastRow();
  if (lastRow < cfg.firstDataRow) {
    Logger.log('No data rows');
    return;
  }

  const stats = { created: 0, updated: 0, skipped: 0, errors: 0 };
  const readWidth = Math.max(cfg.lastDataCol, cfg.colSyncError);

  for (let rowNum = cfg.firstDataRow; rowNum <= lastRow; rowNum++) {
    if (maxRows != null && rowNum - cfg.firstDataRow >= maxRows) break;

    const row = sheet.getRange(rowNum, 1, rowNum, readWidth).getValues()[0];
    if (!str_(row[3]) && !str_(row[18]) && !str_(row[5])) continue;

    try {
      processRow_(cfg, sheet, rowNum, row, stats);
    } catch (e) {
      stats.errors++;
      sheet.getRange(rowNum, cfg.colSyncError).setValue(String(e.message || e));
    }
    Utilities.sleep(220);
  }

  Logger.log(JSON.stringify(stats));
}

/** Test with first 5 data rows */
function runSyncMaxRows(n) {
  runSyncInternal_(n || 5);
}

/** Full sync — every data row from row 2 to the last row (all dates/history in the sheet) */
function runSync() {
  runSyncInternal_(null);
}

/**
 * Run once to schedule runSync every day in the morning.
 * Timezone = Apps Script project timezone (Project Settings → Google Cloud Platform).
 * Re-running replaces any existing runSync time triggers.
 */
function setupDailyMorningTrigger() {
  const hour = Number(
    PropertiesService.getScriptProperties().getProperty('SYNC_HOUR') || '7'
  );
  if (isNaN(hour) || hour < 0 || hour > 23) {
    throw new Error('SYNC_HOUR must be 0–23');
  }

  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'runSync') {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger('runSync')
    .timeBased()
    .everyDays(1)
    .atHour(hour)
    .create();

  Logger.log(
    'Daily trigger set: runSync every day around ' +
      hour +
      ':00 (script timezone). First run tomorrow unless you run runSync manually now.'
  );
}

/** Lists scheduled triggers (Executions / Logs after run) */
function listSyncTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'runSync') {
      Logger.log('runSync trigger id=' + t.getUniqueId());
    }
  });
}
