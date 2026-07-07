// ============================================================
// AUTOMATION: Databowl Leads Sync to Weekly KPIs v2
// ============================================================
// Runs on a schedule (e.g. daily).
// Scans 4 Databowl tables (one per channel), counts new leads
// per ISO week, writes "New Leads in Week" to Weekly KPIs v2.
//
// Table-to-channel mapping:
//   2026 Databowl BNB API   -> D2MS | Butternut | UK
//   2026 Databowl Marro API -> D2MS | Marro | UK
//   UK Databowl leads       -> Internal Telesales | Butternut | UK
//   Databowl Leads (IE)     -> Internal Telesales | Butternut | IE
//
// All tables and fields referenced by ID, not name.
// ============================================================

// --- TABLE IDs ---
const TBL_KPI      = "tblvzF0trb8F9TOpc";  // Weekly KPIs v2
const TBL_D2MS_BNB = "tblaP748fEZbHYJHc";  // 2026 Databowl BNB API
const TBL_D2MS_MAR = "tblPosmpZAiDpHAkS";  // 2026 Databowl Marro API
const TBL_UK       = "tblKCC8nxriWKXrEG";  // UK Databowl leads
const TBL_IE       = "tbllpLbEtTkmMQOY9";  // Databowl Leads (Ireland)

// --- KPI FIELD IDs ---
const KPI_KEY   = "fldoz2U4o0bguBW09";  // KPI Key
const KPI_LEADS = "fldARGrIPeiUu4tLV";  // 🔴 New Leads in Week

// --- DATE FIELD IDs (one per source table) ---
const D2MS_BNB_TS = "fldMfxuExC2ZPkFdB";  // timestamp (singleLineText)
const D2MS_MAR_TS = "fldLnFWjchY9NkucS";  // timestamp (singleLineText)
const UK_DATE     = "fldKWnPLByPemnWzy";  // Lead Date (dateTime)
const IE_DATE     = "fldFocENqMzcn3ySq";  // Date (date)

// --- CHANNEL MAPPING ---
// Each source table maps to a fixed channel/brand/region
const SOURCES = [
    { tableId: TBL_D2MS_BNB, dateField: D2MS_BNB_TS, channel: "D2MS",              brand: "Butternut", region: "UK", label: "D2MS BNB" },
    { tableId: TBL_D2MS_MAR, dateField: D2MS_MAR_TS, channel: "D2MS",              brand: "Marro",     region: "UK", label: "D2MS Marro" },
    { tableId: TBL_UK,       dateField: UK_DATE,      channel: "Internal Telesales", brand: "Butternut", region: "UK", label: "UK Internal" },
    { tableId: TBL_IE,       dateField: IE_DATE,       channel: "Internal Telesales", brand: "Butternut", region: "IE", label: "IE Internal" },
];

// --- ISO WEEK ---
function getISOWeek(dateStr) {
    const d = new Date(dateStr + "T12:00:00Z");
    if (isNaN(d.getTime())) return null;
    const year = d.getUTCFullYear();
    const jan4 = new Date(Date.UTC(year, 0, 4));
    const dow = jan4.getUTCDay() || 7;
    const w1Start = new Date(jan4);
    w1Start.setUTCDate(jan4.getUTCDate() - dow + 1);
    const jan4Prev = new Date(Date.UTC(year - 1, 0, 4));
    const dowP = jan4Prev.getUTCDay() || 7;
    const w1StartPrev = new Date(jan4Prev);
    w1StartPrev.setUTCDate(jan4Prev.getUTCDate() - dowP + 1);
    const jan4Next = new Date(Date.UTC(year + 1, 0, 4));
    const dowN = jan4Next.getUTCDay() || 7;
    const w1StartNext = new Date(jan4Next);
    w1StartNext.setUTCDate(jan4Next.getUTCDate() - dowN + 1);
    if (d >= w1StartNext) return { year: year + 1, week: 1 };
    if (d >= w1Start) return { year, week: Math.floor((d - w1Start) / (7*24*60*60*1000)) + 1 };
    return { year: year - 1, week: Math.floor((d - w1StartPrev) / (7*24*60*60*1000)) + 1 };
}

// --- EXTRACT DATE (YYYY-MM-DD) FROM VARIOUS FORMATS ---
// Handles: "2026-02-26T09:38:13.000Z", "2026-01-11 11:02", "2026-03-02"
function extractDate(val) {
    if (!val) return null;
    const s = String(val);
    // Try YYYY-MM-DD at the start (covers ISO, datetime, date-only)
    const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : null;
}

// --- BATCH UPDATE ---
async function batchUpdate(table, updates) {
    const BATCH = 50;
    for (let i = 0; i < updates.length; i += BATCH) {
        await table.updateRecordsAsync(updates.slice(i, i + BATCH));
    }
}

// ============================================================
// MAIN
// ============================================================

// 1. Load KPI rows
const kpiTable = base.getTable(TBL_KPI);
const kpiQuery = await kpiTable.selectRecordsAsync({
    fields: [KPI_KEY, KPI_LEADS]
});
const kpiLookup = {};
const kpiHasLeadData = {};
for (const rec of kpiQuery.records) {
    const key = rec.getCellValueAsString(KPI_KEY);
    if (key) {
        kpiLookup[key] = rec.id;
        kpiHasLeadData[rec.id] = rec.getCellValue(KPI_LEADS) !== null;
    }
}
console.log(`KPI rows loaded: ${Object.keys(kpiLookup).length}`);

// 2. Scan each Databowl source table
const buckets = {};

for (const src of SOURCES) {
    const tbl = base.getTable(src.tableId);
    const query = await tbl.selectRecordsAsync({ fields: [src.dateField] });
    let matched = 0;

    for (const rec of query.records) {
        const rawDate = rec.getCellValue(src.dateField);
        const dateStr = extractDate(rawDate);
        if (!dateStr) continue;

        const iw = getISOWeek(dateStr);
        if (!iw || iw.year !== 2026) continue;

        matched++;
        const kpiKey = `W${String(iw.week).padStart(2, "0")} | ${src.channel} | ${src.brand} | ${src.region}`;
        buckets[kpiKey] = (buckets[kpiKey] || 0) + 1;
    }

    console.log(`${src.label}: ${query.records.length} total, ${matched} matched 2026`);
}

// 3. Build KPI updates
const kpiUpdates = [];
const kpiKeysWithData = new Set();

for (const [kpiKey, count] of Object.entries(buckets)) {
    const recId = kpiLookup[kpiKey];
    if (!recId) continue;
    kpiKeysWithData.add(recId);
    kpiUpdates.push({ id: recId, fields: { [KPI_LEADS]: count } });
}

// Clear stale rows
for (const rec of kpiQuery.records) {
    if (!kpiKeysWithData.has(rec.id) && kpiHasLeadData[rec.id]) {
        kpiUpdates.push({ id: rec.id, fields: { [KPI_LEADS]: null } });
    }
}

// 4. Write
console.log(`Writing ${kpiUpdates.length} KPI lead updates...`);
await batchUpdate(kpiTable, kpiUpdates);

const bucketKeys = Object.keys(buckets);
const totalLeads = Object.values(buckets).reduce((a, b) => a + b, 0);
console.log(`Done! ${totalLeads} leads across ${bucketKeys.length} week/channel buckets, ${kpiUpdates.length} KPI rows updated`);
