// ============================================================
// LINK NEW ADVERSUS CALL TO DATABOWL LEAD + SET DATE + SYNC LEAD FIELDS
// v5 - adds lead field sync after linking (Called?, status, open/closed)
//
// PASTE INTO: automation named "Linking Leads Adversus & Databowl"
// ============================================================

var config = input.config();
var recordId = config.recordId;

var LEADS_TABLE_ID = "tbllpLbEtTkmMQOY9";
var ADVERSUS_TABLE_ID = "tblQcfo7qgQCv7o3n";

var DATE_FIELD_ID = "fld3B9Tf9tHjvj7zj";
var LINK_FIELD_ID = "fld3DeParsIUfU1FL";

var FIELD = {
    TIMES_CALLED_ROLLUP: "fldsKBO1ZpAImfV8C",
    TIMES_CALLED_SELECT: "fldpGvpBn2J2DbXop",
    ADVERSUS_LOOKUP: "fld0XrXF3YtWqWSAN",
    ADVERSUS_SELECT: "fld9R1fOEzvXLCTzd",
    CALLED: "fldbOzjdQ1ChPuOMg",
    LEAD_OPEN_CLOSED: "fldBFGH4OGEBmuBID",
};

var CLOSED_STATUSES = {
    "success": true,
    "not interested": true,
    "invalid": true,
    "unqualified": true,
};

var adversusTable = base.getTable(ADVERSUS_TABLE_ID);
var leadsTable = base.getTable(LEADS_TABLE_ID);

function norm(text) {
    return String(text == null ? "" : text).trim().toLowerCase();
}

function lookupToText(cell) {
    if (cell == null || cell === "") return "";
    if (Array.isArray(cell)) {
        for (var i = cell.length - 1; i >= 0; i -= 1) {
            var text = String(cell[i] == null ? "" : cell[i]).trim();
            if (text) return text;
        }
        return "";
    }
    return String(cell).trim();
}

function resolveChoiceId(fieldMeta, valueText) {
    if (!valueText) return null;
    var key = norm(valueText);
    var choices = fieldMeta.options ? fieldMeta.options.choices : [];
    for (var i = 0; i < choices.length; i++) {
        if (norm(choices[i].name) === key) return choices[i].id;
        if (String(choices[i].name || "").trim() === String(valueText).trim()) return choices[i].id;
    }
    return null;
}

function resolveOpenClosedChoices(fieldMeta) {
    var choices = fieldMeta.options ? fieldMeta.options.choices : [];
    var openChoice = null;
    var closedChoice = null;
    for (var i = 0; i < choices.length; i++) {
        var name = String(choices[i].name || "");
        if (/\bopen\b/i.test(name)) openChoice = choices[i];
        if (/\bclosed\b/i.test(name)) closedChoice = choices[i];
    }
    return { openChoice: openChoice, closedChoice: closedChoice };
}

function resolveCalledChoices(fieldMeta) {
    var choices = fieldMeta.options ? fieldMeta.options.choices : [];
    var yes = null;
    var no = null;
    for (var i = 0; i < choices.length; i++) {
        var name = norm(choices[i].name);
        if (name === "yes") yes = choices[i];
        if (name === "no") no = choices[i];
    }
    return { yes: yes, no: no };
}

