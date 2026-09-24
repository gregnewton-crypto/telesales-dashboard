/**
 * Sync IE Telesales "Adversus Ireland" (view: Google sheet sync) into this spreadsheet.
 *
 * Setup:
 * 1. Create a blank Google Sheet (or open the target sheet).
 * 2. Extensions → Apps Script → paste this file → save project.
 * 3. Project Settings → Script properties:
 *      AIRTABLE_PAT   = your Airtable personal access token
 * 4. Run setupHalfHourSync once (authorize when prompted).
 * 5. Sync runs every 30 minutes; run syncAirtableToSheet manually anytime.
 */

const SYNC_CONFIG = {
  baseId: 'appIxUjQdnPPLvSrp',
  tableId: 'tblHzJwEqbcpOpXOf',
  viewId: 'viw2nCAuhRPkM51tb',
  sheetName: 'Adversus Ireland',
  metaSheetName: '_sync_meta',
  pageSize: 100,
  requestDelayMs: 220,
  writeBatchRows: 4000,
};

const PROP_AIRTABLE_PAT = 'AIRTABLE_PAT';

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Airtable sync')
    .addItem('Sync now', 'syncAirtableToSheet')
    .addItem('Install 30-minute trigger', 'setupHalfHourSync')
    .addItem('Remove triggers', 'removeSyncTriggers')
    .addToUi();
}

function setupHalfHourSync() {
  removeSyncTriggers();
  ScriptApp.newTrigger('syncAirtableToSheet')
    .timeBased()
    .everyMinutes(30)
    .create();
  syncAirtableToSheet();
}

function removeSyncTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === 'syncAirtableToSheet') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}

function syncAirtableToSheet() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) {
    Logger.log('Sync skipped: another run is in progress.');
    return;
  }

  const started = new Date();
  try {
    const token = PropertiesService.getScriptProperties().getProperty(PROP_AIRTABLE_PAT);
    if (!token) {
      throw new Error(
        'Missing Script property AIRTABLE_PAT. Add your Airtable personal access token in Project Settings → Script properties.'
      );
    }

    const fetched = fetchAllRecordsFromView_(token, SYNC_CONFIG);
    const fieldColumns = fetched.fieldColumns;
    const records = fetched.records;
    const header = ['airtable_record_id'].concat(fieldColumns);
    const rows = records.map(function (record) {
      return rowFromRecord_(record, fieldColumns);
    });

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getOrCreateSheet_(ss, SYNC_CONFIG.sheetName);
    sheet.clearContents();
    writeTable_(sheet, header, rows);

    writeMeta_(ss, {
      lastSync: started.toISOString(),
      recordCount: records.length,
      columnCount: header.length,
      viewId: SYNC_CONFIG.viewId,
      tableId: SYNC_CONFIG.tableId,
      baseId: SYNC_CONFIG.baseId,
    });

    Logger.log('Synced %s records at %s', records.length, started.toISOString());
  } finally {
    lock.releaseLock();
  }
}

function fetchAllRecordsFromView_(token, config) {
  const records = [];
  const fieldSet = {};
  let offset = null;
  let page = 0;

  do {
    page += 1;
    const query = ['pageSize=' + config.pageSize, 'view=' + encodeURIComponent(config.viewId)];
    if (offset) {
      query.push('offset=' + encodeURIComponent(offset));
    }
    const url =
      'https://api.airtable.com/v0/' +
      config.baseId +
      '/' +
      config.tableId +
      '?' +
      query.join('&');

    Utilities.sleep(config.requestDelayMs);
    const response = UrlFetchApp.fetch(url, {
      method: 'get',
      muteHttpExceptions: true,
      headers: { Authorization: 'Bearer ' + token },
    });

    const status = response.getResponseCode();
    const body = response.getContentText();
    if (status !== 200) {
      throw new Error('Airtable API error ' + status + ': ' + body);
    }

    const data = JSON.parse(body);
    const pageRecords = data.records || [];
    pageRecords.forEach(function (record) {
      records.push(record);
      Object.keys(record.fields || {}).forEach(function (fieldName) {
        fieldSet[fieldName] = true;
      });
    });
    offset = data.offset || null;
    if (page % 25 === 0) {
      Logger.log('Fetched page %s (%s records so far)', page, records.length);
    }
  } while (offset);

  const fieldColumns = Object.keys(fieldSet).sort();
  return { records: records, fieldColumns: fieldColumns };
}

function rowFromRecord_(record, fieldColumns) {
  const fields = record.fields || {};
  const row = [record.id];
  fieldColumns.forEach(function (column) {
    row.push(flattenAirtableValue_(fields[column]));
  });
  return row;
}

function flattenAirtableValue_(value) {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'boolean') {
    return value ? 'TRUE' : 'FALSE';
  }
  if (typeof value === 'number') {
    return String(value);
  }
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '';
    }
    if (typeof value[0] === 'string') {
      return value.join(', ');
    }
    if (typeof value[0] === 'object' && value[0] !== null) {
      if ('url' in value[0]) {
        return value
          .map(function (item) {
            return item.url || item.name || JSON.stringify(item);
          })
          .join(', ');
      }
      if ('name' in value[0]) {
        return value
          .map(function (item) {
            return item.name;
          })
          .join(', ');
      }
    }
    return value
      .map(function (item) {
        return JSON.stringify(item);
      })
      .join(', ');
  }
  if (typeof value === 'object') {
    if ('name' in value) {
      return String(value.name);
    }
    if ('url' in value) {
      return String(value.url);
    }
    return JSON.stringify(value);
  }
  return String(value);
}

function writeTable_(sheet, header, rows) {
  const width = header.length;
  const allRows = [header].concat(rows);
  const batchSize = SYNC_CONFIG.writeBatchRows;
  let startRow = 1;
  for (let i = 0; i < allRows.length; i += batchSize) {
    const chunk = allRows.slice(i, i + batchSize);
    sheet.getRange(startRow, 1, chunk.length, width).setValues(chunk);
    startRow += chunk.length;
  }
  sheet.setFrozenRows(1);
  if (width > 0) {
    sheet.autoResizeColumns(1, Math.min(width, 26));
  }
}

function writeMeta_(ss, meta) {
  const sheet = getOrCreateSheet_(ss, SYNC_CONFIG.metaSheetName);
  sheet.clearContents();
  const rows = Object.keys(meta)
    .sort()
    .map(function (key) {
      return [key, meta[key]];
    });
  sheet.getRange(1, 1, rows.length, 2).setValues(rows);
}

function getOrCreateSheet_(ss, name) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}
