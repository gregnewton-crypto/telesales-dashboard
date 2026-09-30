# Marro Data — Google Sheet → Airtable sync config

## Sources

| Item | Value |
|------|--------|
| Google Sheet | https://docs.google.com/spreadsheets/d/142ZecCq1ESvqzzyx7WTMPZ17KD1zBNKp3QAhMXsH9Oo/edit |
| Sheet tab GID | `1806194688` (confirm tab name is **Marro Data**) |
| Airtable base | `appobJQOD7gBH0JE1` |
| Airtable table | `tblG1YHO2Svo8S7MZ` (UI name: **Table 1** — consider renaming to **Marro Data**) |
| Field map CSV | [marro-data-airtable-field-map.csv](./marro-data-airtable-field-map.csv) |

Schema was verified against the Airtable Metadata API on 2026-09-30. All target fields are **Single line text** today, so the sync can send string values without select-option setup.

## Sync key (upsert)

The export can fan out multiple rows per subscription (see `tools/d2ms_retention_audit.py`). Use the same logical key:

1. **User id** — regex on `Admin User Link` (column AK): `/users/(\d+)/`
2. **Cat Name** (column S) — lowercased, trimmed
3. **Created Date** (column D) — trimmed

Composite key string:

```text
{user_id}|{cat_name_lower}|{created_date}
```

Fallback if `Admin User Link` is empty: use lowercased **Email** instead of user id.

Matching strategy:

- If sheet **airtable_record_id** (column AN) is filled → `PATCH` that record.
- Else → `filterByFormula` on a dedicated Airtable field **sync_key** *or* search by formula comparing the three parts (slower). **Recommended:** add a **sync_key** single line text field in Airtable and write the composite key on every upsert so future runs are simple.

## Sheet columns to add before first sync

| Column | Purpose |
|--------|---------|
| **AN — airtable_record_id** | Filled by script after create; speeds updates |
| **AO — sync_key** | Optional formula mirroring composite key; helps debugging |
| **AP — last_synced_at** | Optional ISO timestamp |
| **AQ — sync_error** | Optional last error message |

## Duplicate headers warning

Columns **O** and **AF** are both named `Box 1 to Pause` in the sheet. Apps Script must map by **column index**, not by header text alone.

| Letter | Sheet header | Airtable field |
|--------|----------------|----------------|
| O | Box 1 to Pause | Box 1 to Pause |
| AF | Box 1 to Pause | Box 1 to Pause (v1) |
| N | Sale To Pause | Sale To Pause |
| AG | Sale to Pause | Sale to Pause (v1) |
| AH | BOX 1 TO PAUSE | BOX 1 TO PAUSE (v2) |

## Postcode split (one sheet column → three Airtable fields)

From column **AA** (`Postcode`):

- **Postcode** — full value
- **Postcode part 1** — outward code (before the space)
- **Postcode part 2** — inward code (after the space)

Example: `SW1A 1AA` → `SW1A`, `1AA`.

## Apps Script script properties

| Property | Example |
|----------|---------|
| `AIRTABLE_PAT` | pat… |
| `AIRTABLE_BASE_ID` | appobJQOD7gBH0JE1 |
| `AIRTABLE_TABLE_ID` | tblG1YHO2Svo8S7MZ |
| `SHEET_NAME` | Marro Data |
| `DATA_START_ROW` | 2 |

## Next step

Implement `runSync()` using the column letters in the CSV, then run once manually before adding a time-driven trigger.
