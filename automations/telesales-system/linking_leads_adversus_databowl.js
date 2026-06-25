// ============================================================
// LINK ADVERSUS CALLS ↔ DATABOWL LEADS + BACKFILL
// v5 — date on trigger call, full link backfill, Called? sync
// ============================================================
//
// AUTOMATION: "Linking Leads Adversus & Databowl"
// Trigger: When a record is created in "Adversus API"
//          (optional: also run on a schedule for extra safety)
// Input variable: recordId → Record ID from trigger
//
// What this does:
//   1. Sets Date on the trigger call (from Timestamp)
//   2. Backfills ALL Irish lead ↔ Adversus call links by Databowl Lead ID
//      (fixes calls that arrived before the lead was imported)
//   3. Syncs ⚙️ Called?, ⚙️ Lead Week, ⚙️ Lead Period on every lead
//      that needed a link or status fix
//
// All tables/fields referenced by ID to avoid emoji encoding issues.
// ============================================================

var config = input.config();
var recordId = config.recordId;

// --- TABLE IDs ---
var LEADS_TABLE_ID = "tbllpLbEtTkmMQOY9";
var ADVERSUS_TABLE_ID = "tblQcfo7qgQCv7o3n";

// --- ADVERSUS FIELD IDs ---
var DATE_FIELD_ID = "fld3B9Tf9tHjvj7zj";       // Date
var ADV_LEAD_ID = "fld2NtZbn2LQQ2mSH";         // Databowl LeadId

// --- IE LEAD FIELD IDs ---
var LINK_FIELD_ID = "fld3DeParsIUfU1FL";       // 🔗 Adversus Calls
var IE_LEAD_ID = "fldMdPK5aJu048h5e";           // Databowl Lead ID
var IE_LEAD_DATE = "fldWONi9bjOIJBmqq";          // Lead Date
var IE_CALLED = "fldbOzjdQ1ChPuOMg";             // ⚙️ Called?
var IE_LEAD_WEEK = "fldhCZiJZKHL7jMa2";           // ⚙️ Lead Week
var IE_LEAD_PERIOD = "fldR9ZWZC427boXv1";        // ⚙️ Lead Period

var adversusTable = base.getTable(ADVERSUS_TABLE_ID);
var leadsTable = base.getTable(LEADS_TABLE_ID);

// --- HELPERS ---

function getPeriodForDate(dateStr) {
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    var temp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    temp.setUTCDate(temp.getUTCDate() + 4 - (temp.getUTCDay() || 7));
    var yearStart = new Date(Date.UTC(temp.getUTCFullYear(), 0, 1));
    var weekNo = Math.ceil(((temp - yearStart) / (86400000) + 1) / 7);
    var periodNum = Math.floor((weekNo - 1) / 4) + 1;
    return "P" + (periodNum > 13 ? 13 : periodNum);
}

function getISOWeek(dateStr) {
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    var temp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    temp.setUTCDate(temp.getUTCDate() + 4 - (temp.getUTCDay() || 7));
    var yearStart = new Date(Date.UTC(temp.getUTCFullYear(), 0, 1));
    var weekNo = Math.ceil(((temp - yearStart) / (86400000) + 1) / 7);
    return "W" + weekNo;
}

function selectName(cell) {
    if (cell == null) return null;
    if (typeof cell === "object" && cell.name != null) return cell.name;
    return String(cell);
}

function setsEqual(a, b) {
    if (a.size !== b.size) return false;
    for (var id of a) {
        if (!b.has(id)) return false;
    }
    return true;
}

async function batchUpdate(table, updates) {
    var BATCH = 50;
    for (var i = 0; i < updates.length; i += BATCH) {
        await table.updateRecordsAsync(updates.slice(i, i + BATCH));
    }
}

// ============================================================
// JOB 1: SET DATE ON TRIGGER CALL (if recordId provided)
// ============================================================

var dateResult = "SKIPPED (no recordId)";

