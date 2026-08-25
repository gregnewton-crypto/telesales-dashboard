// Lead Spend Sync - AUTOMATION VERSION (daily 7am)
// Calculates weekly lead spend from Databowl tables and writes to Spend Tracker
// Safe to re-run (idempotent) - updates existing rows only

// ─── CPL Rate Mapping ────────────────────────────────────────────────────────
const CPL_MAP = {
    // BNB D2MS
    "BNB Leads.io List": 5.50,
    "BNB_Leads.io_TikTok_LeadAds": 4.00,
    "BNB Leads.io TikTok": 5.00,
    "BNB_Manna_Meta": 5.00,
    "BNB_MonEx_Generic": 2.50,
    "BNB_MonEx_CB": 2.50,
    "BNB_Leads.io_Meta_DBQuiz": 5.50,
    "BNB Leads.io YouTube": 5.50,
    // Marro
    "Marro_Leads.io_Meta": 4.00,
    "Marro_Leads.io_Meta_Wheel": 4.00,
    "Marro_Leads.io_Tiktok": 4.00,
    "Marro_Manna_Meta": 3.50,
    "Marro_MonEx_Generic": 2.50,
    "Marro_MonEx_CB": 2.50,
    // IE Internal
    "Ireland_Leads.io_Meta": 4.19,
};

// ─── ISO Week Helper ─────────────────────────────────────────────────────────
function getISOWeek(d) {
    if (!(d instanceof Date) || isNaN(d.getTime())) return null;
    const year = d.getUTCFullYear();
    function weekOneStart(yr) {
        const jan4 = new Date(Date.UTC(yr, 0, 4));
        const dow = jan4.getUTCDay() || 7;
        const start = new Date(jan4);
        start.setUTCDate(jan4.getUTCDate() - dow + 1);
        return start;
    }
    const w1This = weekOneStart(year);
    const w1Next = weekOneStart(year + 1);
    const w1Prev = weekOneStart(year - 1);
    if (d >= w1Next) return { year: year + 1, week: 1 };
    if (d >= w1This) return { year, week: Math.floor((d - w1This) / 604800000) + 1 };
    return { year: year - 1, week: Math.floor((d - w1Prev) / 604800000) + 1 };
}

// ─── Date Parsing Helper ──────────────────────────────────────────────────────
function parseDate(value) {
    if (!value) return null;
    const str = String(value).trim();
    // Try native Date parse (handles ISO 8601 and "YYYY-MM-DD HH:MM:SS")
    let d = new Date(str);
    if (!isNaN(d.getTime())) return d;
    // Try DD/MM/YYYY
    const dmyMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (dmyMatch) {
        d = new Date(Date.UTC(
            parseInt(dmyMatch[3], 10),
            parseInt(dmyMatch[2], 10) - 1,
            parseInt(dmyMatch[1], 10)
        ));
        if (!isNaN(d.getTime())) return d;
    }
    return null;
}

// ─── Spend Key Builder ────────────────────────────────────────────────────────
function buildSpendKey(isoWeek, channel, brand, region) {
    const wNum = String(isoWeek.week).padStart(2, "0");
    return `W${wNum} | ${channel} | ${brand} | ${region}`;
}

// ─── Batch Update Helper ──────────────────────────────────────────────────────
async function batchUpdate(table, updates) {
    const BATCH_SIZE = 50;
    let totalUpdated = 0;
    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
        const batch = updates.slice(i, i + BATCH_SIZE);
        await table.updateRecordsAsync(batch);
        totalUpdated += batch.length;
    }
    return totalUpdated;
}

// ─── Main Script ──────────────────────────────────────────────────────────────
console.log("# Lead Spend Sync");
console.log("Loading tables...");

// ─── Load Spend Tracker ───────────────────────────────────────────────────────
const spendTrackerTable = base.getTable("tblPZXML8MWg32vLU");

// Find field objects by name for reliable access
const spendTrackerFields = spendTrackerTable.fields;
const spendKeyField      = spendTrackerFields.find(f => f.name === "Spend Key");
const cplRateField       = spendTrackerFields.find(f => f.name === "⚙️ CPL Rate");
const leadsInField       = spendTrackerFields.find(f => f.name === "📊 Leads In");

