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

**Do not create a new automation.** Update these two existing ones:

1. **Databowl lead date IE** → paste `scripts/databowl-lead-date-ie-automation.js`
2. **Linking Leads Adversus & Databowl** → paste `scripts/linking-leads-adversus-databowl-automation.js`

Full step-by-step instructions: [docs/databowl-leads-automation-update.md](docs/databowl-leads-automation-update.md)
