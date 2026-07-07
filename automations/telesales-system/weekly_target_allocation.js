const kpiTable = base.getTable("📈 Weekly KPIs");
const shiftsTable = base.getTable("Telesales Shifts (Staffing Sync)");
const salesTeamTable = base.getTable("Sales Team");
const targetsTable = base.getTable("Rep Weekly Targets");

const regionMap = {
    "☘ Int. Telesales": { group: "IRELAND", label: "Ireland" },
    "🇬🇧 Int. Telesales": { group: "SOUTH", label: "UK" }
};

function normalize(name) { 
    return name.trim().toLowerCase().replace(/'/g, "").replace(/\s+/g, ""); 
}

const salesRecords = await salesTeamTable.selectRecordsAsync({ fields: ["Agent Name"] });
const nameToId = {};
for (const r of salesRecords.records) {
    const name = r.getCellValueAsString("Agent Name");
    if (name) nameToId[normalize(name)] = { id: r.id, name: name };
}

const existingTargets = await targetsTable.selectRecordsAsync({ fields: ["ID"] });
const existingMap = {};
for (const r of existingTargets.records) {
    const id = r.getCellValueAsString("ID");
    if (id) existingMap[id] = r.id;
}

const kpiRecords = await kpiTable.selectRecordsAsync({
    fields: ["Week", "Region", "⚙️ Period", "⚙️ Year", "⚙️ Channel", "🔵🐶 Sales", "🟡🐶 Sales 🪵"]
});
const weeklyTargets = {};
for (const r of kpiRecords.records) {
    const channel = r.getCellValueAsString("⚙️ Channel");
    const year = r.getCellValueAsString("⚙️ Year");
    const region = r.getCellValueAsString("Region");
    if (channel !== "Telesales" || year !== "2026" || !regionMap[region]) continue;
    const week = r.getCellValueAsString("Week");
    const period = r.getCellValueAsString("⚙️ Period");
    if (!week) continue;
    const budget = r.getCellValue("🔵🐶 Sales") || 0;
    const forecast = r.getCellValue("🟡🐶 Sales 🪵") || 0;
    weeklyTargets[`${region}|${week}`] = { budget, forecast, period, year, region, week, regionLabel: regionMap[region].label, regionGroup: regionMap[region].group };
}

const shiftRecords = await shiftsTable.selectRecordsAsync({
    fields: ["Salesperson", "Week", "Region Group"]
});
const shiftCounts = {};
for (const r of shiftRecords.records) {
    const rep = r.getCellValueAsString("Salesperson").trim();
    const week = r.getCellValueAsString("Week");
    const regionGroup = r.getCellValueAsString("Region Group");
    if (!rep || !week || !regionGroup) continue;
    const key = `${regionGroup}|${week}`;
    if (!shiftCounts[key]) shiftCounts[key] = {};
    shiftCounts[key][normalize(rep)] = (shiftCounts[key][normalize(rep)] || 0) + 1;
}

const toCreate = [];
const toUpdate = [];

for (const [targetKey, target] of Object.entries(weeklyTargets)) {
    const reps = shiftCounts[`${target.regionGroup}|${target.week}`];
    if (!reps) continue;
    const totalShifts = Object.values(reps).reduce((a, b) => a + b, 0);
    if (totalShifts === 0) continue;

    for (const [normName, repShifts] of Object.entries(reps)) {
        const teamMember = nameToId[normName];
        if (!teamMember) continue;

        const share = repShifts / totalShifts;
        const repBudget = Math.round(target.budget * share * 100) / 100;
        const repForecast = Math.round(target.forecast * share * 100) / 100;
        const recordId = `${teamMember.name} | ${target.week} | ${target.year}`;

        const fields = {
            "ID": recordId,
            "Rep": [{ id: teamMember.id }],
            "Week": target.week,
            "Period": target.period,
            "Year": target.year,
            "Region": { name: target.regionLabel },
            "Rep Shifts": repShifts,
            "Total Team Shifts": totalShifts,
            "🔵🐶 Team Budget": target.budget,
            "🟡🐶 Team Forecast": target.forecast,
            "🔵🐶 Rep Budget": repBudget,
            "🟡🐶 Rep Forecast": repForecast,
            "Share %": Math.round(share * 100) + "%"
        };

        if (existingMap[recordId]) {
            toUpdate.push({ id: existingMap[recordId], fields });
        } else {
            toCreate.push({ fields });
        }
    }
}

for (let i = 0; i < toUpdate.length; i += 50) {
    await targetsTable.updateRecordsAsync(toUpdate.slice(i, i + 50));
}
for (let i = 0; i < toCreate.length; i += 50) {
    await targetsTable.createRecordsAsync(toCreate.slice(i, i + 50));
}

console.log(`Done! Updated: ${toUpdate.length} | Created: ${toCreate.length}`);