if (recordId) {
    try {
        var adversusRecord = await adversusTable.selectRecordAsync(recordId);
        if (!adversusRecord) {
            dateResult = "ERROR: Record not found " + recordId;
        } else {
            var timestamp = adversusRecord.getCellValue("Timestamp");
            if (timestamp && String(timestamp).trim() !== "") {
                var parsed = new Date(timestamp);
                if (!isNaN(parsed.getTime())) {
                    var year = parsed.getUTCFullYear();
                    var month = String(parsed.getUTCMonth() + 1);
                    if (month.length < 2) { month = "0" + month; }
                    var day = String(parsed.getUTCDate());
                    if (day.length < 2) { day = "0" + day; }
                    var dateString = year + "-" + month + "-" + day;

                    var dateUpdate = {};
                    dateUpdate[DATE_FIELD_ID] = dateString;
                    await adversusTable.updateRecordAsync(recordId, dateUpdate);
                    dateResult = "SET to " + dateString;
                } else {
                    dateResult = "PARSE ERROR: " + timestamp;
                }
            } else {
                dateResult = "NO TIMESTAMP";
            }
        }
    } catch (err) {
        dateResult = "DATE ERROR: " + err.message;
    }
}

// ============================================================
// JOB 2: BACKFILL ALL IE LEAD ↔ ADVERSUS LINKS + Called?
// ============================================================

var linkResult = "SKIPPED";

try {
    // Build map: Databowl LeadId → [Adversus record IDs]
    var advQuery = await adversusTable.selectRecordsAsync({
        fields: [ADV_LEAD_ID]
    });

    var advByLeadId = {};
    for (var rec of advQuery.records) {
        var leadIdVal = rec.getCellValue(ADV_LEAD_ID);
        if (leadIdVal === null || leadIdVal === undefined) continue;
        var key = String(leadIdVal);
        if (!advByLeadId[key]) advByLeadId[key] = [];
        advByLeadId[key].push(rec.id);
    }

    // Load all IE leads
    var ieQuery = await leadsTable.selectRecordsAsync({
        fields: [IE_LEAD_ID, IE_LEAD_DATE, LINK_FIELD_ID, IE_CALLED, IE_LEAD_WEEK, IE_LEAD_PERIOD]
    });

    var updates = [];
    var linksFixed = 0;
    var calledFixed = 0;

    for (var leadRec of ieQuery.records) {
        var databowlId = leadRec.getCellValue(IE_LEAD_ID);
        if (databowlId === null || databowlId === undefined) continue;

        var key = String(databowlId);
        var matchedAdvIds = advByLeadId[key] || [];
        var hasCalls = matchedAdvIds.length > 0;

        var currentLinks = leadRec.getCellValue(LINK_FIELD_ID) || [];
        var currentLinkIds = new Set(currentLinks.map(function(l) { return l.id; }));
        var newLinkIds = new Set(matchedAdvIds);

        var linksMatch = setsEqual(currentLinkIds, newLinkIds);

        var currentCalledName = selectName(leadRec.getCellValue(IE_CALLED));
        var targetCalled = hasCalls ? "Yes" : "No";
        var calledMatch = currentCalledName === targetCalled;

        var leadDate = leadRec.getCellValue(IE_LEAD_DATE);
        var targetWeek = leadDate ? getISOWeek(leadDate) : null;
        var targetPeriod = leadDate ? getPeriodForDate(leadDate) : null;
        var weekMatch = selectName(leadRec.getCellValue(IE_LEAD_WEEK)) === targetWeek;
        var periodMatch = selectName(leadRec.getCellValue(IE_LEAD_PERIOD)) === targetPeriod;

        if (linksMatch && calledMatch && weekMatch && periodMatch) continue;

        var fields = {};

        if (!linksMatch) {
            fields[LINK_FIELD_ID] = matchedAdvIds.map(function(id) { return { id: id }; });
            linksFixed++;
        }
        if (!calledMatch) {
            fields[IE_CALLED] = { name: targetCalled };
            calledFixed++;
        }
        if (!weekMatch && targetWeek) {
            fields[IE_LEAD_WEEK] = { name: targetWeek };
        }
        if (!periodMatch && targetPeriod) {
            fields[IE_LEAD_PERIOD] = { name: targetPeriod };
        }

        updates.push({ id: leadRec.id, fields: fields });
    }

    if (updates.length > 0) {
        await batchUpdate(leadsTable, updates);
    }

    linkResult = "Backfill: " + updates.length + " lead(s) updated (" +
        linksFixed + " link fixes, " + calledFixed + " Called? fixes)";

} catch (err) {
    linkResult = "BACKFILL ERROR: " + err.message;
}

output.set("result", "Date: " + dateResult + " | " + linkResult);