if (!spendKeyField)  { console.log("ERROR: Could not find Spend Key field"); throw new Error("Missing field"); }
if (!cplRateField)   { console.log("ERROR: Could not find CPL Rate field"); throw new Error("Missing field"); }
if (!leadsInField)   { console.log("ERROR: Could not find Leads In field"); throw new Error("Missing field"); }

console.log(`Found Spend Tracker fields: Spend Key (${spendKeyField.id}), CPL Rate (${cplRateField.id}), Leads In (${leadsInField.id})`);

const spendTrackerQuery = await spendTrackerTable.selectRecordsAsync({
    fields: [spendKeyField]
});

// Build lookup: spendKey -> recordId
const spendKeyToRecordId = {};
for (const record of spendTrackerQuery.records) {
    const key = record.getCellValueAsString(spendKeyField);
    if (key) spendKeyToRecordId[key] = record.id;
}
console.log(`Spend Tracker loaded: ${Object.keys(spendKeyToRecordId).length} existing rows found.`);

// ─── Accumulator ─────────────────────────────────────────────────────────────
// weekData[spendKey] = { leads: number, totalSpend: number }
const weekData = {};

function accumulateLead(spendKey, cpl) {
    if (!weekData[spendKey]) {
        weekData[spendKey] = { leads: 0, totalSpend: 0 };
    }
    weekData[spendKey].leads += 1;
    weekData[spendKey].totalSpend += cpl;
}

// ─── Source Table Definitions ─────────────────────────────────────────────────
const SOURCE_TABLES = [
    {
        tableId:     "tblPosmpZAiDpHAkS",
        tableName:   "Marro Databowl",
        sourceFieldId: "fldMyWy61GygQN12A",
        dateFieldId:   "fldLnFWjchY9NkucS",
        channel:     "D2MS",
        brand:       "Marro",
        region:      "UK",
    },
    {
        tableId:     "tblaP748fEZbHYJHc",
        tableName:   "BNB D2MS Databowl",
        sourceFieldId: "fldQwzwzAVTHcS6jN",
        dateFieldId:   "fldMfxuExC2ZPkFdB",
        channel:     "D2MS",
        brand:       "Butternut",
        region:      "UK",
    },
    {
        tableId:     "tblKCC8nxriWKXrEG",
        tableName:   "UK Internal Databowl",
        sourceFieldId: "fldtuI3TcARwXkO5Z",
        dateFieldId:   "fldKWnPLByPemnWzy",
        channel:     "Internal Telesales",
        brand:       "Butternut",
        region:      "UK",
    },
    {
        tableId:     "tbllpLbEtTkmMQOY9",
        tableName:   "IE Internal Databowl",
        sourceFieldId: "fldobqbh7QFwKMZPK",
        dateFieldId:   "fldWONi9bjOIJBmqq",
        channel:     "Internal Telesales",
        brand:       "Butternut",
        region:      "IE",
    },
];

// ─── Process Each Source Table ────────────────────────────────────────────────
let grandTotalRecords = 0;
let grandMappedLeads  = 0;
let grandSkipped      = 0;
let grandOutOfYear    = 0;

for (const src of SOURCE_TABLES) {
    console.log(`\n---\n### Processing: ${src.tableName}`);

    const srcTable = base.getTable(src.tableId);

    // Get field objects by ID
    const sourceField = srcTable.fields.find(f => f.id === src.sourceFieldId);
    const dateField   = srcTable.fields.find(f => f.id === src.dateFieldId);

    if (!sourceField) {
        console.log(`**WARNING:** Source field ${src.sourceFieldId} not found in ${src.tableName}, skipping.`);
        continue;
    }
    if (!dateField) {
        console.log(`**WARNING:** Date field ${src.dateFieldId} not found in ${src.tableName}, skipping.`);
        continue;
    }

    console.log(`Fields resolved: source="${sourceField.name}", date="${dateField.name}"`);

    const query = await srcTable.selectRecordsAsync({
        fields: [sourceField, dateField]
    });

    let tableTotal   = query.records.length;
    let tableMapped  = 0;
    let tableSkipped = 0;
    let tableOutOfYear = 0;

    grandTotalRecords += tableTotal;

    for (const record of query.records) {
        // Get source value - handle both singleLineText and singleSelect
        let sourceValue = record.getCellValue(sourceField);
        if (sourceValue && typeof sourceValue === "object" && sourceValue.name) {
            // singleSelect returns { id, name, color }
            sourceValue = sourceValue.name;
        } else {
            sourceValue = sourceValue ? String(sourceValue).trim() : "";
        }

        // Get date value
        const dateRaw = record.getCellValue(dateField);
        const dateObj = parseDate(dateRaw);

        if (!dateObj) {
            tableSkipped++;
            continue;
        }

        // Only process 2026 records
        if (dateObj.getUTCFullYear() !== 2026) {
            tableOutOfYear++;
            continue;
        }

        // Look up CPL - skip unmapped sources
        const cpl = CPL_MAP[sourceValue];
        if (cpl === undefined) {
            tableSkipped++;
            continue;
        }

        // Calculate ISO week
        const isoWeek = getISOWeek(dateObj);
        if (!isoWeek) {
            tableSkipped++;
            continue;
        }

        // Build spend key and accumulate
        const spendKey = buildSpendKey(isoWeek, src.channel, src.brand, src.region);
        accumulateLead(spendKey, cpl);
        tableMapped++;
    }

    grandMappedLeads  += tableMapped;
    grandSkipped      += tableSkipped;
    grandOutOfYear    += tableOutOfYear;

    console.log(
        `Results: ${tableTotal} records total, ` +
        `${tableMapped} mapped (2026), ` +
        `${tableOutOfYear} outside 2026, ` +
        `${tableSkipped} skipped (unmapped/no-date).`
    );
}

