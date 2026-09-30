/**
 * Marro Data → Airtable (Google Apps Script)
 *
 * Script properties: AIRTABLE_PAT, AIRTABLE_BASE_ID, AIRTABLE_TABLE_ID, SHEET_NAME,
 *   FIRST_DATA_ROW, COL_RECORD_ID (42), COL_LAST_SYNCED (44), COL_SYNC_ERROR (45)
 *
 * runSyncMaxRows(5) — test
 * runSync — full sync (auto-continues if it hits the time limit)
 * runSyncContinue — resume after timeout (also scheduled automatically)
 * setupDailyMorningTrigger() — once daily
 */

var AIRTABLE_BATCH_SIZE_ = 10;
/** Stop before Apps Script hard limit; next chunk via runSyncContinue */
var MAX_RUN_MS_ = 25 * 60 * 1000;

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

function airtableFetch_(cfg, method, query, body) {
  const url =
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

/** One-time load: sync_key → record id (avoids per-row API search) */
function loadSyncKeyIndex_(cfg) {
  const index = {};
  let offset = null;
  do {
    let q = '?pageSize=100&fields%5B%5D=sync_key';
    if (offset) q += '&offset=' + encodeURIComponent(offset);
    const data = airtableFetch_(cfg, 'get', q);
    (data.records || []).forEach(function (rec) {
      const sk = rec.fields && rec.fields.sync_key;
      if (sk) index[sk] = rec.id;
    });
    offset = data.offset;
    if (offset) Utilities.sleep(220);
  } while (offset);
  return index;
}

function pushAirtableBatch_(cfg, creates, updates, index, stats) {
  for (let i = 0; i < updates.length; i += AIRTABLE_BATCH_SIZE_) {
    const slice = updates.slice(i, i + AIRTABLE_BATCH_SIZE_);
    airtableFetch_(cfg, 'patch', '', { records: slice });
    stats.updated += slice.length;
    Utilities.sleep(220);
  }
  for (let i = 0; i < creates.length; i += AIRTABLE_BATCH_SIZE_) {
    const slice = creates.slice(i, i + AIRTABLE_BATCH_SIZE_);
    const payload = slice.map(function (item) {
      return { fields: item.fields };
    });
    const data = airtableFetch_(cfg, 'post', '', { records: payload });
    (data.records || []).forEach(function (rec, j) {
      index[slice[j].syncKey] = rec.id;
      stats.created++;
    });
    Utilities.sleep(220);
  }
}

function writeStatusBatch_(sheet, cfg, statusList) {
  if (!statusList.length) return;
  const ts = new Date().toISOString();
  statusList.forEach(function (st) {
    const row = st.rowNum;
    if (st.recordId) {
      sheet.getRange(row, cfg.colRecordId).setValue(st.recordId);
    }
    if (st.error) {
      sheet.getRange(row, cfg.colSyncError).setValue(st.error);
    } else {
      sheet.getRange(row, cfg.colLastSynced).setValue(ts);
      sheet.getRange(row, cfg.colSyncError).setValue('');
    }
  });
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
      names.join(', ')
  );
}

function listSheetNames() {
  SpreadsheetApp.getActiveSpreadsheet().getSheets().forEach(function (s, i) {
    Logger.log(i + 1 + ': "' + s.getName() + '"');
  });
}

function scheduleContinue_() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'runSyncContinue') {
      ScriptApp.deleteTrigger(t);
    }
  });
  ScriptApp.newTrigger('runSyncContinue')
    .timeBased()
    .after(60 * 1000)
    .create();
  Logger.log('Scheduled runSyncContinue in ~1 minute');
}

