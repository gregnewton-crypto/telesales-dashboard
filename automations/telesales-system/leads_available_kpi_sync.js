// ============================================================
// AUTOMATION: Leads Available KPI Sync
// ============================================================
// Runs on a schedule (e.g. daily, after the UK Adversus
// Matching automation has run).
//
// Counts how many leads per channel are still available
// (not sold, not disqualified) and writes the total to the
// CURRENT WEEK's KPI row in Weekly KPIs v2.
//
// A lead is UNAVAILABLE if the latest Adversus call status is:
//   - "Success"        (sold)
//   - "Not interested" (rejected)
//   - "Invalid"        (bad data)
//   - "Unqualified"    (does not qualify)
//
// A lead is AVAILABLE if:
//   - It has no Adversus calls at all (never called)
//   - Its latest Adversus call status is anything else
//     (e.g. Automatic redial, VIP callback, Private callback)
//
// Scope: Internal Telesales only (UK + IE).
// D2MS is excluded (no Adversus data).
//
// Also calculates Avg Lead Age per channel:
//   Average number of days since Lead Date for available leads.
//
// All tables and fields referenced by ID, not name.
// ============================================================

// --- TABLE IDs ---
const TBL_KPI      = "tblvzF0trb8F9TOpc";  // Weekly KPIs v2
const TBL_UK       = "tblKCC8nxriWKXrEG";  // UK Databowl leads
const TBL_IE       = "tbllpLbEtTkmMQOY9";  // IE Databowl Leads
const TBL_ADVERSUS = "tblQcfo7qgQCv7o3n";  // Adversus API

// --- KPI FIELD IDs ---
const KPI_KEY       = "fldoz2U4o0bguBW09";  // KPI Key
const KPI_AVAILABLE = "fld3fYMJbqqYYkCrv";  // Red Leads Available
const KPI_AVG_AGE   = "fldXmJzZCzVyUJWza";  // Red Avg Lead Age

// --- LEAD FIELD IDs ---
const UK_LEAD_ID   = "fldfieeyeSxMYiiYY";  // Databowl Lead ID (number)
const UK_LEAD_DATE = "fldKWnPLByPemnWzy";  // Lead Date (dateTime)
const IE_LEAD_ID   = "fldMdPK5aJu048h5e";  // Databowl Lead ID (number)
const IE_LEAD_DATE = "fldWONi9bjOIJBmqq";  // Lead Date (dateTime)

// --- ADVERSUS FIELD IDs ---
const ADV_LEAD_ID  = "fld2NtZbn2LQQ2mSH";  // Databowl LeadId (number)
const ADV_STATUS   = "fldYtOn2yX9OTdidf";  // Lead Status
const ADV_DATE     = "fld3B9Tf9tHjvj7zj";  // Date

// --- UNAVAILABLE STATUSES ---
const UNAVAILABLE = new Set([
    "Success",
    "Not interested",
    "Invalid",
    "Unqualified",
]);

// --- ISO WEEK (current) ---
function getCurrentISOWeek() {
    const now = new Date();
    const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((d - yearStart) / (24 * 60 * 60 * 1000) + 1) / 7);
    return { year: d.getUTCFullYear(), week: weekNo };
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

const today = new Date();
const todayStr = today.toISOString().slice(0, 10);

// 1. Load all Adversus records to build latest-status-per-lead map
const advTable = base.getTable(TBL_ADVERSUS);
const advQuery = await advTable.selectRecordsAsync({
    fields: [ADV_LEAD_ID, ADV_STATUS, ADV_DATE]
});

// For each lead, keep the latest call's status
// latestStatus[leadId] = { status, date }
const latestStatus = {};

for (const rec of advQuery.records) {
    const leadId = rec.getCellValue(ADV_LEAD_ID);
    if (leadId === null || leadId === undefined) continue;

    const status = rec.getCellValueAsString(ADV_STATUS);
    const dateVal = rec.getCellValue(ADV_DATE);
    if (!dateVal) continue;

    const key = String(leadId);
    const existing = latestStatus[key];

    if (!existing || dateVal > existing.date) {
        latestStatus[key] = { status, date: dateVal };
    }
}
console.log(`Adversus: ${advQuery.records.length} calls, ${Object.keys(latestStatus).length} unique leads with status`);

// 2. Load UK leads
const ukTable = base.getTable(TBL_UK);
const ukQuery = await ukTable.selectRecordsAsync({
    fields: [UK_LEAD_ID, UK_LEAD_DATE]
});

// 3. Load IE leads
const ieTable = base.getTable(TBL_IE);
const ieQuery = await ieTable.selectRecordsAsync({
    fields: [IE_LEAD_ID, IE_LEAD_DATE]
});

// 4. Count available leads per channel
function countAvailable(records, leadIdField, leadDateField, label) {
    let total = 0;
    let available = 0;
    let ageDaysSum = 0;

    for (const rec of records) {
        const leadId = rec.getCellValue(leadIdField);
        if (leadId === null || leadId === undefined) continue;
        total++;

        const key = String(leadId);
        const latest = latestStatus[key];

        // If no Adversus record, or latest status is not in unavailable set
        if (!latest || !UNAVAILABLE.has(latest.status)) {
            available++;

            // Calculate age for average
            const leadDate = rec.getCellValue(leadDateField);
            if (leadDate) {
                const ld = new Date(leadDate);
                const ageDays = Math.floor((today - ld) / (24 * 60 * 60 * 1000));
                if (ageDays >= 0) ageDaysSum += ageDays;
            }
        }
    }

    const avgAge = available > 0 ? Math.round(ageDaysSum / available) : 0;
    console.log(`${label}: ${total} total leads, ${available} available, avg age ${avgAge} days`);
    return { available, avgAge };
}

const ukResult = countAvailable(ukQuery.records, UK_LEAD_ID, UK_LEAD_DATE, "UK Internal");
const ieResult = countAvailable(ieQuery.records, IE_LEAD_ID, IE_LEAD_DATE, "IE Internal");

// 5. Find current week's KPI rows and write
const currentWeek = getCurrentISOWeek();
const weekStr = `W${String(currentWeek.week).padStart(2, "0")}`;

const kpiTable = base.getTable(TBL_KPI);
const kpiQuery = await kpiTable.selectRecordsAsync({
    fields: [KPI_KEY, KPI_AVAILABLE]
});

const channelData = {
    [`${weekStr} | Internal Telesales | Butternut | UK`]: ukResult,
    [`${weekStr} | Internal Telesales | Butternut | IE`]: ieResult,
};

const kpiUpdates = [];

for (const rec of kpiQuery.records) {
    const key = rec.getCellValueAsString(KPI_KEY);
    const data = channelData[key];
    if (!data) continue;

    kpiUpdates.push({
        id: rec.id,
        fields: {
            [KPI_AVAILABLE]: data.available,
            [KPI_AVG_AGE]: data.avgAge,
        }
    });
}

// 6. Write
console.log(`Writing Leads Available to ${kpiUpdates.length} KPI rows for ${weekStr}...`);
await batchUpdate(kpiTable, kpiUpdates);

console.log(`Done! ${weekStr} | UK: ${ukResult.available} available, IE: ${ieResult.available} available`);
