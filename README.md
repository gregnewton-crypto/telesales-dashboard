# telesales-dashboard
Telesales Command Center dashboard

## Databowl Leads field sync

The **☘ Databowl Leads** table (`tbllpLbEtTkmMQOY9`) uses single-select fields that mirror rollup/lookup values. These can drift when automations miss updates:

| Field | Field ID |
|---|---|
| ⚙ Called? | `fldbOzjdQ1ChPuOMg` |
| Time lead has been called (single select) | `fldpGvpBn2J2DbXop` |
| Adversus Lead Status (single select) | `fld9R1fOEzvXLCTzd` |
| Lead open/closed | `fldBFGH4OGEBmuBID` |

### One-off / scheduled sync

```bash
export AIRTABLE_API_KEY=your_pat
python3 scripts/sync-databowl-leads-fields.py --dry-run
python3 scripts/sync-databowl-leads-fields.py
```

### Keep fields live in Airtable

**Do not create a new automation** if one already exists — update its **Run script** action instead.

See [docs/databowl-leads-automation-update.md](docs/databowl-leads-automation-update.md) for step-by-step instructions, trigger requirements, and what to send us so we can point to the exact automation to edit.

Paste the script from `scripts/airtable-automation-sync-leads.js` into the existing automation. It now uses the **Adversus Lead Status lookup** (not just the single-select copy) when setting **Lead open/closed**.

A formula field **`Lead open/closed (auto)`** was also added in the base — it always reflects the lookup and is safe to use in views while the automation is being fixed.

**Lead open/closed** is marked **Closed** when Adversus Lead Status is `Not interested`, `Invalid`, `Success`, or `Unqualified`. All other known statuses are **Open**.
