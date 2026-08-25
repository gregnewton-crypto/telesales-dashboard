// ============================================================
// AUTOMATION: D2MS Commission Sync to Spend Tracker
// ============================================================
// Reads commission tiers from Config table.
// Counts D2MS sales per week (BNB + Marro combined).
// Determines tier based on combined total.
// Writes per-brand commission to Spend Tracker.
//
// Schedule: Weekly (after Sales Sync has run)
// ============================================================

// --- TABLE IDs ---
const TBL_CONFIG = "tblpjb0QRHAArWMGb";  // Config
const TBL_BNB    = "tblxfl0X4kCjRfl5q";  // Butternut sales
const TBL_MARRO  = "tblp1iotuacbvffyW";  // Marro sales
const TBL_SPEND  = "tblPZXML8MWg32vLU";  // Spend Tracker

// --- CONFIG FIELD IDs ---
const CF_NAME      = "fld2ZS37tnM9ImxNF";  // Config Name
const CF_VALUE     = "fld81vInXizETEBS4";  // Value (rate per sale)
const CF_THRESHOLD = "fldcu5X2yRTsG3xts";  // Threshold (sales count)
const CF_TYPE      = "fldMS8bpN4dSNS2lz";  // Type (singleSelect)
const CF_SORT      = "fldrQ4vQcOs4U9XXK";  // Sort Order

// --- BUTTERNUT FIELD IDs ---
const BNB_DATE = "fldKsljZ4ZrmNoKwD";  // Subscription Created Date
const BNB_TEAM = "fldu3o3yYshG0R05N";  // Effective Team (formula with override)

// --- MARRO FIELD IDs ---
const MAR_DATE = "fldhVOKtUyiwtCddr";  // Subscription Created Date
const MAR_TEAM = "fldWudXB8noaFCbY4";  // Direct Sales Team Name

// --- SPEND TRACKER FIELD IDs ---
const SP_KEY        = "fldjHJ8PzZn4p4SxP";  // Spend Key
const SP_WEEK       = "fldWTu12srAZb9267";  // Week Number
const SP_CHANNEL    = "fldfvw0kViHYPRxe0";  // Channel (singleSelect)
const SP_BRAND      = "fld8wbNcWbe2xW2iv";  // Brand (singleSelect)
const SP_COMMISSION = "fldFBUsMWnDNDzsWz";  // D2MS Commission (currency)

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
console.log("D2MS Commission Sync starting...");

// 1. Read commission tiers from Config
const configTable = base.getTable(TBL_CONFIG);
const configQuery = await configTable.selectRecordsAsync({
    fields: [CF_NAME, CF_VALUE, CF_THRESHOLD, CF_TYPE, CF_SORT]
});

const tiers = [];
for (const rec of configQuery.records) {
    const typeSel = rec.getCellValue(CF_TYPE);
    const typeName = typeSel ? typeSel.name : "";
    if (typeName !== "Commission") continue;

    const name = rec.getCellValueAsString(CF_NAME);
    if (!name.startsWith("D2MS Commission")) continue;

    const threshold = rec.getCellValue(CF_THRESHOLD);
    const rate = rec.getCellValue(CF_VALUE);
    const sort = rec.getCellValue(CF_SORT);

    if (threshold && rate) {
        tiers.push({ threshold, rate, sort, name });
    }
}

// Sort descending by threshold so we match highest tier first
tiers.sort((a, b) => b.threshold - a.threshold);
console.log("Commission tiers loaded:");
for (const t of tiers) {
    console.log(`  ${t.name}: ${t.threshold}+ sales = £${t.rate}/sale`);
}

