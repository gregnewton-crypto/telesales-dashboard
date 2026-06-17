// ============================================================
// AUTO-LINK NEW SALE TO SALES TEAM MEMBER
// Trigger: Record created in Butternut sales
// Match: Rep name + team name (Internal Telesales IE/UK)
//
// INPUT VARIABLES (set up in left panel):
//   1. recordId  = Airtable record ID (from trigger)
//   2. repName   = Direct Sales Rep Full Name (from trigger)
//   3. teamName  = Direct Sales Team Name (from trigger)
// ============================================================

var config = input.config();
var recordId = config.recordId;
var repName = config.repName;
var teamName = config.teamName;

// Only process Internal Telesales IE and UK
if (!repName || !teamName) {
    output.set("result", "SKIP: Missing rep name or team name");
} else if (teamName !== "Internal Telesales IE" && teamName !== "Internal Telesales UK") {
    output.set("result", "SKIP: Not a telesales team - " + teamName);
} else {
    var salesTeamTable = base.getTable("tblSi4IOG9bm7vOG5");

    // Load Sales Team records
    var teamRecords = await salesTeamTable.selectRecordsAsync({
        fields: ["Agent Name", "Region"]
    });

    // Map team name to expected region
    var teamToRegion = {
        "Internal Telesales IE": "Ireland",
        "Internal Telesales UK": "UK"
    };
    var expectedRegion = teamToRegion[teamName];

    // Normalize the rep name for matching (lowercase, no apostrophes)
    var normalizedRepName = repName.trim().toLowerCase().replace(/'/g, "");

    // Find matching team member
    var matchedMember = null;
    for (var i = 0; i < teamRecords.records.length; i++) {
        var rec = teamRecords.records[i];
        var agentName = rec.getCellValue("Agent Name");
        var region = rec.getCellValue("Region");

        if (!agentName) { continue; }

        var normalizedAgent = agentName.trim().toLowerCase().replace(/'/g, "");

        if (normalizedAgent === normalizedRepName) {
            // Check region matches if region is set
            if (region && region.name === expectedRegion) {
                matchedMember = rec;
                break;
            } else if (!region) {
                // No region set - match on name only
                matchedMember = rec;
                break;
            }
        }
    }

    if (!matchedMember) {
        output.set("result", "NO MATCH: " + repName + " / " + teamName);
    } else {
        // Get the link field by ID
        var salesLinkField = salesTeamTable.getField("fldmOJbNSVaE6ZOdX");

        // Get existing links
        var fullRecord = await salesTeamTable.selectRecordAsync(matchedMember.id);
        var currentLinks = fullRecord.getCellValue(salesLinkField);
        var newLinks = [];

        if (currentLinks && currentLinks.length > 0) {
            for (var j = 0; j < currentLinks.length; j++) {
                newLinks.push({id: currentLinks[j].id});
            }
        }

        // Add new sale if not already linked
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

        var updateObj = {};
        updateObj[salesLinkField.name] = newLinks;
        await salesTeamTable.updateRecordAsync(matchedMember.id, updateObj);

        output.set("result", "LINKED: " + repName + " -> " + matchedMember.getCellValue("Agent Name") + " (total: " + newLinks.length + ")");
    }
}
