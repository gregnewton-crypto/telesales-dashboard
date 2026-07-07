// ============================================================
// LINK ADVERSUS CALLS ↔ DATABOWL LEADS + BACKFILL + STATUS SYNC
// v6.1
//
// PASTE INTO: automation named "Linking Leads Adversus & Databowl"
// Trigger: When record created in Adversus API
// Input:   recordId = {{recordId}}
// ============================================================

var config = input.config();
var recordId = config.recordId;

var LEADS_TABLE_ID = "tbllpLbEtTkmMQOY9";
var ADVERSUS_TABLE_ID = "tblQcfo7qgQCv7o3n";

var DATE_FIELD_ID = "fld3B9Tf9tHjvj7zj";
var LINK_FIELD_ID = "fld3DeParsIUfU1FL";
var ADV_LEAD_ID = "fld2NtZbn2LQQ2mSH";
var ADV_LEAD_STATUS = "fldYtOn2yX9OTdidf";
var ADV_SESSION_START = "fldUFKmef3lg0sRLn";
var ADV_TIMESTAMP = "fldCgp23OXpngGACH";

var IE_LEAD_ID = "fldMdPK5aJu048h5e";
var IE_LEAD_DATE = "fldWONi9bjOIJBmqq";
var IE_LEAD_WEEK = "fldhCZiJZKHL7jMa2";
var IE_LEAD_PERIOD = "fldR9ZWZC427boXv1";

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

var OPEN_STATUSES = {
    "automatic redial": true,
    "vip callback": true,
    "private callback": true,
    "shared callback": true,
};

var VIP_PRIVATE_STATUSES = {
    "vip callback": true,
    "private callback": true,
};

var STANDARD_CALL_LIMIT = 10;
var VIP_PRIVATE_CALL_LIMIT = 15;

var adversusTable = base.getTable(ADVERSUS_TABLE_ID);
var leadsTable = base.getTable(LEADS_TABLE_ID);

function norm(text) {
    return String(text == null ? "" : text).trim().toLowerCase();
}

