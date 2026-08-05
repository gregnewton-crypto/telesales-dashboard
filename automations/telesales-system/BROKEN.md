# Scripts that need attention

This document lists Telesales System automations whose source code in this folder
no longer matches the live Airtable schema. Most cause silent failures or runtime
errors. Each entry includes the diagnosis I could verify via the Airtable MCP plus
suggested next steps.

Last verified: 2026-06-17 against base `appZoN6xBB9mDv8h4`.

---

## 1. `adversus_call_sync.js` — **FIXED in this PR (v3)**

**Original error**

```
Error: No field matching "fldN5rcqjERGoFWkW" found in table "Adversus API"
    at main on line 101
```

**Initial diagnosis (first attempt)**

`ADV_DURATION` referenced field id `fldN5rcqjERGoFWkW` (a `Call Duration Number`
formula returning seconds). That field has been deleted from the `Adversus API`
table. We re-pointed it at the native `Call Duration` field
(`fldBqKD0ROirYZeOf`, type `duration`).

**That fix wasn't enough — deeper investigation revealed two more problems**

When the patched v2 ran in Airtable, Total Calls and Leads Attempted populated
correctly, but **Connected Calls, Talk Time and Leads Contacted came back as 0**
for every channel. Inspecting the data showed:

1. The native `Call Duration` field is **empty on every Adversus call since
   ~2026-06-15**. Whatever ingests Adversus data into Airtable (webhook / sync
   block / upstream script) stopped populating it around the same time the
   broken `Call Duration Number` formula was deleted.
2. On older records that *did* have `Call Duration` populated, the stored value
   was **`actual_seconds × 60`**, not raw seconds. The deleted
   `Call Duration Number` formula was presumably doing `{Call Duration} / 60`
   to convert. So even if the field were still populated, comparing it to a
   60-second threshold directly would mis-classify everything as connected
   regardless of true length.

**Final fix (v3)**

Compute call duration from `Start of Call` (`fldP0BKlRqqAhqUUY`) and
`End of Call` (`fldlpXIF03xP7i1nL`) directly inside the script. Those are
text fields in `YYYY-MM-DD HH:MM:SS` format, reliably populated, and parsing
both gives a real-second duration. The script no longer references
`Call Duration` at all.

**Deployment**

After this PR is merged, copy the patched contents of `adversus_call_sync.js`
into the matching automation in Airtable, run **Test**, and confirm that the
W25 Internal Telesales rows in `📊 Weekly KPIs v2` now show non-zero
Connected Calls, Talk Time Hrs, and Leads Contacted.

**Follow-up worth investigating separately**

Whatever pipeline imports Adversus calls into the `Adversus API` table stopped
populating `Call Duration` around 2026-06-15. That field isn't required for
this script anymore, but other workflows or reports may depend on it. Worth
checking the Adversus → Airtable sync (webhook, integration block, or external
script) to see why it broke, and whether it should resume.

---

## 2. `d2ms_looker_linker.js` — **FIXED in this PR**
## 3. `ireland_looker_linker.js` — **FIXED in this PR**
## 4. `marro_looker_linker.js` — **FIXED in this PR**

**Symptom**

These scripts run without throwing, but every record logs:

> "No matching Daily KPI found for {date} / {region}"

so no Looker rows ever get linked.

**Cause**

The `tableToRegion` map used region labels with extra emojis:
`"🐶 D2MS"`, `"☘🐶 Int. Telesales"`, `"🐱 D2MS"`. The actual `⚙️ Region`
single-select choices on `📅 Daily KPIs` are:

- `D2MS`
- `☘ Int. Telesales`
- `🇬🇧 Int. Telesales`
- `Model Pitch`

So none of the lookups matched.

**Fix applied**

All three scripts now use the canonical region names. Both D2MS Looker
linkers (BNB and Marro) target `"D2MS"`; the Ireland linker targets
`"☘ Int. Telesales"`. The same Daily KPI row carries both 🐶 and 🐱 rollups,
which is why BNB and Marro D2MS Lookers point at the same region.

**Deployment**

Copy each patched file into the matching automation. There are 3 separate
automations, one per Looker source table.

---

## 5. `sales_link.js` — ⚠️ NEEDS RETARGETING

**Symptom**

Script throws at startup because `base.getTable("tblSi4IOG9bm7vOG5")` fails.

**Cause**

Table id `tblSi4IOG9bm7vOG5` no longer exists in the Telesales System base.
The script expects a per-rep table with an `Agent Name` field and a link field
`fldmOJbNSVaE6ZOdX` pointing at `Butternut sales`.

Candidate tables that look related (none is a perfect fit out of the box):

| Table | Id | Has `Agent Name`? | Has a link to `Butternut sales`? | Notes |
| --- | --- | --- | --- | --- |
| `👥 Sales Teams` | `tblbwveGqPRqX4hbV` | No (`🏢 Team`) | No | Team-level, not rep-level |
| `👤 People` | `tblmHIlx4KLEscZJM` | No (`👤 Full Name`) | Yes (`Butternut sales` = `fld5U2GWSTgACYQWR`) | Most likely intended target |
| `🦹 Salespeople Record` (Performance Analysis base) | `tbl5ys27LlYyNhZq2` | Different base | n/a | Cross-base sync would be needed |

**Recommended action**

Confirm whether this automation should be:

- **Repointed at `👤 People`**, matching on `👤 Full Name` and linking through
  `fld5U2GWSTgACYQWR`. If yes, I can patch and test.
- **Deleted/disabled** if it's been superseded by `sales_sync_to_weekly_kpis.js`
  (which already attributes sales to teams via the `Effective Team` formula).

Reply with which option you'd like and I'll open a follow-up PR.

---

## 6. `weekly_target_allocation.js` — ⚠️ NEEDS RETARGETING

**Symptom**

Script throws at startup. Two `base.getTable(…)` calls fail:

1. `base.getTable("Telesales Shifts (Staffing Sync)")` — no table by that name.
   Closest match: `Staffing Sync` (`tblXYevIHjygHcg8Z`), which has a
   `Telesales Shifts` view but is one table, not multiple.
2. `base.getTable("Sales Team")` — no table by that name. The same options
   above (`👥 Sales Teams` or `👤 People`) apply.

The script also reads fields from `📈 Weekly KPIs` (`tblo0hCJfGTkCMOlU`) that
exist in v1 — `Week`, `Region`, `🔵🐶 Sales`, `🟡🐶 Sales 🪵`. v2
(`📊 Weekly KPIs v2`, `tblvzF0trb8F9TOpc`) uses different field names. If v1
is being phased out this script may need to migrate to v2.

**Recommended action**

This one needs a small design decision before patching:

- Should it read from `📈 Weekly KPIs` v1 (current behaviour, but v1 is
  visibly stale) or migrate to `📊 Weekly KPIs v2`?
- Confirm the correct rep table (probably `👤 People`).
- Confirm the correct shifts source (probably `Staffing Sync` with a
  `Region Group` / `Week` view filter).

Reply with answers to those three questions and I'll open a follow-up PR.

---

## Healthy / no changes required

The remaining 10 scripts looked clean on inspection — all referenced table
and field IDs were verified to exist:

- `annual_period_generation.js`
- `daily_status_update.js`
- `databowl_lead_status_mirror.js`
- `d2ms_commission_sync.js`
- `leads_available_kpi_sync.js`
- `linking_leads_adversus_databowl.js`
- `new_leads_in_week_sync.js`
- `pause_reason_update.js`
- `sales_sync_to_weekly_kpis.js`
- `spend_sync.js`
- `uk_adversus_matching.js`
