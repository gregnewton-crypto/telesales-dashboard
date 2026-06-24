# telesales-dashboard
Telesales Command Center dashboard

## Irish leads ↔ calls

Calls in **Adversus API** link to **☘ Databowl Leads** via `☘ Databowl Leads` / `🔗 Adversus Calls`. Each call row has **Call # for Lead** — how many times that lead had been called by the time of that call (1 = first call).

- **Backfill / resync:** `AIRTABLE_API_KEY=pat_xxx node scripts/sync-call-sequence.mjs`
- **Keep new calls up to date:** add an Airtable automation using `scripts/airtable-automation-call-sequence.js`