function selectName(cell) {
    if (cell == null) return null;
    if (typeof cell === "object" && cell.name != null) return cell.name;
    return String(cell);
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

function parseCallTime(rec) {
    var sessionStart = rec.getCellValueAsString(ADV_SESSION_START);
    if (sessionStart) {
        var parsed = Date.parse(sessionStart);
        if (!isNaN(parsed)) return parsed;
    }
    var timestamp = rec.getCellValueAsString(ADV_TIMESTAMP);
    if (timestamp) {
        var parsedTs = Date.parse(timestamp);
        if (!isNaN(parsedTs)) return parsedTs;
    }
    return 0;
}

function isoWeekNumber(dateStr) {
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    var temp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    temp.setUTCDate(temp.getUTCDate() + 4 - (temp.getUTCDay() || 7));
    var yearStart = new Date(Date.UTC(temp.getUTCFullYear(), 0, 1));
    var diffDays = (temp - yearStart) / 86400000;
    return Math.ceil((diffDays + 1) / 7);
}

function getPeriodForDate(dateStr) {
    var weekNo = isoWeekNumber(dateStr);
    if (!weekNo) return null;
    var periodNum = Math.floor((weekNo - 1) / 4) + 1;
    return "P" + (periodNum > 13 ? 13 : periodNum);
}

function getISOWeek(dateStr) {
    var weekNo = isoWeekNumber(dateStr);
    if (!weekNo) return null;
    return "W" + weekNo;
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

function computeOpenClosed(adversusText, timesCalled) {
    var status = norm(adversusText);
    if (CLOSED_STATUSES[status]) return "closed";
    var limit = VIP_PRIVATE_STATUSES[status] ? VIP_PRIVATE_CALL_LIMIT : STANDARD_CALL_LIMIT;
    if (timesCalled > limit) return "closed";
    if (!status || OPEN_STATUSES[status]) return "open";
    return "open";
}

function setsEqual(a, b) {
    if (a.size !== b.size) return false;
    var iter = a.values();
    var next = iter.next();
    while (!next.done) {
        if (!b.has(next.value)) return false;
        next = iter.next();
    }
    return true;
}

function latestAdversusStatus(callRecords) {
    if (!callRecords || callRecords.length === 0) return "";
    var sorted = callRecords.slice().sort(function(a, b) {
        return parseCallTime(b) - parseCallTime(a);
    });
    for (var i = 0; i < sorted.length; i++) {
        var status = String(sorted[i].getCellValueAsString(ADV_LEAD_STATUS) || "").trim();
        if (status) return status;
    }
    return "";
}

function buildLeadUpdate(leadRec, matchedCallRecords, meta) {
    var matchedAdvIds = matchedCallRecords.map(function(r) { return r.id; });
    var hasCalls = matchedAdvIds.length > 0;

    var currentLinks = leadRec.getCellValue(LINK_FIELD_ID) || [];
    var currentLinkIds = new Set(currentLinks.map(function(l) { return l.id; }));
    var newLinkIds = new Set(matchedAdvIds);
    var linksMatch = setsEqual(currentLinkIds, newLinkIds);

    var timesCalled = hasCalls ? matchedAdvIds.length : 0;
    var rollupTimes = leadRec.getCellValue(FIELD.TIMES_CALLED_ROLLUP);
    if (typeof rollupTimes === "number" && rollupTimes > timesCalled) {
        timesCalled = rollupTimes;
    }

    var adversusText = latestAdversusStatus(matchedCallRecords);
    if (!adversusText) {
        adversusText = lookupToText(leadRec.getCellValue(FIELD.ADVERSUS_LOOKUP));
    }

    var targetCalled = hasCalls ? "Yes" : "No";
    var calledMatch = selectName(leadRec.getCellValue(FIELD.CALLED)) === targetCalled;

    var leadDate = leadRec.getCellValue(IE_LEAD_DATE);
    var targetWeek = leadDate ? getISOWeek(leadDate) : null;
    var targetPeriod = leadDate ? getPeriodForDate(leadDate) : null;
    var weekMatch = selectName(leadRec.getCellValue(IE_LEAD_WEEK)) === targetWeek;
    var periodMatch = selectName(leadRec.getCellValue(IE_LEAD_PERIOD)) === targetPeriod;

    var capped = Math.min(timesCalled, 20);
    var timesSelectId = timesCalled > 0 ? resolveChoiceId(meta.timesSelectMeta, String(capped)) : null;
    var adversusSelectId = adversusText ? resolveChoiceId(meta.adversusSelectMeta, adversusText) : null;

    var currentTimesSelectId = leadRec.getCellValue(FIELD.TIMES_CALLED_SELECT);
    var currentTimesSelectName = currentTimesSelectId ? currentTimesSelectId.name : null;
    var timesSelectMatch = (timesCalled <= 0 && !currentTimesSelectId) ||
        (timesSelectId && currentTimesSelectId && currentTimesSelectId.id === timesSelectId) ||
        (timesCalled > 0 && currentTimesSelectName === String(capped));

    var currentAdversusSelectId = leadRec.getCellValue(FIELD.ADVERSUS_SELECT);
    var adversusSelectMatch = (!adversusText && !currentAdversusSelectId) ||
        (adversusSelectId && currentAdversusSelectId && currentAdversusSelectId.id === adversusSelectId) ||
        (adversusText && currentAdversusSelectId && norm(currentAdversusSelectId.name) === norm(adversusText));

    var targetOpenClosed = computeOpenClosed(adversusText, timesCalled);
    var currentOpenClosed = norm(selectName(leadRec.getCellValue(FIELD.LEAD_OPEN_CLOSED)));
    var openClosedMatch = currentOpenClosed === targetOpenClosed;

    if (linksMatch && calledMatch && weekMatch && periodMatch &&
        timesSelectMatch && adversusSelectMatch && openClosedMatch) {
        return null;
    }

    var fields = {};

    if (!linksMatch) {
        fields[LINK_FIELD_ID] = matchedAdvIds.map(function(id) { return { id: id }; });
    }
    if (!calledMatch) {
        fields[FIELD.CALLED] = { id: hasCalls ? meta.calledChoices.yes.id : meta.calledChoices.no.id };
    }
    if (!weekMatch && targetWeek) {
        fields[IE_LEAD_WEEK] = { name: targetWeek };
    }
    if (!periodMatch && targetPeriod) {
        fields[IE_LEAD_PERIOD] = { name: targetPeriod };
    }
    if (!timesSelectMatch) {
        if (timesSelectId) {
            fields[FIELD.TIMES_CALLED_SELECT] = { id: timesSelectId };
        } else if (timesCalled <= 0) {
            fields[FIELD.TIMES_CALLED_SELECT] = null;
        }
    }
    if (!adversusSelectMatch) {
        if (adversusSelectId) {
            fields[FIELD.ADVERSUS_SELECT] = { id: adversusSelectId };
        } else if (!adversusText) {
            fields[FIELD.ADVERSUS_SELECT] = null;
        }
    }
    if (!openClosedMatch) {
        fields[FIELD.LEAD_OPEN_CLOSED] = {
            id: targetOpenClosed === "closed"
                ? meta.openClosedChoices.closedChoice.id
                : meta.openClosedChoices.openChoice.id,
        };
    }

    return fields;
}

async function batchUpdate(table, updates) {
    var BATCH = 50;
    for (var i = 0; i < updates.length; i += BATCH) {
        await table.updateRecordsAsync(updates.slice(i, i + BATCH));
    }
}

// ============================================================
// JOB 1: SET DATE ON TRIGGER CALL
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
// JOB 2: BACKFILL LINKS + SYNC ALL LEAD STATUS FIELDS
// ============================================================

var linkResult = "SKIPPED";

try {
    var meta = {
        timesSelectMeta: leadsTable.getField(FIELD.TIMES_CALLED_SELECT),
        adversusSelectMeta: leadsTable.getField(FIELD.ADVERSUS_SELECT),
        calledChoices: resolveCalledChoices(leadsTable.getField(FIELD.CALLED)),
        openClosedChoices: resolveOpenClosedChoices(leadsTable.getField(FIELD.LEAD_OPEN_CLOSED)),
    };

    var advQuery = await adversusTable.selectRecordsAsync({
        fields: [ADV_LEAD_ID, ADV_LEAD_STATUS, ADV_SESSION_START, ADV_TIMESTAMP],
    });

    var advByLeadId = {};
    for (var i = 0; i < advQuery.records.length; i++) {
        var advRec = advQuery.records[i];
        var leadIdVal = advRec.getCellValue(ADV_LEAD_ID);
        if (leadIdVal === null || leadIdVal === undefined) continue;
        var key = String(leadIdVal);
        if (!advByLeadId[key]) advByLeadId[key] = [];
        advByLeadId[key].push(advRec);
    }

    var ieQuery = await leadsTable.selectRecordsAsync({
        fields: [
            IE_LEAD_ID,
            IE_LEAD_DATE,
            LINK_FIELD_ID,
            IE_LEAD_WEEK,
            IE_LEAD_PERIOD,
            FIELD.TIMES_CALLED_ROLLUP,
            FIELD.TIMES_CALLED_SELECT,
            FIELD.ADVERSUS_LOOKUP,
            FIELD.ADVERSUS_SELECT,
            FIELD.CALLED,
            FIELD.LEAD_OPEN_CLOSED,
        ],
    });

    var updates = [];
    var linksFixed = 0;
    var statusFixed = 0;

    for (var j = 0; j < ieQuery.records.length; j++) {
        var leadRec = ieQuery.records[j];
        var databowlId = leadRec.getCellValue(IE_LEAD_ID);
        if (databowlId === null || databowlId === undefined) continue;

        var matchedCallRecords = advByLeadId[String(databowlId)] || [];
        var fields = buildLeadUpdate(leadRec, matchedCallRecords, meta);
        if (!fields) continue;

        if (fields[LINK_FIELD_ID]) linksFixed++;
        if (fields[FIELD.ADVERSUS_SELECT] || fields[FIELD.TIMES_CALLED_SELECT] ||
            fields[FIELD.LEAD_OPEN_CLOSED] || fields[FIELD.CALLED]) {
            statusFixed++;
        }

        updates.push({ id: leadRec.id, fields: fields });
    }

    if (updates.length > 0) {
        await batchUpdate(leadsTable, updates);
    }

    linkResult = "Backfill: " + updates.length + " lead(s) updated (" +
        linksFixed + " link fixes, " + statusFixed + " status fixes)";

} catch (err) {
    linkResult = "BACKFILL ERROR: " + err.message;
}

output.set("result", "Date: " + dateResult + " | " + linkResult);
