// ============================================================
// AUTO-LINK NEW SALE TO PEOPLE (AGENT)
// v2 — uses 👤 People table (old Sales Team table was removed)
//
// PASTE INTO: automation named "Sales link"
// Trigger: When record created in Butternut sales
//
// INPUT VARIABLES:
//   recordId  = Airtable record ID (from trigger)
//   repName   = Direct Sales Rep Full Name (from trigger)
//   teamName  = Direct Sales Team Name (from trigger)
// ============================================================

var config = input.config();
var recordId = config.recordId;
var repName = config.repName;
var teamName = config.teamName;

var SALES_TABLE_ID = "tblxfl0X4kCjRfl5q";
var PEOPLE_TABLE_ID = "tblmHIlx4KLEscZJM";
var TEAMS_TABLE_ID = "tblbwveGqPRqX4hbV";

var SALES_AGENT_LINK = "fld7CLXlrIrOc1i9f";
var PERSON_NAME = "fldlV2uVCRdee9ZoU";
var PERSON_TEAM = "fldObk27n729kmXJV";
var TEAM_REGION = "fldOvNMK0e4JkcpnA";

var TEAM_TO_REGION = {
    "Internal Telesales IE": "Ireland",
    "Internal Telesales UK": "UK",
};

function normalizeName(name) {
    return String(name || "").trim().toLowerCase().replace(/'/g, "");
}

if (!repName || !teamName) {
    output.set("result", "SKIP: Missing rep name or team name");
} else if (teamName !== "Internal Telesales IE" && teamName !== "Internal Telesales UK") {
    output.set("result", "SKIP: Not a telesales team - " + teamName);
} else {
    var salesTable = base.getTable(SALES_TABLE_ID);
    var peopleTable = base.getTable(PEOPLE_TABLE_ID);
    var teamsTable = base.getTable(TEAMS_TABLE_ID);

    var expectedRegion = TEAM_TO_REGION[teamName];
    var normalizedRep = normalizeName(repName);

    var peopleQuery = await peopleTable.selectRecordsAsync({
        fields: [PERSON_NAME, PERSON_TEAM],
    });

    var teamsQuery = await teamsTable.selectRecordsAsync({
        fields: [TEAM_REGION],
    });

    var teamRegionById = {};
    for (var t = 0; t < teamsQuery.records.length; t++) {
        var teamRec = teamsQuery.records[t];
        var regionCell = teamRec.getCellValue(TEAM_REGION);
        teamRegionById[teamRec.id] = regionCell ? regionCell.name : "";
    }

    var matchedPerson = null;

    for (var i = 0; i < peopleQuery.records.length; i++) {
        var person = peopleQuery.records[i];
        var fullName = person.getCellValueAsString(PERSON_NAME);
        if (normalizeName(fullName) !== normalizedRep) continue;

        var teamLinks = person.getCellValue(PERSON_TEAM) || [];
        var regionMatch = false;

        for (var j = 0; j < teamLinks.length; j++) {
            var teamId = teamLinks[j].id;
            var region = teamRegionById[teamId];
            if (region === expectedRegion) {
                regionMatch = true;
                break;
            }
        }

        if (regionMatch || teamLinks.length === 0) {
            matchedPerson = person;
            break;
        }
    }

    if (!matchedPerson) {
        output.set("result", "NO MATCH: " + repName + " / " + teamName);
    } else {
        var saleRecord = await salesTable.selectRecordAsync(recordId, {
            fields: [salesTable.getField(SALES_AGENT_LINK)],
        });

        var currentLinks = saleRecord.getCellValue(SALES_AGENT_LINK) || [];
        var alreadyLinked = false;
        for (var k = 0; k < currentLinks.length; k++) {
            if (currentLinks[k].id === matchedPerson.id) {
                alreadyLinked = true;
                break;
            }
        }

        if (!alreadyLinked) {
            await salesTable.updateRecordAsync(recordId, {
                [SALES_AGENT_LINK]: [{ id: matchedPerson.id }],
            });
        }

        output.set(
            "result",
            "LINKED: " +
                repName +
                " -> " +
                matchedPerson.getCellValueAsString(PERSON_NAME) +
                " (" +
                matchedPerson.id +
                ")"
        );
    }
}
