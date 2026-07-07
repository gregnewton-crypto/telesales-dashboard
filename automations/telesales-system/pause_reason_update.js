// ============================================================
// Pause Reason Analysis - AUTOMATION VERSION v2
// Fix: Dynamically reads singleSelect options at runtime
// instead of hardcoded WEEK_IDS map. New weeks are created
// one at a time to avoid batch singleSelect conflicts.
// ============================================================

const BNB_TABLE_ID    = "tblxfl0X4kCjRfl5q";
const MARRO_TABLE_ID  = "tblp1iotuacbvffyW";
const TARGET_TABLE_ID = "tbldu6Tf4tF27biZ2";

const BNB_TEAMS = {
    "D2MS":                  { channel: "D2MS",               brand: "Butternut", region: "UK" },
    "Internal Telesales UK": { channel: "Internal Telesales",  brand: "Butternut", region: "UK" },
    "Internal Telesales IE": { channel: "Internal Telesales",  brand: "Butternut", region: "IE" },
};
const MARRO_TEAMS = {
    "D2MS": { channel: "D2MS", brand: "Marro", region: "UK" },
};

// Static option IDs for Channel, Brand, Market (these rarely change)
const CHANNEL_IDS = {
    "D2MS":               { id: "selsVhcZqncKhrZGh" },
    "Internal Telesales": { id: "selZXCFQUfqv4O2rY" },
};
const BRAND_IDS = {
    "Butternut": { id: "selP8nHIPRizCPWNk" },
    "Marro":     { id: "selKwVaboTTpVOKJK" },
};
const MARKET_IDS = {
    "UK": { id: "selJS5G4nIhaCoJmV" },
    "IE": { id: "seldMcjMmTTZIqF55" },
};

const AGENT_NAME_MAP = {
    "D2MS Donna": "Donna Wallington", "Franco D2MS": "Franco Leto",
    "D2MSTerrence": "Terrence Ndukwe", "D2MS Cian": "Cian Rees",
    "D2MSChristian": "Morris Christian", "D2MSclementine": "Clementine Drake",
    "Jagoda D2MS": "Jagoda", "Jakub D2MS": "Jakub Rybczak",
    "D2MS Leon Morris": "Leon Morris", "D2MS": "D2MS (no agent)",
};

function cleanAgentName(raw) {
    if (!raw) return "Unknown";
    const trimmed = raw.trim();
    if (AGENT_NAME_MAP[trimmed]) return AGENT_NAME_MAP[trimmed];
    const lower = trimmed.toLowerCase();
    for (const [key, val] of Object.entries(AGENT_NAME_MAP)) {
        if (key.toLowerCase() === lower) return val;
    }
    return trimmed;
}

