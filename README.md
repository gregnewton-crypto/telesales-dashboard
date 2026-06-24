# telesales-dashboard
Telesales Command Center dashboard

## Airtable → Google Sheets sync

To push Airtable data into Google Sheets on a recurring schedule, see **[sync/SYNC.md](sync/SYNC.md)**.

Quick summary:
1. Create a Google Sheet and service account credentials
2. Add GitHub Actions secrets (`AIRTABLE_API_KEY`, `GOOGLE_SHEET_ID`, etc.)
3. The workflow syncs every 15 minutes automatically
