# Telesales System — Airtable Automations

This folder mirrors the in-Airtable automation scripts for the `Telesales System` base (`appZoN6xBB9mDv8h4`).

**Important caveat:** Airtable does **not** auto-sync scripts from GitHub. This folder is for archival, version control, and code review only. Deploying a fix means copy-pasting the patched file back into the Airtable automation's *Run script* action.

## File layout

```
automations/telesales-system/
├── README.md                              # this file
├── BROKEN.md                              # scripts currently failing + diagnoses
├── adversus_call_sync.js                  # call metrics → Weekly KPIs v2
├── annual_period_generation.js            # creates next year's Periods (December only)
├── d2ms_commission_sync.js                # commission tiers → Spend Tracker
├── d2ms_looker_linker.js                  # links D2MS Looker rows to Daily KPIs
├── daily_status_update.js                 # nightly Periods + Control Panel refresh
├── databowl_lead_status_mirror.js         # IE Databowl Lead: rollup/lookup → single-select mirrors
├── ireland_looker_linker.js               # links Ireland Looker rows to Daily KPIs
├── leads_available_kpi_sync.js            # available-leads count → Weekly KPIs v2
├── linking_leads_adversus_databowl.js     # new Adversus call → IE Databowl Lead link + date
├── marro_looker_linker.js                 # links Marro D2MS Looker rows to Daily KPIs
├── new_leads_in_week_sync.js              # new lead count per week → Weekly KPIs v2
├── pause_reason_update.js                 # weekly Pause Reason Analysis aggregation
├── sales_link.js                          # links a new sale → Sales Team member (broken — see BROKEN.md)
├── sales_sync_to_weekly_kpis.js           # sales records → Weekly KPIs v2
├── spend_sync.js                          # weekly lead spend → Spend Tracker
├── uk_adversus_matching.js                # schedules: matches UK Databowl leads to Adversus calls
└── weekly_target_allocation.js            # rep weekly targets (broken — see BROKEN.md)
```

## Trigger summary

| Script | Trigger | Notes |
| --- | --- | --- |
| `linking_leads_adversus_databowl.js` | Record created in `Adversus API` | Sets `Date`, links to IE Databowl Lead |
| `databowl_lead_status_mirror.js` | Record updated in `☘ Databowl Leads` (watch rollup + lookup) | Populates single-select mirrors + `Called?` + `Lead open/closed`. IE only. |
| `uk_adversus_matching.js` | Scheduled (e.g. every 2 hours) | UK equivalent of the above two combined |
| `d2ms_looker_linker.js` | Record created in `⚙️ D2MS Looker` | Links to matching Daily KPI |
| `ireland_looker_linker.js` | Record created in `⚙️ Ireland Looker` | Links to matching Daily KPI |
| `marro_looker_linker.js` | Record created in `⚙️ Marro D2MS Looker` | Links to matching Daily KPI |
| `sales_sync_to_weekly_kpis.js` | Scheduled | Aggregates BNB + Marro sales → Weekly KPIs v2 |
| `new_leads_in_week_sync.js` | Scheduled | Counts Databowl leads per week → Weekly KPIs v2 |
| `adversus_call_sync.js` | Scheduled | Aggregates call metrics → Weekly KPIs v2 |
| `leads_available_kpi_sync.js` | Scheduled (after `uk_adversus_matching.js`) | Counts available leads per channel → Weekly KPIs v2 |
| `spend_sync.js` | Scheduled (daily 07:00) | CPL × leads → Spend Tracker |
| `d2ms_commission_sync.js` | Scheduled (weekly) | Commission tiers → Spend Tracker |
| `pause_reason_update.js` | Scheduled | Aggregates pause reasons → 🔍 Pause Reason Analysis |
| `daily_status_update.js` | Scheduled daily at midnight UTC | Refreshes Periods table + Control Panel row |
| `annual_period_generation.js` | Scheduled monthly (1st of month) | Only runs in December; generates next year's periods |
| `weekly_target_allocation.js` | Scheduled (likely weekly) | Distributes weekly team budget across reps |
| `sales_link.js` | Record created in `Butternut sales` | Links sale → Sales Team member |

## When updating a script

1. Edit the file in this repo and open a PR.
2. Once the PR is merged, copy the new contents into the Airtable automation's *Run script* action.
3. Test the automation once with **Test** before turning the trigger back on.
