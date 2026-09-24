# Airtable → Google Sheets sync (Adversus Ireland)

Pulls every row from the IE Telesales Airtable base into a Google Sheet on a **30-minute** schedule.

| Item | Value |
|------|--------|
| Hub / base | IE Telesales System (`appIxUjQdnPPLvSrp`) |
| Table | **Adversus Ireland** (`tblHzJwEqbcpOpXOf`) |
| View | **Google sheet sync** (`viw2nCAuhRPkM51tb`) |
| Rows (Mar 2026) | ~32,865 |

Airtable link: [Google sheet sync view](https://airtable.com/appIxUjQdnPPLvSrp/tblHzJwEqbcpOpXOf/viw2nCAuhRPkM51tb)

## Recommended: Google Apps Script (scheduled sync)

The script lives in **`AirtableToSheetSync.gs`**. It runs inside Google Sheets, stores your Airtable token in Script Properties (not in the sheet), and replaces the tab with a full refresh each run.

### One-time setup

1. **Create a Google Sheet** (or open the sheet you want to use).
2. **Extensions → Apps Script**. Delete any placeholder code and paste the contents of `AirtableToSheetSync.gs`. Save the project (name it e.g. `Airtable Adversus sync`).
3. **Script properties** (gear icon → *Script properties*):
   - `AIRTABLE_PAT` = your [Airtable personal access token](https://airtable.com/create/tokens) with `data.records:read` on base `appIxUjQdnPPLvSrp`.
4. In the script editor, select **`setupHalfHourSync`** and click **Run**. Approve permissions when asked.
5. After the first run finishes, open the sheet tab **`Adversus Ireland`**. Check **`_sync_meta`** for `lastSync` and `recordCount`.

### Ongoing use

- **Airtable sync → Sync now** in the sheet menu for a manual refresh.
- **Airtable sync → Install 30-minute trigger** if you need to reinstall the schedule.
- **Airtable sync → Remove triggers** to stop automatic sync.

Each sync clears and rewrites the **`Adversus Ireland`** tab (full snapshot). Column order is stable: `airtable_record_id`, then field names A→Z as they appear in the export.

### Quotas

One full sync is ~329 Airtable API calls (100 records per page). At every 30 minutes that is ~48 runs/day (~15,800 fetches). This fits typical Google Workspace UrlFetch limits; on a personal Gmail account you may be closer to the daily cap—use a Workspace sheet or a longer interval if you hit limits.

## Optional: one-time CSV export (Python)

For a local backup or manual **File → Import** into Sheets:

```bash
AIRTABLE_API_KEY=pat... python3 tools/airtable_gsheet_sync/export_view_to_csv.py \
  -o ~/Downloads/adversus_ireland.csv
```

Requires `requests` (`pip install requests` if needed).

## Changing the source view

Edit `SYNC_CONFIG.viewId` in `AirtableToSheetSync.gs` (and `VIEW_ID` in `export_view_to_csv.py` if you use the CSV tool). Re-run **Install 30-minute trigger** or **Sync now**.
