// ============================================================
// AUTOMATION: UK Databowl Leads to Adversus Matching
// ============================================================
// Runs on a schedule (e.g. every 2 hours, or daily).
// Matches UK Databowl leads to Adversus call records using
// the Databowl Lead ID. Populates:
//   - Linked record field (Adversus Calls)
//   - Called? field (Yes/No)
//   - Lead Week field (W1-W53)
//   - Lead Period field (P1-P13)
//
// All tables and fields referenced by ID, not name.
// ============================================================

// --- TABLE IDs ---
const TBL_UK       = "tblKCC8nxriWKXrEG";  // UK Databowl leads
const TBL_ADVERSUS = "tblQcfo7qgQCv7o3n";  // Adversus API

// --- UK LEAD FIELD IDs ---
const UK_LEAD_ID    = "fldfieeyeSxMYiiYY";  // Databowl Lead ID (number)
const UK_LEAD_DATE  = "fldKWnPLByPemnWzy";  // Lead Date (dateTime)
const UK_ADV_LINK   = "fldlDyTgP0Cedamra";  // Adversus Calls (linked record)
const UK_CALLED     = "fldA37YpPKOFlYXPj";  // Called? (singleSelect)
const UK_LEAD_WEEK  = "fldFCEhEfNICZSgfY";  // Lead Week (singleSelect)
const UK_LEAD_PERIOD = "fldUFDLokqWoUavsC"; // Lead Period (singleSelect)

// --- ADVERSUS FIELD IDs ---
const ADV_LEAD_ID  = "fld2NtZbn2LQQ2mSH";  // Databowl LeadId (number)

// --- PERIOD CALENDAR (4-week blocks of ISO weeks) ---
// P1 = W1-W4, P2 = W5-W8, ... P13 = W49-W52 (+W53)
function getPeriodForDate(dateStr) {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    const temp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    temp.setUTCDate(temp.getUTCDate() + 4 - (temp.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(temp.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((temp - yearStart) / (24 * 60 * 60 * 1000) + 1) / 7);
    const periodNum = Math.floor((weekNo - 1) / 4) + 1;
    return `P${periodNum > 13 ? 13 : periodNum}`;
}

// --- ISO WEEK ---
function getISOWeek(dateStr) {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    const temp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    temp.setUTCDate(temp.getUTCDate() + 4 - (temp.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(temp.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((temp - yearStart) / (24 * 60 * 60 * 1000) + 1) / 7);
    return `W${weekNo}`;
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

// 1. Load all Adversus records (just LeadId + record ID)
const advTable = base.getTable(TBL_ADVERSUS);
const advQuery = await advTable.selectRecordsAsync({
    fields: [ADV_LEAD_ID]
});

// Build map: Databowl LeadId -> [Adversus record IDs]
const advByLeadId = {};
for (const rec of advQuery.records) {
    const leadId = rec.getCellValue(ADV_LEAD_ID);
    if (leadId === null || leadId === undefined) continue;
    const key = String(leadId);
    if (!advByLeadId[key]) advByLeadId[key] = [];
    advByLeadId[key].push(rec.id);
}
console.log(`Adversus: ${advQuery.records.length} records, ${Object.keys(advByLeadId).length} unique lead IDs`);

// 2. Load all UK leads
const ukTable = base.getTable(TBL_UK);
const ukQuery = await ukTable.selectRecordsAsync({
    fields: [UK_LEAD_ID, UK_LEAD_DATE, UK_ADV_LINK, UK_CALLED, UK_LEAD_WEEK, UK_LEAD_PERIOD]
});
console.log(`UK leads: ${ukQuery.records.length} records`);

// 3. Build updates
const updates = [];

for (const rec of ukQuery.records) {
    const leadId = rec.getCellValue(UK_LEAD_ID);
    if (leadId === null || leadId === undefined) continue;

    const key = String(leadId);
    const matchedAdvIds = advByLeadId[key] || [];
    const hasCalls = matchedAdvIds.length > 0;

    // Check current state to avoid unnecessary writes
    const currentLinks = rec.getCellValue(UK_ADV_LINK) || [];
    const currentCalled = rec.getCellValue(UK_CALLED);
    const currentCalledName = currentCalled ? currentCalled.name : null;
    const currentWeek = rec.getCellValue(UK_LEAD_WEEK);
    const currentPeriod = rec.getCellValue(UK_LEAD_PERIOD);

    const currentLinkIds = new Set(currentLinks.map(l => l.id));
    const newLinkIds = new Set(matchedAdvIds);

    // Check if links need updating
    const linksMatch = currentLinkIds.size === newLinkIds.size &&
        [...currentLinkIds].every(id => newLinkIds.has(id));

    const targetCalled = hasCalls ? "Yes" : "No";
    const calledMatch = currentCalledName === targetCalled;

    // Calculate week and period from Lead Date
    const leadDate = rec.getCellValue(UK_LEAD_DATE);
    let targetWeek = null;
    let targetPeriod = null;
    if (leadDate) {
        targetWeek = getISOWeek(leadDate);
        targetPeriod = getPeriodForDate(leadDate);
    }
    const weekMatch = (currentWeek ? currentWeek.name : null) === targetWeek;
    const periodMatch = (currentPeriod ? currentPeriod.name : null) === targetPeriod;

    // Only update if something changed
    if (linksMatch && calledMatch && weekMatch && periodMatch) continue;

    const fields = {};

    if (!linksMatch) {
        fields[UK_ADV_LINK] = matchedAdvIds.map(id => ({ id }));
    }
    if (!calledMatch) {
        fields[UK_CALLED] = { name: targetCalled };
    }
    if (!weekMatch && targetWeek) {
        fields[UK_LEAD_WEEK] = { name: targetWeek };
    }
    if (!periodMatch && targetPeriod) {
        fields[UK_LEAD_PERIOD] = { name: targetPeriod };
    }

    updates.push({ id: rec.id, fields });
}

// 4. Write updates
console.log(`Writing ${updates.length} UK lead updates...`);
await batchUpdate(ukTable, updates);

const linked = updates.filter(u => u.fields[UK_ADV_LINK]).length;
console.log(`Done! ${linked} leads linked to Adversus, ${updates.length} total records updated`);
