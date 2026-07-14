# telesales-dashboard
Telesales Command Center dashboard

## Irish leads ↔ calls

Calls in **Adversus API** link to **☘ Databowl Leads** via `☘ Databowl Leads` / `🔗 Adversus Calls`. Each call row has **Call # for Lead** — how many times that lead had been called by the time of that call (1 = first call).

- **Backfill / resync call #:** `AIRTABLE_API_KEY=pat_xxx node scripts/sync-call-sequence.mjs`
- **Keep call # up to date:** `scripts/airtable-automation-call-sequence.js`

## Call week & period

On **Adversus API**, week/period are derived from **Date** (W1 = week of 29 Dec 2025, same calendar as Irish leads):

- `⚙️ Call Week (formula)` / `⚙️ Call Period (formula)` — hidden helpers
- `⚙️ Call Week` / `⚙️ Call Period` — single select (for display)

- **Backfill single selects:** `AIRTABLE_API_KEY=pat_xxx node scripts/sync-call-week-period.mjs`
- **Keep single selects up to date:** `scripts/airtable-automation-call-week-period.js` (input: `record` → Record ID)
