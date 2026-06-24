# Airtable → Google Sheets Sync

This sync pushes the **Adversus API** Airtable table (`tblQcfo7qgQCv7o3n`) into a Google Sheet and keeps it updated automatically.

| Airtable table | Table ID | Google Sheet tab |
|---|---|---|
| Adversus API | `tblQcfo7qgQCv7o3n` | Adversus API |

Each run does a full refresh: the sheet tab is cleared and rewritten with the latest Airtable data. A **Sync Status** tab records the last run time and row counts.

---

## 1. Create a Google Sheet

1. Create a new Google Spreadsheet (or use an existing one).
2. Copy the spreadsheet ID from the URL:
   `https://docs.google.com/spreadsheets/d/<GOOGLE_SHEET_ID>/edit`

The sync script will create the required tabs automatically.

---

## 2. Set up Google credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Create a project (or pick an existing one).
3. Enable **Google Sheets API** and **Google Drive API**.
4. Create a **Service Account** and download the JSON key file.
5. Open your Google Sheet and **Share** it with the service account email (e.g. `sync@your-project.iam.gserviceaccount.com`) as **Editor**.

---

## 3. Get your Airtable token

1. In Airtable, go to [Developer hub → Personal access tokens](https://airtable.com/create/tokens).
2. Create a token with `data.records:read` scope for your base.
3. Copy the token (starts with `pat`).

---

## 4. Configure secrets (GitHub Actions — recommended for ongoing sync)

In your GitHub repo, go to **Settings → Secrets and variables → Actions** and add:

| Secret | Value |
|---|---|
| `AIRTABLE_API_KEY` | Your Airtable personal access token |
| `AIRTABLE_BASE_ID` | `appZoN6xBB9mDv8h4` (or your base ID) |
| `AIRTABLE_TABLE_ID` | `tblQcfo7qgQCv7o3n` (Adversus API — this is the default) |
| `GOOGLE_SHEET_ID` | Spreadsheet ID from step 1 |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Full contents of the service account JSON file (paste as one line) |

Optional secrets:

| Secret | Purpose |
|---|---|
| `GOOGLE_SHEET_TAB` | Name of the sheet tab (default: `Adversus API`) |
| `AIRTABLE_VIEW` | Sync only records from a specific Airtable view |
| `SYNC_TABLES_JSON` | Advanced: sync multiple tables (JSON array) |

Once secrets are set, the workflow in `.github/workflows/airtable-sheets-sync.yml` runs **every 15 minutes**. You can also trigger it manually from the **Actions** tab.

---

## 5. Run locally (optional)

```bash
cd sync
cp config.example.env .env
# Edit .env with your values

# Option A: put JSON in .env as GOOGLE_SERVICE_ACCOUNT_JSON=...
# Option B: point to the key file:
# GOOGLE_SERVICE_ACCOUNT_FILE=/path/to/service-account.json

pip install -r requirements.txt
../sync/run_sync.sh
```

---

## 6. Run on a schedule without GitHub Actions

Use cron on any server that can reach the internet:

```bash
# Every 15 minutes
*/15 * * * * cd /path/to/telesales-dashboard && /path/to/sync/run_sync.sh >> /var/log/airtable-sync.log 2>&1
```

Ensure the same environment variables from `config.example.env` are available to cron.

---

## Customising tables

By default only **Adversus API** (`tblQcfo7qgQCv7o3n`) is synced. To change the target tab name, set:

```
GOOGLE_SHEET_TAB=My Calls Data
```

To sync a different table, set `AIRTABLE_TABLE_ID` to the table ID from Airtable.

For advanced use (multiple tables), set `SYNC_TABLES_JSON`:

```json
[
  {"id": "tblQcfo7qgQCv7o3n", "name": "Adversus API", "sheet": "Adversus API"}
]
```

---

## Troubleshooting

| Error | Fix |
|---|---|
| `Missing required environment variable` | Set all required env vars / GitHub secrets |
| `403 / Permission denied` (Google) | Share the sheet with the service account email |
| `403` (Airtable) | Token needs `data.records:read` for the base |
| `404` (Airtable table) | Check exact table name including emoji characters |
| Sheet tabs empty | Confirm the base has records and the token can read them |
