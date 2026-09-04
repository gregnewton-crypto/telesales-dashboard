#!/usr/bin/env python3
"""Close Irish Databowl leads that have hit the automatic-redial attempt cap.

Targets the Telesales System base (appZoN6xBB9mDv8h4), table ☘ Databowl Leads.
Also keeps the Lead open/closed (auto) formula aligned with the attempt cap.

Usage:
  python tools/airtable_close_leads.py --dry-run
  python tools/airtable_close_leads.py --apply
  python tools/airtable_close_leads.py --sync-auto-formula
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import date
from typing import Any

BASE_ID = "appZoN6xBB9mDv8h4"
TABLE_ID = "tbllpLbEtTkmMQOY9"
MAX_ATTEMPTS = 7

FIELD_LEAD_OPEN_CLOSED = "Lead open/closed"
FIELD_IN_ADVERSUS = "In Adversus Open List"
FIELD_DATE_CLOSED = "Date Closed"
FIELD_STATUS = "Adversus Lead Status (single select)"
FIELD_ATTEMPTS = "Times Lead has been Called"
FIELD_AUTO = "Lead open/closed (auto)"

CLOSED_VALUE = "Closed "
OPEN_VALUE = "Open "
IN_LIST_NO = "No"

AUTO_FORMULA_FIELD_ID = "fldiZLjWB3aXuUTW4"
AUTO_FORMULA = (
    'IF(OR({fldltpNNg1dKOMOAe} = "No", '
    '{fld9R1fOEzvXLCTzd} = "Not interested", '
    '{fld9R1fOEzvXLCTzd} = "Invalid", '
    '{fld9R1fOEzvXLCTzd} = "Success", '
    '{fld9R1fOEzvXLCTzd} = "Unqualified", '
    'AND({fld9R1fOEzvXLCTzd} = "Automatic redial", {fldsKBO1ZpAImfV8C} >= '
    f"{MAX_ATTEMPTS})), "
    '"Closed ", '
    'IF({fldltpNNg1dKOMOAe} = "Yes", "Open ", '
    'IF(TRIM({fldBFGH4OGEBmuBID}) = "Closed", "Closed ", "Open ")))'
)

AUTO_FORMULA_DESCRIPTION = (
    "Closed when In Adversus Open List is No, when the latest Adversus outcome is "
    "Not interested, Invalid, Success or Unqualified, or when the lead is on "
    f"Automatic redial with {MAX_ATTEMPTS}+ call attempts. Open when the lead is "
    "still on the Adversus export. Same precedence as the lead automations. "
    "Maintained by tools/airtable_close_leads.py --sync-auto-formula."
)

CLOSE_FILTER = (
    f'AND({{{FIELD_STATUS}}} = "Automatic redial", '
    f"{{{FIELD_ATTEMPTS}}} >= {MAX_ATTEMPTS}, "
    f'OR({{{FIELD_LEAD_OPEN_CLOSED}}} != "{CLOSED_VALUE}", '
    f"{{{FIELD_LEAD_OPEN_CLOSED}}} = BLANK()))"
)


class AirtableClient:
    def __init__(self, api_key: str) -> None:
        self.api_key = api_key

    def _request(
        self,
        method: str,
        url: str,
        payload: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        data = None
        headers = {"Authorization": f"Bearer {self.api_key}"}
        if payload is not None:
            data = json.dumps(payload).encode()
            headers["Content-Type"] = "application/json"
        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req) as resp:
                body = resp.read().decode()
                return json.loads(body) if body else {}
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode()
            raise RuntimeError(f"{method} {url} failed ({exc.code}): {detail}") from exc

    def list_records(
        self,
        formula: str,
        fields: list[str] | None = None,
    ) -> list[dict[str, Any]]:
        records: list[dict[str, Any]] = []
        offset: str | None = None
        while True:
            params: dict[str, Any] = {
                "filterByFormula": formula,
                "pageSize": "100",
            }
            if fields:
                params["fields[]"] = fields
            if offset:
                params["offset"] = offset
            query = urllib.parse.urlencode(params, doseq=True)
            url = f"https://api.airtable.com/v0/{BASE_ID}/{TABLE_ID}?{query}"
            data = self._request("GET", url)
            records.extend(data.get("records", []))
            offset = data.get("offset")
            if not offset:
                break
        return records

    def update_records(self, records: list[dict[str, Any]]) -> None:
        url = f"https://api.airtable.com/v0/{BASE_ID}/{TABLE_ID}"
        for i in range(0, len(records), 10):
            chunk = records[i : i + 10]
            self._request("PATCH", url, {"records": chunk})

    def sync_auto_formula(self) -> None:
        url = (
            f"https://api.airtable.com/v0/meta/bases/{BASE_ID}/tables/"
            f"{TABLE_ID}/fields/{AUTO_FORMULA_FIELD_ID}"
        )
        self._request(
            "PATCH",
            url,
            {
                "description": AUTO_FORMULA_DESCRIPTION,
                "options": {"formula": AUTO_FORMULA},
            },
        )


def build_close_payload(record_id: str, closed_on: str) -> dict[str, Any]:
    return {
        "id": record_id,
        "fields": {
            FIELD_LEAD_OPEN_CLOSED: CLOSED_VALUE,
            FIELD_IN_ADVERSUS: IN_LIST_NO,
            FIELD_DATE_CLOSED: closed_on,
        },
    }


def close_capped_redials(client: AirtableClient, apply: bool) -> int:
    matches = client.list_records(
        CLOSE_FILTER,
        [
            "Lead",
            FIELD_STATUS,
            FIELD_ATTEMPTS,
            FIELD_LEAD_OPEN_CLOSED,
            FIELD_IN_ADVERSUS,
        ],
    )
    if not matches:
        print("No automatic-redial leads need closing.")
        return 0

    print(f"Found {len(matches)} automatic-redial leads with {MAX_ATTEMPTS}+ attempts to close.")
    for record in matches[:10]:
        fields = record.get("fields", {})
        print(
            f"  - {fields.get('Lead')} "
            f"({fields.get(FIELD_ATTEMPTS)} attempts, "
            f"currently {fields.get(FIELD_LEAD_OPEN_CLOSED)!r})"
        )
    if len(matches) > 10:
        print(f"  ... and {len(matches) - 10} more")

    if not apply:
        print("Dry run only. Re-run with --apply to update Airtable.")
        return len(matches)

    closed_on = date.today().isoformat()
    updates = [build_close_payload(record["id"], closed_on) for record in matches]
    client.update_records(updates)
    print(f"Closed {len(updates)} leads (Date Closed = {closed_on}).")
    return len(updates)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Write lead closures to Airtable (default is dry-run).",
    )
    parser.add_argument(
        "--sync-auto-formula",
        action="store_true",
        help="Update Lead open/closed (auto) formula to include the attempt cap.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show which leads would be closed without writing changes.",
    )
    args = parser.parse_args()

    api_key = os.environ.get("AIRTABLE_API_KEY")
    if not api_key:
        print("AIRTABLE_API_KEY is not set.", file=sys.stderr)
        return 1

    client = AirtableClient(api_key)

    if args.sync_auto_formula:
        client.sync_auto_formula()
        print(
            f"Updated {FIELD_AUTO} formula for {MAX_ATTEMPTS}+ automatic-redial attempts."
        )

    if args.apply or args.dry_run or not args.sync_auto_formula:
        close_capped_redials(client, apply=args.apply)

    if not (args.apply or args.dry_run or args.sync_auto_formula):
        parser.print_help()
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
