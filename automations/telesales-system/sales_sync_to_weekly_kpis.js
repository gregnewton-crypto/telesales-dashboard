// ============================================================
// AUTOMATION: Sales Sync to Weekly KPIs v4
// ============================================================
// v4: Uses Effective Team formula field instead of raw synced
// Direct Sales Team Name. The formula checks Telesales Override
// first, falls back to synced team. This lets you attribute
// sales to telesales when an agent was on the rota but didn't
// use the right code.
// ============================================================

// --- TABLE IDs ---
const TBL_KPI   = "tblvzF0trb8F9TOpc";  // Weekly KPIs v2
const TBL_BNB   = "tblxfl0X4kCjRfl5q";  // Butternut sales
const TBL_MARRO = "tblp1iotuacbvffyW";  // Marro sales

// --- KPI FIELD IDs ---
const KPI_KEY    = "fldoz2U4o0bguBW09";  // KPI Key
const KPI_SALES  = "fldLmaNaK9cBaCSyw";  // Red Sales

// --- BUTTERNUT FIELD IDs ---
const BNB_DATE   = "fldKsljZ4ZrmNoKwD";  // Subscription Created Date
const BNB_TEAM   = "fldu3o3yYshG0R05N";  // Effective Team (formula: override or synced)
const BNB_LINK   = "fldJP6bouGpc1VCrv";  // Link to Weekly KPIs v2

// --- MARRO FIELD IDs ---
const MAR_DATE   = "fldhVOKtUyiwtCddr";  // Subscription Created Date
const MAR_TEAM   = "fldWudXB8noaFCbY4";  // Direct Sales Team Name (singleSelect)
const MAR_LINK   = "fld3kLWcWAomu0yXU";  // Link to Weekly KPIs v2

// --- TEAM WHITELISTS ---
const BNB_TEAMS = {
    "D2MS":                  { channel: "D2MS",              brand: "Butternut", region: "UK" },
    "Internal Telesales UK": { channel: "Internal Telesales", brand: "Butternut", region: "UK" },
    "Internal Telesales IE": { channel: "Internal Telesales", brand: "Butternut", region: "IE" },
};
const MARRO_TEAMS = {
    "D2MS": { channel: "D2MS", brand: "Marro", region: "UK" },
};
const BAD_TEAMS = new Set(["Ireland", "Northern Ireland"]);

