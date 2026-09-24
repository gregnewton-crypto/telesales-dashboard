#!/usr/bin/env python3
"""Export the Adversus Ireland "Google sheet sync" Airtable view to CSV.

Usage:
  AIRTABLE_API_KEY=pat... python3 tools/airtable_gsheet_sync/export_view_to_csv.py \\
    --output /path/to/adversus_ireland.csv
"""

from __future__ import annotations

import argparse
import csv
import os
import sys
import time
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent))
from airtable_flatten import record_to_row

BASE_ID = "appIxUjQdnPPLvSrp"
TABLE_ID = "tblHzJwEqbcpOpXOf"
VIEW_ID = "viw2nCAuhRPkM51tb"
API = "https://api.airtable.com/v0"
PAGE_SIZE = 100
REQUEST_DELAY_SEC = 0.22


def fetch_all_records(token: str) -> list[dict]:
    url = f"{API}/{BASE_ID}/{TABLE_ID}"
    headers = {"Authorization": f"Bearer {token}"}
    records: list[dict] = []
    offset = None
    while True:
        params: dict[str, str | int] = {"pageSize": PAGE_SIZE, "view": VIEW_ID}
        if offset:
            params["offset"] = offset
        resp = requests.get(url, headers=headers, params=params, timeout=120)
        resp.raise_for_status()
        data = resp.json()
        records.extend(data.get("records", []))
        offset = data.get("offset")
        if not offset:
            return records
        time.sleep(REQUEST_DELAY_SEC)


def collect_columns(records: list[dict]) -> list[str]:
    columns: set[str] = set()
    for record in records:
        columns.update((record.get("fields") or {}).keys())
    return sorted(columns)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output",
        "-o",
        type=Path,
        default=Path("adversus_ireland_google_sheet_sync.csv"),
        help="CSV output path",
    )
    args = parser.parse_args()

    token = os.environ.get("AIRTABLE_API_KEY")
    if not token:
        sys.exit("AIRTABLE_API_KEY is not set")

    print("Fetching records from Airtable...", file=sys.stderr)
    records = fetch_all_records(token)
    field_columns = collect_columns(records)
    header = ["airtable_record_id", *field_columns]
    print(f"Writing {len(records)} rows x {len(header)} columns...", file=sys.stderr)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        writer.writerow(header)
        for record in records:
            writer.writerow(record_to_row(record, field_columns))

    print(f"Wrote {args.output}", file=sys.stderr)


if __name__ == "__main__":
    main()
