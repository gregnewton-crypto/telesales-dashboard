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

Create an automation in the Telesales base with a **Run script** action and paste `scripts/airtable-automation-sync-leads.js`. Trigger it when Databowl Leads records change or when linked Adversus Calls are created/updated.

**Lead open/closed** is marked **Closed** when Adversus Lead Status is `Not interested`, `Invalid`, `Success`, or `Unqualified`. All other known statuses are **Open**.