if (tiers.length === 0) {
    console.log("ERROR: No commission tiers found in Config. Exiting.");
    // Early exit - nothing to do
} else {

// 2. Count D2MS sales per week per brand
const bnbTable = base.getTable(TBL_BNB);
const marroTable = base.getTable(TBL_MARRO);

const bnbQuery = await bnbTable.selectRecordsAsync({
    fields: [BNB_DATE, BNB_TEAM]
});
const marroQuery = await marroTable.selectRecordsAsync({
    fields: [MAR_DATE, MAR_TEAM]
});

// weekSales[weekNum] = { bnb: count, marro: count, total: count }
const weekSales = {};

// Count BNB D2MS sales
for (const rec of bnbQuery.records) {
    const team = rec.getCellValueAsString(BNB_TEAM);
    if (team !== "D2MS") continue;

    const dateVal = rec.getCellValue(BNB_DATE);
    if (!dateVal) continue;
    const iw = getISOWeek(dateVal);
    if (!iw || iw.year !== 2026) continue;

    if (!weekSales[iw.week]) weekSales[iw.week] = { bnb: 0, marro: 0, total: 0 };
    weekSales[iw.week].bnb++;
    weekSales[iw.week].total++;
}

// Count Marro D2MS sales
for (const rec of marroQuery.records) {
    const team = rec.getCellValueAsString(MAR_TEAM);
    if (team !== "D2MS") continue;

    const dateVal = rec.getCellValue(MAR_DATE);
    if (!dateVal) continue;
    const iw = getISOWeek(dateVal);
    if (!iw || iw.year !== 2026) continue;

    if (!weekSales[iw.week]) weekSales[iw.week] = { bnb: 0, marro: 0, total: 0 };
    weekSales[iw.week].marro++;
    weekSales[iw.week].total++;
}

console.log("\nWeekly D2MS sales:");
const sortedWeeks = Object.keys(weekSales).map(Number).sort((a, b) => a - b);
for (const w of sortedWeeks) {
    const s = weekSales[w];
    console.log(`  W${w}: BNB=${s.bnb}, Marro=${s.marro}, Total=${s.total}`);
}

// 3. Determine commission per week per brand
function getCommissionRate(totalSales) {
    // tiers sorted descending by threshold
    for (const tier of tiers) {
        if (totalSales >= tier.threshold) return tier.rate;
    }
    return 0; // Below minimum threshold
}

const commissionData = {};
// commissionData["W23|Butternut"] = { week: 23, brand: "Butternut", amount: 13950 }

for (const [weekStr, sales] of Object.entries(weekSales)) {
    const week = Number(weekStr);
    const rate = getCommissionRate(sales.total);

    if (rate === 0) {
        console.log(`  W${week}: ${sales.total} total sales - below threshold, £0 commission`);
        continue;
    }

    console.log(`  W${week}: ${sales.total} total sales -> £${rate}/sale`);

    if (sales.bnb > 0) {
        const bnbAmount = sales.bnb * rate;
        commissionData[`${week}|Butternut`] = { week, brand: "Butternut", amount: bnbAmount };
        console.log(`    BNB: ${sales.bnb} x £${rate} = £${bnbAmount.toFixed(2)}`);
    }
    if (sales.marro > 0) {
        const marroAmount = sales.marro * rate;
        commissionData[`${week}|Marro`] = { week, brand: "Marro", amount: marroAmount };
        console.log(`    Marro: ${sales.marro} x £${rate} = £${marroAmount.toFixed(2)}`);
    }
}

// 4. Load Spend Tracker rows and write commission
const spendTable = base.getTable(TBL_SPEND);
const spendQuery = await spendTable.selectRecordsAsync({
    fields: [SP_KEY, SP_WEEK, SP_CHANNEL, SP_BRAND, SP_COMMISSION]
});

// Match Spend Tracker rows: Channel = D2MS, by week + brand
const spendUpdates = [];
const matchedKeys = new Set();

for (const rec of spendQuery.records) {
    const channelName = rec.getCellValueAsString(SP_CHANNEL);
    if (channelName !== "D2MS") continue;

    // getCellValueAsString works for any field type
    const weekStr = rec.getCellValueAsString(SP_WEEK);
    const weekNum = parseInt(weekStr) || null;

    const brandName = rec.getCellValueAsString(SP_BRAND);

    if (!weekNum || !brandName) continue;

    const lookupKey = `${weekNum}|${brandName}`;
    const commData = commissionData[lookupKey];
    const currentComm = rec.getCellValue(SP_COMMISSION);

    if (commData) {
        // Has commission to write
        console.log(`  Match: W${weekNum} ${brandName} = £${commData.amount.toFixed(2)}`);
        if (currentComm !== commData.amount) {
            spendUpdates.push({
                id: rec.id,
                fields: { [SP_COMMISSION]: commData.amount }
            });
        }
        matchedKeys.add(lookupKey);
    } else {
        // No commission (below threshold or no sales this week)
        if (currentComm && currentComm !== 0) {
            spendUpdates.push({
                id: rec.id,
                fields: { [SP_COMMISSION]: null }
            });
        }
    }
}

// Log unmatched commission data (Spend Tracker rows missing)
for (const [key, data] of Object.entries(commissionData)) {
    if (!matchedKeys.has(key)) {
        console.log(`WARNING: No Spend Tracker row for D2MS W${data.week} ${data.brand}`);
    }
}

// 5. Write updates
if (spendUpdates.length > 0) {
    console.log(`\nWriting ${spendUpdates.length} Spend Tracker updates...`);
    await batchUpdate(spendTable, spendUpdates);
} else {
    console.log("\nNo Spend Tracker updates needed.");
}

console.log("D2MS Commission Sync complete!");

} // end of tiers check