function runSyncInternal_(maxRows, resetFromStart) {
  const props = PropertiesService.getScriptProperties();
  if (resetFromStart) {
    props.deleteProperty('SYNC_RESUME_ROW');
  }

  const cfg = getConfig_();
  const sheet = getDataSheet_(cfg);
  const lastRow = sheet.getLastRow();
  if (lastRow < cfg.firstDataRow) {
    Logger.log('No data rows');
    return;
  }

  let startRow = Number(props.getProperty('SYNC_RESUME_ROW') || cfg.firstDataRow);
  if (startRow < cfg.firstDataRow) startRow = cfg.firstDataRow;

  const t0 = Date.now();
  const stats = { created: 0, updated: 0, skipped: 0, errors: 0 };
  const index = loadSyncKeyIndex_(cfg);
  const readWidth = Math.max(cfg.lastDataCol, cfg.colSyncError);
  let rowNum = startRow;
  while (rowNum <= lastRow) {
    if (maxRows != null && rowNum - cfg.firstDataRow >= maxRows) break;
    if (Date.now() - t0 > MAX_RUN_MS_) {
      props.setProperty('SYNC_RESUME_ROW', String(rowNum));
      scheduleContinue_();
      Logger.log(
        'Time limit — paused at row ' +
          rowNum +
          '. Will continue automatically. Stats so far: ' +
          JSON.stringify(stats)
      );
      return;
    }

    let chunkEnd = Math.min(rowNum + 199, lastRow);
    if (maxRows != null) {
      const maxEnd = cfg.firstDataRow + maxRows - 1;
      if (chunkEnd > maxEnd) chunkEnd = maxEnd;
    }

    const rows = sheet.getRange(rowNum, 1, chunkEnd, readWidth).getValues();
    const creates = [];
    const updates = [];
    const statusList = [];

    for (let i = 0; i < rows.length; i++) {
      const absoluteRow = rowNum + i;
      const row = rows[i];
      if (!str_(row[3]) && !str_(row[18]) && !str_(row[5])) continue;

      const syncKey = buildSyncKey_(row);
      if (!syncKey) {
        stats.skipped++;
        statusList.push({
          rowNum: absoluteRow,
          recordId: '',
          error:
            'Missing sync key: need Created Date, Cat Name, and Admin User Link or Email',
        });
        continue;
      }

      const fields = rowToFields_(row);
      fields.sync_key = syncKey;

      const recordId = str_(row[cfg.colRecordId - 1]) || index[syncKey] || '';

      if (recordId) {
        updates.push({ id: recordId, fields: fields });
        statusList.push({ rowNum: absoluteRow, recordId: recordId, error: '' });
      } else {
        creates.push({ syncKey: syncKey, fields: fields });
        statusList.push({
          rowNum: absoluteRow,
          recordId: '',
          error: '',
          syncKey: syncKey,
        });
      }
    }

    try {
      pushAirtableBatch_(cfg, creates, updates, index, stats);
      statusList.forEach(function (st) {
        if (!st.error && !st.recordId && st.syncKey && index[st.syncKey]) {
          st.recordId = index[st.syncKey];
        }
      });
      writeStatusBatch_(sheet, cfg, statusList);
    } catch (e) {
      stats.errors++;
      Logger.log('Chunk error at row ' + rowNum + ': ' + e);
      throw e;
    }

    rowNum = chunkEnd + 1;
  }

  props.deleteProperty('SYNC_RESUME_ROW');
  Logger.log('Sync complete: ' + JSON.stringify(stats));
}

/** Full sync from row 2 (resets any paused job) */
function runSync() {
  runSyncInternal_(null, true);
}

/** Resume after timeout — also runs automatically via trigger */
function runSyncContinue() {
  runSyncInternal_(null, false);
}

/** Clear pause pointer to start from row 2 next time */
function runSyncResetProgress() {
  PropertiesService.getScriptProperties().deleteProperty('SYNC_RESUME_ROW');
  Logger.log('SYNC_RESUME_ROW cleared');
}

function runSyncMaxRows(n) {
  runSyncInternal_(n || 5, true);
}

function setupDailyMorningTrigger() {
  const hour = Number(
    PropertiesService.getScriptProperties().getProperty('SYNC_HOUR') || '7'
  );
  if (isNaN(hour) || hour < 0 || hour > 23) {
    throw new Error('SYNC_HOUR must be 0–23');
  }

  ScriptApp.getProjectTriggers().forEach(function (t) {
    const fn = t.getHandlerFunction();
    if (fn === 'runSync' || fn === 'runSyncContinue') {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger('runSync')
    .timeBased()
    .everyDays(1)
    .atHour(hour)
    .create();

  Logger.log('Daily trigger: runSync at hour ' + hour);
}

function listSyncTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    Logger.log(t.getHandlerFunction() + ' id=' + t.getUniqueId());
  });
}
