// ============================================================
// LINK NEW ADVERSUS CALL TO DATABOWL LEAD + SET DATE
// v4 - with error reporting and field IDs
// ============================================================

var config = input.config();
var recordId = config.recordId;

var LEADS_TABLE_ID = "tbllpLbEtTkmMQOY9";
var ADVERSUS_TABLE_ID = "tblQcfo7qgQCv7o3n";

// Field IDs to avoid emoji issues
var DATE_FIELD_ID = "fld3B9Tf9tHjvj7zj";
var LINK_FIELD_ID = "fld3DeParsIUfU1FL";

var adversusTable = base.getTable(ADVERSUS_TABLE_ID);
var leadsTable = base.getTable(LEADS_TABLE_ID);

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
        }
    }
} catch (err) {
    linkResult = "LINK ERROR: " + err.message;
}

output.set("result", "Date: " + dateResult + " | Link: " + linkResult);