async function syncLeadFields(leadRecordId, triggerAdversusRecordId) {
    // Re-fetch after link — rollup/lookup can lag by a moment on the same run
    var loadFields = [
        FIELD.TIMES_CALLED_ROLLUP,
        FIELD.ADVERSUS_LOOKUP,
        LINK_FIELD_ID,
    ];
    var lead = await leadsTable.selectRecordAsync(leadRecordId, { fields: loadFields });
    if (!lead) return "SYNC SKIP: lead not found";

    var timesCalled = lead.getCellValue(FIELD.TIMES_CALLED_ROLLUP) || 0;
    var links = lead.getCellValue(LINK_FIELD_ID) || [];

    // Backfill if rollup has not caught up yet after linking
    if (timesCalled < links.length) {
        timesCalled = links.length;
    }

    var adversusText = lookupToText(lead.getCellValue(FIELD.ADVERSUS_LOOKUP));

    // Backfill status from the call that just triggered this automation
    if (!adversusText && triggerAdversusRecordId) {
        var callRec = await adversusTable.selectRecordAsync(triggerAdversusRecordId);
        if (callRec) {
            adversusText = String(callRec.getCellValueAsString("Lead Status") || "").trim();
        }
    }

    var timesSelectMeta = leadsTable.getField(FIELD.TIMES_CALLED_SELECT);
    var adversusSelectMeta = leadsTable.getField(FIELD.ADVERSUS_SELECT);
    var calledMeta = leadsTable.getField(FIELD.CALLED);
    var openClosedMeta = leadsTable.getField(FIELD.LEAD_OPEN_CLOSED);

    var calledChoices = resolveCalledChoices(calledMeta);
    var openClosedChoices = resolveOpenClosedChoices(openClosedMeta);

    var fields = {};
    var capped = Math.min(timesCalled, 20);
    var timesSelectId = timesCalled > 0 ? resolveChoiceId(timesSelectMeta, String(capped)) : null;
    var adversusSelectId = adversusText ? resolveChoiceId(adversusSelectMeta, adversusText) : null;

    if (timesSelectId) {
        fields[FIELD.TIMES_CALLED_SELECT] = { id: timesSelectId };
    } else if (timesCalled <= 0) {
        fields[FIELD.TIMES_CALLED_SELECT] = null;
    }

    if (adversusSelectId) {
        fields[FIELD.ADVERSUS_SELECT] = { id: adversusSelectId };
    } else if (!adversusText) {
        fields[FIELD.ADVERSUS_SELECT] = null;
    }

    fields[FIELD.CALLED] = {
        id: timesCalled > 0 ? calledChoices.yes.id : calledChoices.no.id,
    };

    var isClosed = CLOSED_STATUSES[norm(adversusText)] || timesCalled > 10;
    fields[FIELD.LEAD_OPEN_CLOSED] = {
        id: isClosed ? openClosedChoices.closedChoice.id : openClosedChoices.openChoice.id,
    };

    await leadsTable.updateRecordAsync(leadRecordId, fields);
    return "SYNCED lead fields (times=" + timesCalled + ", status=" + (adversusText || "blank") + ")";
}

// Step 1: Get the new Adversus record
var adversusRecord = await adversusTable.selectRecordAsync(recordId);
if (!adversusRecord) {
    output.set("result", "ERROR: Record not found " + recordId);
    throw new Error("Record not found");
}

// ---- JOB 1: SET THE DATE ----
var dateResult = "SKIPPED";
try {
    var timestamp = adversusRecord.getCellValue("Timestamp");
    if (timestamp && timestamp.trim() !== "") {
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
} catch (err) {
    dateResult = "DATE ERROR: " + err.message;
}

// ---- JOB 2: LINK TO DATABOWL LEAD ----
var linkResult = "SKIPPED";
var syncResult = "SKIPPED";
var matchedLeadId = null;

try {
    var databowlLeadId = adversusRecord.getCellValue("Databowl LeadId");

    if (!databowlLeadId) {
        linkResult = "SKIP: No Databowl LeadId";
    } else {
        var leadRecords = await leadsTable.selectRecordsAsync({
            fields: ["Databowl Lead ID"]
        });

        var matchedLead = null;
        for (var i = 0; i < leadRecords.records.length; i++) {
            var record = leadRecords.records[i];
            var leadId = record.getCellValue("Databowl Lead ID");
            if (leadId && String(leadId) === String(databowlLeadId)) {
                matchedLead = record;
                break;
            }
        }

        if (!matchedLead) {
            linkResult = "NO MATCH: No lead with ID " + databowlLeadId;
        } else {
            matchedLeadId = matchedLead.id;
            var fullLead = await leadsTable.selectRecordAsync(matchedLead.id);
            var currentLinks = fullLead.getCellValue(LINK_FIELD_ID);
            var newLinks = [];

            if (currentLinks && currentLinks.length > 0) {
                for (var j = 0; j < currentLinks.length; j++) {
                    newLinks.push({id: currentLinks[j].id});
                }
            }

            var alreadyLinked = false;
            for (var k = 0; k < newLinks.length; k++) {
                if (newLinks[k].id === recordId) {
                    alreadyLinked = true;
                    break;
                }
            }

            if (!alreadyLinked) {
                newLinks.push({id: recordId});
            }

            var linkUpdate = {};
            linkUpdate[LINK_FIELD_ID] = newLinks;
            await leadsTable.updateRecordAsync(matchedLead.id, linkUpdate);

            linkResult = "LINKED to lead " + databowlLeadId + " (total: " + newLinks.length + ")";

            // ---- JOB 3: SYNC LEAD FIELDS AFTER LINK ----
            try {
                syncResult = await syncLeadFields(matchedLead.id, recordId);
            } catch (syncErr) {
                syncResult = "SYNC ERROR: " + syncErr.message;
            }
        }
    }
} catch (err) {
    linkResult = "LINK ERROR: " + err.message;
}

output.set("result", "Date: " + dateResult + " | Link: " + linkResult + " | Sync: " + syncResult);