// --- ISO WEEK ---
function getISOWeek(dateStr) {
    const d = new Date(dateStr + "T12:00:00Z");
    if (isNaN(d.getTime())) return null;
    const year = d.getUTCFullYear();
    const jan4 = new Date(Date.UTC(year, 0, 4));
    const dow = jan4.getUTCDay() || 7;
    const w1Start = new Date(jan4);
    w1Start.setUTCDate(jan4.getUTCDate() - dow + 1);
    const jan4Prev = new Date(Date.UTC(year - 1, 0, 4));
    const dowP = jan4Prev.getUTCDay() || 7;
    const w1StartPrev = new Date(jan4Prev);
    w1StartPrev.setUTCDate(jan4Prev.getUTCDate() - dowP + 1);
    const jan4Next = new Date(Date.UTC(year + 1, 0, 4));
    const dowN = jan4Next.getUTCDay() || 7;
    const w1StartNext = new Date(jan4Next);
    w1StartNext.setUTCDate(jan4Next.getUTCDate() - dowN + 1);
    if (d >= w1StartNext) return { year: year + 1, week: 1 };
    if (d >= w1Start) return { year, week: Math.floor((d - w1Start) / (7*24*60*60*1000)) + 1 };
    return { year: year - 1, week: Math.floor((d - w1StartPrev) / (7*24*60*60*1000)) + 1 };
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

// 1. Load KPI rows
const kpiTable = base.getTable(TBL_KPI);
const kpiQuery = await kpiTable.selectRecordsAsync({
    fields: [KPI_KEY, KPI_SALES]
});
const kpiLookup = {};
const kpiHasData = {};
for (const rec of kpiQuery.records) {
    const key = rec.getCellValueAsString(KPI_KEY);
    if (key) {
        kpiLookup[key] = rec.id;
        kpiHasData[rec.id] = rec.getCellValue(KPI_SALES) !== null;
    }
}
console.log(`KPI rows: ${Object.keys(kpiLookup).length}`);

// 2. Scan BUTTERNUT
const bnbTable = base.getTable(TBL_BNB);
const bnbQuery = await bnbTable.selectRecordsAsync({
    fields: [BNB_DATE, BNB_TEAM, BNB_LINK]
});

const buckets = {};
const bnbLinkFixes = [];
let bnbCount = 0;

for (const rec of bnbQuery.records) {
    // Effective Team: returns override value if set, synced team otherwise
    const team = rec.getCellValueAsString(BNB_TEAM);
    const currentLink = rec.getCellValue(BNB_LINK);
    const hasLink = currentLink && currentLink.length > 0;

    // BAD_TEAMS: if Effective Team is still "Ireland" (no override),
    // clear any stale link
    if (BAD_TEAMS.has(team) && hasLink) {
        bnbLinkFixes.push({ id: rec.id, fields: { [BNB_LINK]: [] } });
        continue;
    }

    const mapping = BNB_TEAMS[team];
    if (!mapping) continue;

    const dateVal = rec.getCellValue(BNB_DATE);
    if (!dateVal) continue;
    const iw = getISOWeek(dateVal);
    if (!iw || iw.year !== 2026) continue;

    bnbCount++;
    const kpiKey = `W${String(iw.week).padStart(2, "0")} | ${mapping.channel} | ${mapping.brand} | ${mapping.region}`;

    if (!buckets[kpiKey]) buckets[kpiKey] = { sales: 0 };
    buckets[kpiKey].sales++;

    const kpiRecId = kpiLookup[kpiKey];
    if (kpiRecId && !hasLink) {
        bnbLinkFixes.push({ id: rec.id, fields: { [BNB_LINK]: [{ id: kpiRecId }] } });
    }
}
console.log(`BNB: ${bnbCount} matched, ${bnbLinkFixes.length} link fixes`);

// 3. Scan MARRO
const marroTable = base.getTable(TBL_MARRO);
const marroQuery = await marroTable.selectRecordsAsync({
    fields: [MAR_DATE, MAR_TEAM, MAR_LINK]
});

const marroLinkFixes = [];
let marroCount = 0;

for (const rec of marroQuery.records) {
    const team = rec.getCellValueAsString(MAR_TEAM);
    const mapping = MARRO_TEAMS[team];
    if (!mapping) continue;

    const dateVal = rec.getCellValue(MAR_DATE);
    if (!dateVal) continue;
    const iw = getISOWeek(dateVal);
    if (!iw || iw.year !== 2026) continue;

    marroCount++;
    const kpiKey = `W${String(iw.week).padStart(2, "0")} | ${mapping.channel} | ${mapping.brand} | ${mapping.region}`;

    if (!buckets[kpiKey]) buckets[kpiKey] = { sales: 0 };
    buckets[kpiKey].sales++;

    const currentLink = rec.getCellValue(MAR_LINK);
    const hasLink = currentLink && currentLink.length > 0;
    const kpiRecId = kpiLookup[kpiKey];
    if (kpiRecId && !hasLink) {
        marroLinkFixes.push({ id: rec.id, fields: { [MAR_LINK]: [{ id: kpiRecId }] } });
    }
}
console.log(`Marro: ${marroCount} matched, ${marroLinkFixes.length} link fixes`);

// 4. Build KPI updates (Sales count only)
const kpiUpdates = [];
const kpiKeysWithData = new Set();

for (const [kpiKey, b] of Object.entries(buckets)) {
    const recId = kpiLookup[kpiKey];
    if (!recId) continue;
    kpiKeysWithData.add(recId);
    kpiUpdates.push({ id: recId, fields: { [KPI_SALES]: b.sales } });
}

// Clear stale rows
for (const rec of kpiQuery.records) {
    if (!kpiKeysWithData.has(rec.id) && kpiHasData[rec.id]) {
        kpiUpdates.push({ id: rec.id, fields: { [KPI_SALES]: null } });
    }
}

// 5. Write everything
console.log(`Writing ${kpiUpdates.length} KPI updates...`);
await batchUpdate(kpiTable, kpiUpdates);

if (bnbLinkFixes.length > 0) {
    console.log(`Fixing ${bnbLinkFixes.length} BNB links...`);
    await batchUpdate(bnbTable, bnbLinkFixes);
}
if (marroLinkFixes.length > 0) {
    console.log(`Fixing ${marroLinkFixes.length} Marro links...`);
    await batchUpdate(marroTable, marroLinkFixes);
}

console.log(`Done! BNB: ${bnbCount}, Marro: ${marroCount}, KPI writes: ${kpiUpdates.length}`);
