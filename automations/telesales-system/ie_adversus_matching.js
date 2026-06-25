// ============================================================
// AUTOMATION: IE Databowl Leads to Adversus Matching
// ============================================================
// Runs on a schedule (e.g. every 2 hours, or daily).
// Matches Irish Databowl leads to Adversus call records using
// the Databowl Lead ID. Populates:
//   - Linked record field (Adversus Calls)
//   - Called? field (Yes/No)
//   - Lead Week field (W1-W53)
//   - Lead Period field (P1-P13)
//
// Why this exists: the "link on Adversus record create" automation
// only runs once. Calls often arrive before the Databowl lead is
// imported, so the initial match fails and is never retried unless
// a scheduled backfill like this one runs. UK already had an
// equivalent script (uk_adversus_matching.js); this is the IE pair.
//
// All tables and fields referenced by ID, not name.
// ============================================================

// --- TABLE IDs ---
const TBL_IE       = "tbllpLbEtTkmMQOY9";  // ☘ Databowl Leads
const TBL_ADVERSUS = "tblQcfo7qgQCv7o3n";  // Adversus API

// --- IE LEAD FIELD IDs ---
const IE_LEAD_ID     = "fldMdPK5aJu048h5e";  // Databowl Lead ID (number)
const IE_LEAD_DATE   = "fldWONi9bjOIJBmqq";  // Lead Date (dateTime)
const IE_ADV_LINK    = "fld3DeParsIUfU1FL";  // 🔗 Adversus Calls (linked record)
const IE_CALLED      = "fldbOzjdQ1ChPuOMg";  // ⚙️ Called? (singleSelect)
const IE_LEAD_WEEK   = "fldhCZiJZKHL7jMa2";  // ⚙️ Lead Week (singleSelect)
const IE_LEAD_PERIOD = "fldR9ZWZC427boXv1";  // ⚙️ Lead Period (singleSelect)

// --- ADVERSUS FIELD IDs ---
const ADV_LEAD_ID = "fld2NtZbn2LQQ2mSH";  // Databowl LeadId (number)

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

function getISOWeek(dateStr) {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    const temp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    temp.setUTCDate(temp.getUTCDate() + 4 - (temp.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(temp.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((temp - yearStart) / (24 * 60 * 60 * 1000) + 1) / 7);
    return `W${weekNo}`;
}

async function batchUpdate(table, updates) {
    const BATCH = 50;
    for (let i = 0; i < updates.length; i += BATCH) {
        await table.updateRecordsAsync(updates.slice(i, i + BATCH));
    }
}

// 1. Load all Adversus records (LeadId + record ID)
const advTable = base.getTable(TBL_ADVERSUS);
const advQuery = await advTable.selectRecordsAsync({
    fields: [ADV_LEAD_ID],
});

const advByLeadId = {};
for (const rec of advQuery.records) {
    const leadId = rec.getCellValue(ADV_LEAD_ID);
    if (leadId === null || leadId === undefined) continue;
    const key = String(leadId);
    if (!advByLeadId[key]) advByLeadId[key] = [];
    advByLeadId[key].push(rec.id);
}
console.log(`Adversus: ${advQuery.records.length} records, ${Object.keys(advByLeadId).length} unique lead IDs`);

// 2. Load all IE leads
const ieTable = base.getTable(TBL_IE);
const ieQuery = await ieTable.selectRecordsAsync({
    fields: [IE_LEAD_ID, IE_LEAD_DATE, IE_ADV_LINK, IE_CALLED, IE_LEAD_WEEK, IE_LEAD_PERIOD],
});
console.log(`IE leads: ${ieQuery.records.length} records`);

// 3. Build updates
const updates = [];

for (const rec of ieQuery.records) {
    const leadId = rec.getCellValue(IE_LEAD_ID);
    if (leadId === null || leadId === undefined) continue;

    const key = String(leadId);
    const matchedAdvIds = advByLeadId[key] || [];
    const hasCalls = matchedAdvIds.length > 0;

    const currentLinks = rec.getCellValue(IE_ADV_LINK) || [];
    const currentCalled = rec.getCellValue(IE_CALLED);
    const currentCalledName = currentCalled ? currentCalled.name : null;
    const currentWeek = rec.getCellValue(IE_LEAD_WEEK);
    const currentPeriod = rec.getCellValue(IE_LEAD_PERIOD);

    const currentLinkIds = new Set(currentLinks.map((l) => l.id));
    const newLinkIds = new Set(matchedAdvIds);

    const linksMatch =
        currentLinkIds.size === newLinkIds.size &&
        [...currentLinkIds].every((id) => newLinkIds.has(id));

    const targetCalled = hasCalls ? "Yes" : "No";
    const calledMatch = currentCalledName === targetCalled;

    const leadDate = rec.getCellValue(IE_LEAD_DATE);
    let targetWeek = null;
    let targetPeriod = null;
    if (leadDate) {
        targetWeek = getISOWeek(leadDate);
        targetPeriod = getPeriodForDate(leadDate);
    }
    const weekMatch = (currentWeek ? currentWeek.name : null) === targetWeek;
    const periodMatch = (currentPeriod ? currentPeriod.name : null) === targetPeriod;

    if (linksMatch && calledMatch && weekMatch && periodMatch) continue;

    const fields = {};

    if (!linksMatch) {
        fields[IE_ADV_LINK] = matchedAdvIds.map((id) => ({ id }));
    }
    if (!calledMatch) {
        fields[IE_CALLED] = { name: targetCalled };
    }
    if (!weekMatch && targetWeek) {
        fields[IE_LEAD_WEEK] = { name: targetWeek };
    }
    if (!periodMatch && targetPeriod) {
        fields[IE_LEAD_PERIOD] = { name: targetPeriod };
    }

    updates.push({ id: rec.id, fields });
}

// 4. Write updates
console.log(`Writing ${updates.length} IE lead updates...`);
await batchUpdate(ieTable, updates);

const linked = updates.filter((u) => u.fields[IE_ADV_LINK]).length;
console.log(`Done! ${linked} leads linked to Adversus, ${updates.length} total records updated`);