function getISOWeek(dateStr) {
    const d = new Date(dateStr + "T12:00:00Z");
    if (isNaN(d.getTime())) return null;
    const year = d.getUTCFullYear();
    function weekOneStart(yr) {
        const jan4 = new Date(Date.UTC(yr, 0, 4));
        const dow  = jan4.getUTCDay() || 7;
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

async function batchCreate(table, records) {
    for (let i = 0; i < records.length; i += 50) {
        await table.createRecordsAsync(records.slice(i, i + 50));
    }
}
async function batchUpdate(table, records) {
    for (let i = 0; i < records.length; i += 50) {
        await table.updateRecordsAsync(records.slice(i, i + 50));
    }
}

// ============================================================
// MAIN
// ============================================================
console.log("Pause Reason Sync v2 starting...");

const bnbTable    = base.getTable(BNB_TABLE_ID);
const marroTable  = base.getTable(MARRO_TABLE_ID);
const targetTable = base.getTable(TARGET_TABLE_ID);

const bnbDate   = bnbTable.getField("fldKsljZ4ZrmNoKwD");
const bnbTeam   = bnbTable.getField("fldVjxSBui2Ke9HTW");
const bnbReason = bnbTable.getField("fldcZey62zRfZN2rI");
const bnbLink   = bnbTable.getField("fldJP6bouGpc1VCrv");
const bnbAgent  = bnbTable.getField("fldAAU4ygj4yHusGq");

const marDate   = marroTable.getField("fldhVOKtUyiwtCddr");
const marTeam   = marroTable.getField("fldWudXB8noaFCbY4");
const marReason = marroTable.getField("fldUACtCgf6k5kdUq");
const marLink   = marroTable.getField("fld3kLWcWAomu0yXU");
const marAgent  = marroTable.getField("fldOZVdFE38ke1Zjn");

const tgtKey     = targetTable.getField("fldytGzTFnzlINQ4l");
const tgtWeek    = targetTable.getField("fldeDbnuRz6j8lyFU");
const tgtChannel = targetTable.getField("fldLf5JCT3Tc0d9sv");
const tgtBrand   = targetTable.getField("fldO4q4Z1GSSZloFW");
const tgtMarket  = targetTable.getField("fldyMNnotRQ64vUcW");
const tgtReason  = targetTable.getField("fldVZjIpJEPzcMZKZ");
const tgtAgent   = targetTable.getField("fldmGg66jQenHeptC");
const tgtCount   = targetTable.getField("fldE90ttMPrFwNvey");
const tgtPctP    = targetTable.getField("flde5wOijp7pZSQdk");
const tgtPctS    = targetTable.getField("fldzPGzjRk4swoIj8");

// ---- DYNAMIC WEEK_IDS: read options from the field at runtime ----
const WEEK_IDS = {};
const weekChoices = tgtWeek.options?.choices || [];
for (const choice of weekChoices) {
    WEEK_IDS[choice.name] = { id: choice.id };
}
console.log("Loaded " + Object.keys(WEEK_IDS).length + " week options: " + Object.keys(WEEK_IDS).join(", "));

// Load existing target records
const existingQuery = await targetTable.selectRecordsAsync({ fields: [tgtKey] });
const existingByKey = {};
for (const rec of existingQuery.records) {
    const key = rec.getCellValueAsString(tgtKey);
    if (key) existingByKey[key] = rec.id;
}

// Load sales
const bnbRecs = await bnbTable.selectRecordsAsync({
    fields: [bnbDate, bnbTeam, bnbReason, bnbLink, bnbAgent]
});
const marroRecs = await marroTable.selectRecordsAsync({
    fields: [marDate, marTeam, marReason, marLink, marAgent]
});

// Process
const salesCount  = {};
const pausedCount = {};
const reasonCount = {};
const reasonMeta  = {};

function processRecords(records, dateField, teamField, reasonField, linkField, agentField, teamWhitelist) {
    for (const rec of records) {
        const links = rec.getCellValue(linkField);
        if (!links || links.length === 0) continue;
        const dateVal = rec.getCellValue(dateField);
        if (!dateVal) continue;
        const iw = getISOWeek(String(dateVal));
        if (!iw || iw.year !== 2026) continue;
        const team = rec.getCellValueAsString(teamField);
        const teamInfo = teamWhitelist[team];
        if (!teamInfo) continue;

        const weekLabel = "W" + iw.week;
        const weekKey = weekLabel + "|" + teamInfo.channel + "|" + teamInfo.brand + "|" + teamInfo.region;
        salesCount[weekKey] = (salesCount[weekKey] || 0) + 1;

        const reason = rec.getCellValueAsString(reasonField).trim();
        if (!reason) continue;

        const agent = cleanAgentName(rec.getCellValueAsString(agentField));
        pausedCount[weekKey] = (pausedCount[weekKey] || 0) + 1;

        const fullKey = weekLabel + " | " + teamInfo.channel + " | " + teamInfo.brand + " | " + teamInfo.region + " | " + reason + " | " + agent;
        reasonCount[fullKey] = (reasonCount[fullKey] || 0) + 1;

        if (!reasonMeta[fullKey]) {
            reasonMeta[fullKey] = {
                isoWeek: weekLabel, channel: teamInfo.channel,
                brand: teamInfo.brand, market: teamInfo.region,
                reason: reason, agent: agent, weekKey: weekKey,
            };
        }
    }
}

processRecords(bnbRecs.records, bnbDate, bnbTeam, bnbReason, bnbLink, bnbAgent, BNB_TEAMS);
processRecords(marroRecs.records, marDate, marTeam, marReason, marLink, marAgent, MARRO_TEAMS);

// Build records to create/update
const toCreate = [];
const toUpdate = [];

for (const [fullKey, count] of Object.entries(reasonCount)) {
    const meta = reasonMeta[fullKey];
    const totalSales = salesCount[meta.weekKey] || 0;
    const totalPausedSeg = pausedCount[meta.weekKey] || 0;
    const pctPaused = totalPausedSeg > 0 ? count / totalPausedSeg : 0;
    const pctSales  = totalSales > 0 ? count / totalSales : 0;

    const weekOpt    = WEEK_IDS[meta.isoWeek] || { name: meta.isoWeek };
    const channelOpt = CHANNEL_IDS[meta.channel] || { name: meta.channel };
    const brandOpt   = BRAND_IDS[meta.brand] || { name: meta.brand };
    const marketOpt  = MARKET_IDS[meta.market] || { name: meta.market };

    const fields = {
        [tgtKey.id]: fullKey, [tgtWeek.id]: weekOpt,
        [tgtChannel.id]: channelOpt, [tgtBrand.id]: brandOpt,
        [tgtMarket.id]: marketOpt, [tgtReason.id]: meta.reason,
        [tgtAgent.id]: meta.agent, [tgtCount.id]: count,
        [tgtPctP.id]: pctPaused, [tgtPctS.id]: pctSales,
    };

    if (existingByKey[fullKey]) {
        const uf = { ...fields };
        delete uf[tgtKey.id];
        toUpdate.push({ id: existingByKey[fullKey], fields: uf });
    } else {
        toCreate.push({ fields });
    }
}

// ---- SAFE BATCH CREATE: handle new singleSelect options ----
// Split toCreate into two groups:
//   knownWeek = records whose week has an existing option ID (safe to batch)
//   newWeek   = records whose week needs a new option (create one-by-one)
const knownWeekRecords = [];
const newWeekRecords = {};

for (const rec of toCreate) {
    const weekVal = rec.fields[tgtWeek.id];
    if (weekVal.id) {
        // Has an option ID, safe for batch
        knownWeekRecords.push(rec);
    } else {
        // New week, group by name so we handle each new option once
        const weekName = weekVal.name;
        if (!newWeekRecords[weekName]) newWeekRecords[weekName] = [];
        newWeekRecords[weekName].push(rec);
    }
}

// Create new-week records one at a time. Creating records individually
// with { name: "W22" } is safe because after the first create establishes
// the option, subsequent creates match the existing option by name.
// We avoid batch creates for new options because batch tries to create
// the same option multiple times in parallel, which Airtable rejects.
let createdCount = 0;
for (const [weekName, recs] of Object.entries(newWeekRecords)) {
    console.log("New week option: " + weekName + " (" + recs.length + " records, creating one at a time)");
    for (const rec of recs) {
        await targetTable.createRecordAsync(rec.fields);
        createdCount++;
    }
}

// Batch create records with known week options
if (knownWeekRecords.length > 0) {
    await batchCreate(targetTable, knownWeekRecords);
    createdCount += knownWeekRecords.length;
}

// Batch update existing records
if (toUpdate.length > 0) await batchUpdate(targetTable, toUpdate);

console.log("Done: " + createdCount + " created, " + toUpdate.length + " updated, " + Object.keys(reasonCount).length + " total groups");
