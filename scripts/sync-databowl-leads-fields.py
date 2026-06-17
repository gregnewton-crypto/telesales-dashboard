#!/usr/bin/env python3
"""Sync computed single-select fields on the Databowl Leads table.

Fields maintained:
  - ⚙ Called?
  - Time lead has been called (single select)
  - Adversus Lead Status (single select)
  - Lead open/closed

These fields mirror rollup/lookup values and should stay in sync whenever
calls are linked or lead status changes. Run manually or on a schedule.
"""

from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

BASE_ID = "appZoN6xBB9mDv8h4"
TABLE_ID = "tbllpLbEtTkmMQOY9"

FIELD_CALLED = "\u2699\ufe0f Called?"
FIELD_TIME_CALLED = "Time lead has been called (single select)"
FIELD_STATUS = "Adversus Lead Status (single select)"
FIELD_OPEN_CLOSED = "Lead open/closed"
FIELD_TIMES_CALLED = "Times Lead has been Called"
FIELD_STATUS_LOOKUP = "Adversus Lead Status"

CLOSED_STATUSES = frozenset({"Not interested", "Invalid", "Success", "Unqualified"})
OPEN_STATUSES = frozenset(
    {"Automatic redial", "VIP callback", "Private callback", "Shared callback"}
)
VALID_STATUSES = CLOSED_STATUSES | OPEN_STATUSES
MAX_TIME_BUCKET = 20


def get_token() -> str:
    token = os.environ.get("AIRTABLE_API_KEY") or os.environ.get("AIRTABLE_PAT")
    if not token:
        raise SystemExit("Set AIRTABLE_API_KEY or AIRTABLE_PAT")
    return token


def api_request(token: str, method: str, path: str, payload: dict | None = None) -> dict:
    url = f"https://api.airtable.com/v0/{path}"
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req) as resp:
            body = resp.read().decode("utf-8")
            return json.loads(body) if body else {}
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Airtable API {exc.code}: {detail}") from exc


def fetch_all_records(token: str) -> list[dict]:
    records: list[dict] = []
    offset: str | None = None
    while True:
        query = urllib.parse.urlencode({"pageSize": 100, **({"offset": offset} if offset else {})})
        data = api_request(token, "GET", f"{BASE_ID}/{TABLE_ID}?{query}")
        records.extend(data.get("records", []))
        offset = data.get("offset")
        if not offset:
            break
    return records


def latest_lookup_status(lookup: object) -> str | None:
    if not lookup:
        return None
    if isinstance(lookup, list):
        for value in reversed(lookup):
            if value in VALID_STATUSES:
                return value
        return lookup[-1] if lookup else None
    return str(lookup)


def compute_open_closed(status: str | None) -> str:
    if status in CLOSED_STATUSES:
        return "Closed "
    if status in OPEN_STATUSES:
        return "Open "
    return "Open "


def compute_updates(fields: dict) -> dict:
    updates: dict = {}
    times = fields.get(FIELD_TIMES_CALLED) or 0

    called = "Yes" if times > 0 else "No"
    if fields.get(FIELD_CALLED) != called:
        updates[FIELD_CALLED] = called

    if times > 0:
        time_value = str(min(int(times), MAX_TIME_BUCKET))
        if fields.get(FIELD_TIME_CALLED) != time_value:
            updates[FIELD_TIME_CALLED] = time_value
    elif fields.get(FIELD_TIME_CALLED) is not None:
        updates[FIELD_TIME_CALLED] = None

    lookup_status = latest_lookup_status(fields.get(FIELD_STATUS_LOOKUP))
    if lookup_status in VALID_STATUSES:
        if fields.get(FIELD_STATUS) != lookup_status:
            updates[FIELD_STATUS] = lookup_status
    elif fields.get(FIELD_STATUS) is not None:
        updates[FIELD_STATUS] = None

    # Open/closed must follow the lookup (what the grid shows), not only the
    # single-select copy which often lags behind when automations miss a run.
    effective_status = lookup_status or updates.get(FIELD_STATUS) or fields.get(FIELD_STATUS)
    open_closed = compute_open_closed(effective_status)
    if fields.get(FIELD_OPEN_CLOSED) != open_closed:
        updates[FIELD_OPEN_CLOSED] = open_closed

    return updates


def patch_records(token: str, updates: list[dict]) -> None:
    for index in range(0, len(updates), 10):
        batch = updates[index : index + 10]
        api_request(
            token,
            "PATCH",
            f"{BASE_ID}/{TABLE_ID}",
            {"records": batch, "typecast": True},
        )
        time.sleep(0.22)


def main() -> int:
    dry_run = "--dry-run" in sys.argv
    token = get_token()
    records = fetch_all_records(token)

    pending: list[dict] = []
    stats = {"checked": 0, "changed": 0}

    for record in records:
        stats["checked"] += 1
        field_updates = compute_updates(record.get("fields", {}))
        if field_updates:
            stats["changed"] += 1
            pending.append({"id": record["id"], "fields": field_updates})

    print(
        json.dumps(
            {
                "recordsChecked": stats["checked"],
                "recordsToUpdate": stats["changed"],
                "dryRun": dry_run,
            },
            indent=2,
        )
    )

    if dry_run or not pending:
        return 0

    patch_records(token, pending)
    print(f"Updated {len(pending)} records.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
