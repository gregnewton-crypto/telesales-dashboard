// ============================================================
// AUTOMATION: Adversus Call Sync to Weekly KPIs v2 (v2)
// ============================================================
// Runs on a schedule (e.g. daily).
// Scans Adversus API table, aggregates call metrics per week
// and campaign, writes to Weekly KPIs v2.
//
// Metrics written:
//   - Red Total Calls (count of all calls)
//   - Red Connected Calls (calls with duration > 60 seconds)
//   - Red Talk Time Hrs (sum of all call durations in hours)
//   - Red Leads Attempted (unique leads called, any outcome)
//   - Red Leads Contacted (unique leads with a connected call)
//
// Connected call = Call Duration > 60 seconds (Greg confirmed)
// Connect Rate and Contact CVR are formula fields - auto-calculate.
//
// All tables and fields referenced by ID, not name.
// ============================================================

// --- TABLE IDs ---
const TBL_KPI      = "tblvzF0trb8F9TOpc";  // Weekly KPIs v2
const TBL_ADVERSUS = "tblQcfo7qgQCv7o3n";  // Adversus API

// --- KPI FIELD IDs ---
const KPI_KEY       = "fldoz2U4o0bguBW09";  // KPI Key
const KPI_TOTAL     = "fldizwgkaNdDSQezb";  // Red Total Calls
const KPI_CONNECTED = "fld7yJHqHSF4v1SiU";  // Red Connected Calls
const KPI_TALKTIME  = "fldji5JT2sT5UKyly";  // Red Talk Time Hrs
const KPI_ATTEMPTED = "fldy6UT2Ccq7dhjUP";  // Red Leads Attempted
const KPI_CONTACTED = "flddzarL3AQclY3rP";  // Red Leads Contacted

// --- ADVERSUS FIELD IDs ---
const ADV_CAMPAIGN = "fldhUBZMgVCCtOvSQ";  // Campaign Name
const ADV_DATE     = "fld3B9Tf9tHjvj7zj";  // Date
const ADV_DURATION = "fldN5rcqjERGoFWkW";  // Call Duration Number (formula, seconds)
const ADV_LEAD_ID  = "fld2NtZbn2LQQ2mSH";  // Databowl LeadId (number)

// --- CONNECTED CALL THRESHOLD ---
const CONNECTED_THRESHOLD = 60;  // seconds

// --- CAMPAIGN MAPPING ---
// Maps Adversus Campaign Name to KPI Key components
const CAMPAIGN_MAP = {
    "UK Butternut Main":      { channel: "Internal Telesales", brand: "Butternut", region: "UK" },
    "Ireland Butternut Main": { channel: "Internal Telesales", brand: "Butternut", region: "IE" },
};

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
    fields: [KPI_KEY, KPI_TOTAL]
});
const kpiLookup = {};
const kpiHasCallData = {};
for (const rec of kpiQuery.records) {
    const key = rec.getCellValueAsString(KPI_KEY);
    if (key) {
        kpiLookup[key] = rec.id;
        kpiHasCallData[rec.id] = rec.getCellValue(KPI_TOTAL) !== null;
    }
}
console.log(`KPI rows loaded: ${Object.keys(kpiLookup).length}`);

// 2. Scan Adversus table
const advTable = base.getTable(TBL_ADVERSUS);
const advQuery = await advTable.selectRecordsAsync({
    fields: [ADV_CAMPAIGN, ADV_DATE, ADV_DURATION, ADV_LEAD_ID]
});

const buckets = {};
let totalScanned = 0;
let totalMatched = 0;

for (const rec of advQuery.records) {
    totalScanned++;
    const campaign = rec.getCellValueAsString(ADV_CAMPAIGN);
    const mapping = CAMPAIGN_MAP[campaign];
    if (!mapping) continue;

    const dateVal = rec.getCellValue(ADV_DATE);
    if (!dateVal) continue;
    const iw = getISOWeek(dateVal);
    if (!iw || iw.year !== 2026) continue;

    totalMatched++;
    const kpiKey = `W${String(iw.week).padStart(2, "0")} | ${mapping.channel} | ${mapping.brand} | ${mapping.region}`;

    if (!buckets[kpiKey]) {
        buckets[kpiKey] = {
            totalCalls: 0,
            connected: 0,
            talkTimeSecs: 0,
            leadsAttempted: new Set(),
            leadsContacted: new Set(),
        };
    }
    const b = buckets[kpiKey];
    b.totalCalls++;

    const duration = rec.getCellValue(ADV_DURATION);
    const durationNum = typeof duration === "number" ? duration : Number(duration) || 0;

    if (durationNum > CONNECTED_THRESHOLD) b.connected++;
    b.talkTimeSecs += durationNum;

    // Track unique leads
    const leadId = rec.getCellValue(ADV_LEAD_ID);
    if (leadId !== null && leadId !== undefined) {
        const leadKey = String(leadId);
        b.leadsAttempted.add(leadKey);
        if (durationNum > CONNECTED_THRESHOLD) {
            b.leadsContacted.add(leadKey);
        }
    }
}
console.log(`Adversus: ${totalScanned} scanned, ${totalMatched} matched 2026`);

// 3. Build KPI updates
const kpiUpdates = [];
const kpiKeysWithData = new Set();

for (const [kpiKey, b] of Object.entries(buckets)) {
    const recId = kpiLookup[kpiKey];
    if (!recId) continue;
    kpiKeysWithData.add(recId);

    const talkTimeHrs = b.talkTimeSecs / 3600;

    kpiUpdates.push({
        id: recId,
        fields: {
            [KPI_TOTAL]: b.totalCalls,
            [KPI_CONNECTED]: b.connected,
            [KPI_TALKTIME]: Math.round(talkTimeHrs * 100) / 100,
            [KPI_ATTEMPTED]: b.leadsAttempted.size,
            [KPI_CONTACTED]: b.leadsContacted.size,
        }
    });
}

// Clear stale rows (had call data before but no calls match now)
for (const rec of kpiQuery.records) {
    if (!kpiKeysWithData.has(rec.id) && kpiHasCallData[rec.id]) {
        kpiUpdates.push({
            id: rec.id,
            fields: {
                [KPI_TOTAL]: null,
                [KPI_CONNECTED]: null,
                [KPI_TALKTIME]: null,
                [KPI_ATTEMPTED]: null,
                [KPI_CONTACTED]: null,
            }
        });
    }
}

// 4. Write
console.log(`Writing ${kpiUpdates.length} KPI call updates...`);
await batchUpdate(kpiTable, kpiUpdates);

// 5. Summary
const bucketKeys = Object.keys(buckets);
console.log(`Done! ${totalMatched} calls across ${bucketKeys.length} week/campaign buckets, ${kpiUpdates.length} KPI rows updated`);