// ─── Build Updates ────────────────────────────────────────────────────────────
console.log("\n---\n### Building Spend Tracker updates...");

const updates = [];
const noMatchKeys = [];

for (const [spendKey, data] of Object.entries(weekData)) {
    const recordId = spendKeyToRecordId[spendKey];
    if (!recordId) {
        noMatchKeys.push(spendKey);
        continue;
    }

    const weightedAvgCPL = data.leads > 0 ? data.totalSpend / data.leads : 0;

    updates.push({
        id: recordId,
        fields: {
            [leadsInField.id]:  data.leads,
            [cplRateField.id]:  Math.round(weightedAvgCPL * 100) / 100, // round to 2dp
        }
    });
}

console.log(`Updates prepared: ${updates.length} rows to update.`);

if (noMatchKeys.length > 0) {
    console.log(
        `**Warning:** ${noMatchKeys.length} spend keys had no matching row in Spend Tracker:\n` +
        noMatchKeys.map(k => `- \`${k}\``).join("\n")
    );
}

// ─── Execute Updates ──────────────────────────────────────────────────────────
if (updates.length > 0) {
    console.log("Writing updates to Spend Tracker (50 records per batch)...");
    const updated = await batchUpdate(spendTrackerTable, updates);
    console.log(`**Done.** ${updated} rows updated successfully.`);
} else {
    console.log("No updates to write.");
}

// ─── Summary Table ────────────────────────────────────────────────────────────
console.log("\n---\n## Summary");
console.log(
    `| Metric | Value |\n` +
    `|--------|-------|\n` +
    `| Total source records scanned | ${grandTotalRecords.toLocaleString()} |\n` +
    `| Leads mapped (2026 + known CPL) | ${grandMappedLeads.toLocaleString()} |\n` +
    `| Records outside 2026 | ${grandOutOfYear.toLocaleString()} |\n` +
    `| Records skipped (unmapped source / no date) | ${grandSkipped.toLocaleString()} |\n` +
    `| Spend Tracker rows updated | ${updates.length} |\n` +
    `| Spend keys with no matching row | ${noMatchKeys.length} |`
);

// ─── Per-Week Detail ──────────────────────────────────────────────────────────
if (Object.keys(weekData).length > 0) {
    console.log("\n### Weekly Breakdown (mapped leads only)");

    const sortedKeys = Object.keys(weekData).sort();
    let tableHeader = "| Spend Key | Leads In | Avg CPL | Total Spend |\n|-----------|----------|---------|-------------|";
    let tableRows = sortedKeys.map(key => {
        const d = weekData[key];
        const avg = d.leads > 0 ? (d.totalSpend / d.leads).toFixed(2) : "0.00";
        const inTracker = spendKeyToRecordId[key] ? "yes" : "**NO MATCH**";
        return `| ${key} | ${d.leads} | £${avg} | £${d.totalSpend.toFixed(2)} |`;
    });
    console.log(tableHeader + "\n" + tableRows.join("\n"));
}

console.log("\n**Script complete. Safe to re-run.**");
