#!/usr/bin/env python3
"""Sync Airtable tables into Google Sheets on a full-replace basis."""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone
from typing import Any

import gspread
import requests
from google.oauth2.service_account import Credentials

AIRTABLE_API = "https://api.airtable.com/v0"
SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]

DEFAULT_TABLE = {
    "id": "tblQcfo7qgQCv7o3n",
    "name": "Adversus API",
    "sheet": "Adversus API",
}


def env(name: str, default: str | None = None, required: bool = False) -> str:
    value = os.environ.get(name, default)
    if required and not value:
        raise SystemExit(f"Missing required environment variable: {name}")
    return value or ""


def load_tables_config() -> list[dict[str, str]]:
    table_id = env("AIRTABLE_TABLE_ID")
    sheet_tab = env("GOOGLE_SHEET_TAB", default=DEFAULT_TABLE["sheet"])
    if table_id:
        return [{"id": table_id, "sheet": sheet_tab}]

    raw = env("SYNC_TABLES_JSON")
    if raw:
        try:
            tables = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise SystemExit(f"Invalid SYNC_TABLES_JSON: {exc}") from exc
        if not isinstance(tables, list) or not tables:
            raise SystemExit("SYNC_TABLES_JSON must be a non-empty JSON array")
        return tables

    return [DEFAULT_TABLE]


def flatten_value(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, bool):
        return "TRUE" if value else "FALSE"
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        parts: list[str] = []
        for item in value:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict):
                if "name" in item:
                    parts.append(str(item["name"]))
                elif "email" in item:
                    parts.append(str(item["email"]))
                elif "url" in item:
                    parts.append(str(item["url"]))
                else:
                    parts.append(json.dumps(item, ensure_ascii=False))
            else:
                parts.append(str(item))
        return ", ".join(parts)
    if isinstance(value, dict):
        if "name" in value:
            return str(value["name"])
        if "url" in value:
            return str(value["url"])
        return json.dumps(value, ensure_ascii=False)
    return str(value)


def fetch_airtable_records(
    token: str,
    base_id: str,
    table_name: str,
    view: str | None = None,
) -> list[dict[str, Any]]:
    headers = {"Authorization": f"Bearer {token}"}
    records: list[dict[str, Any]] = []
    offset: str | None = None

    while True:
        params: dict[str, str] = {"pageSize": "100"}
        if offset:
            params["offset"] = offset
        if view:
            params["view"] = view

        response = requests.get(
            f"{AIRTABLE_API}/{base_id}/{requests.utils.quote(table_name, safe='')}",
            headers=headers,
            params=params,
            timeout=60,
        )
        if not response.ok:
            detail = response.text
            try:
                detail = response.json().get("error", {}).get("message", detail)
            except ValueError:
                pass
            raise RuntimeError(
                f"Airtable error for table '{table_name}' ({response.status_code}): {detail}"
            )

        payload = response.json()
        records.extend(payload.get("records", []))
        offset = payload.get("offset")
        if not offset:
            break

    return records


def records_to_rows(records: list[dict[str, Any]]) -> tuple[list[str], list[list[str]]]:
    field_names: list[str] = []
    seen: set[str] = set()

    for record in records:
        for field in record.get("fields", {}):
            if field not in seen:
                seen.add(field)
                field_names.append(field)

    headers = ["Record ID", "Created Time", *field_names]
    rows: list[list[str]] = []

    for record in records:
        fields = record.get("fields", {})
        row = [
            record.get("id", ""),
            record.get("createdTime", ""),
            *[flatten_value(fields.get(name)) for name in field_names],
        ]
        rows.append(row)

    return headers, rows


def get_google_client(credentials_json: str) -> gspread.Client:
    info = json.loads(credentials_json)
    credentials = Credentials.from_service_account_info(info, scopes=SCOPES)
    return gspread.authorize(credentials)


