// ============================================================
// ONE-OFF BACKFILL: fix Adversus API Call Duration values
// ============================================================
// Context (2026-06-17):
//   - Adversus webhook had been populating Call Duration as
//     actual_seconds × 60. Field was displayed as h:mm so the
//     issue was hidden (a 1:07 call showed as a 1:07 duration).
//   - Switching the field display format from h:mm to h:mm:ss
//     exposed the bug: that same 1:07 call now shows as
//     1:07:00 (one hour, seven minutes) instead of 0:01:07.
//   - Around 2026-06-15 the Adversus pipeline stopped populating
//     Call Duration altogether, so recent records are simply
//     empty.
//
// Fix:
//   Recompute Call Duration = (End of Call - Start of Call) in
//   seconds for every record where both timestamps exist.
//   Spot-checks confirmed Adversus's reported duration always
//   matched End - Start exactly (after dividing by 60), so this
//   preserves the original intent while fixing both classes of
//   bad data.
//
// How to run:
//   Open the `Telesales System` base in Airtable. Open or install
//   the Scripting extension (Extensions → + Add → Scripting).
//   Paste this whole file in and click `Run`. ~21k records, takes
//   1-3 minutes.
//
// Safe to re-run: only updates records whose stored value differs
// from the recomputed seconds.
// ============================================================

const TBL_ADVERSUS = "tblQcfo7qgQCv7o3n";
const FLD_DURATION = "fldBqKD0ROirYZeOf";  // Call Duration (duration, h:mm:ss)
const FLD_START    = "fldP0BKlRqqAhqUUY";  // Start of Call (text "YYYY-MM-DD HH:MM:SS")
const FLD_END      = "fldlpXIF03xP7i1nL";  // End of Call   (text "YYYY-MM-DD HH:MM:SS")

function parseTextDate(s) {
    if (!s) return null;
    const d = new Date(String(s).replace(" ", "T"));
    return isNaN(d.getTime()) ? null : d;
}

const table = base.getTable(TBL_ADVERSUS);
const query = await table.selectRecordsAsync({
    fields: [FLD_DURATION, FLD_START, FLD_END],
});

const updates = [];
let alreadyCorrect = 0;
let skipped = 0;

for (const rec of query.records) {
    const start = parseTextDate(rec.getCellValueAsString(FLD_START));
    const end   = parseTextDate(rec.getCellValueAsString(FLD_END));

    if (!start || !end) { skipped++; continue; }

    const correctSeconds = Math.round((end - start) / 1000);
    if (correctSeconds < 0) { skipped++; continue; }

    const current = rec.getCellValue(FLD_DURATION);
    if (current === correctSeconds) { alreadyCorrect++; continue; }

    updates.push({ id: rec.id, fields: { [FLD_DURATION]: correctSeconds } });
}

console.log(`Scanned: ${query.records.length}`);
console.log(`Already correct: ${alreadyCorrect}`);
console.log(`Need update: ${updates.length}`);
console.log(`Skipped (no usable Start/End): ${skipped}`);

if (updates.length > 0) {
    console.log("Writing updates (50 per batch)...");
    for (let i = 0; i < updates.length; i += 50) {
        await table.updateRecordsAsync(updates.slice(i, i + 50));
        if (i === 0 || i % 500 === 0 || i + 50 >= updates.length) {
            console.log(`  ...wrote ${Math.min(i + 50, updates.length)} / ${updates.length}`);
        }
    }
}

console.log("Done!");