def ensure_worksheet(
    spreadsheet: gspread.Spreadsheet,
    title: str,
) -> gspread.Worksheet:
    try:
        return spreadsheet.worksheet(title)
    except gspread.WorksheetNotFound:
        return spreadsheet.add_worksheet(title=title, rows=1000, cols=26)


def write_sheet(
    worksheet: gspread.Worksheet,
    headers: list[str],
    rows: list[list[str]],
) -> None:
    worksheet.clear()
    values = [headers, *rows]
    if not values:
        return

    worksheet.update(
        range_name="A1",
        values=values,
        value_input_option="USER_ENTERED",
    )

    header_range = f"A1:{gspread.utils.rowcol_to_a1(1, len(headers))}"
    worksheet.format(
        header_range,
        {
            "textFormat": {"bold": True},
            "backgroundColor": {"red": 0.32, "green": 0.16, "blue": 0.06},
            "horizontalAlignment": "CENTER",
        },
    )
    worksheet.freeze(rows=1)


def sync_table(
    token: str,
    base_id: str,
    spreadsheet: gspread.Spreadsheet,
    table_name: str,
    sheet_name: str,
    view: str | None,
) -> dict[str, Any]:
    records = fetch_airtable_records(token, base_id, table_name, view=view)
    headers, rows = records_to_rows(records)
    worksheet = ensure_worksheet(spreadsheet, sheet_name)
    write_sheet(worksheet, headers, rows)
    return {
        "table": table_name,
        "sheet": sheet_name,
        "records": len(rows),
        "columns": len(headers),
    }


def write_metadata_sheet(
    spreadsheet: gspread.Spreadsheet,
    results: list[dict[str, Any]],
) -> None:
    worksheet = ensure_worksheet(spreadsheet, "Sync Status")
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    rows = [
        ["Last Sync (UTC)", now],
        [],
        ["Airtable Table", "Google Sheet", "Records Synced", "Columns"],
    ]
    for result in results:
        rows.append(
            [
                result["table"],
                result["sheet"],
                str(result["records"]),
                str(result["columns"]),
            ]
        )
    worksheet.clear()
    worksheet.update("A1", rows, value_input_option="USER_ENTERED")
    worksheet.freeze(rows=1)


def main() -> int:
    token = env("AIRTABLE_API_KEY", required=True)
    base_id = env("AIRTABLE_BASE_ID", default="appZoN6xBB9mDv8h4", required=True)
    spreadsheet_id = env("GOOGLE_SHEET_ID", required=True)
    credentials_json = env("GOOGLE_SERVICE_ACCOUNT_JSON", required=True)
    default_view = env("AIRTABLE_VIEW") or None

    tables = load_tables_config()
    client = get_google_client(credentials_json)
    spreadsheet = client.open_by_key(spreadsheet_id)

    results: list[dict[str, Any]] = []
    errors: list[str] = []

    for table in tables:
        table_ref = table.get("id") or table.get("name", "")
        table_label = table.get("name") or table_ref
        sheet_name = table.get("sheet", table_label)
        view = table.get("view", default_view)
        try:
            result = sync_table(
                token=token,
                base_id=base_id,
                spreadsheet=spreadsheet,
                table_name=table_ref,
                sheet_name=sheet_name,
                view=view,
            )
            result["table"] = table_label
            results.append(result)
            print(
                f"Synced {result['records']} records from '{table_label}' "
                f"to sheet '{sheet_name}'"
            )
        except Exception as exc:  # noqa: BLE001 - report all table failures
            message = f"{table_label}: {exc}"
            errors.append(message)
            print(f"ERROR: {message}", file=sys.stderr)

    if results:
        write_metadata_sheet(spreadsheet, results)

    if errors:
        print("\nSync completed with errors:", file=sys.stderr)
        for error in errors:
            print(f"  - {error}", file=sys.stderr)
        return 1

    print("\nSync completed successfully.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
