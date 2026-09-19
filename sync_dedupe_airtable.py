#!/usr/bin/env python3
"""Sync missing records to Base 2 and remove exact duplicate rows in both bases."""

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict

API_KEY = os.environ["AIRTABLE_API_KEY"]
API_BASE = "https://api.airtable.com/v0"

BASE1 = "appZoN6xBB9mDv8h4"
BASE2 = "appwocx9mhLR8Mh33"
TABLE_ID = "tblPosmpZAiDpHAkS"
VIEW_ID = "viwV3D5roNTUKUPJl"

BATCH_SIZE = 10
REQUEST_DELAY = 0.22  # ~4.5 req/s, under Airtable's 5 req/s limit


def api_request(method: str, url: str, payload=None):
    data = None
    headers = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}
    if payload is not None:
        data = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            body = resp.read().decode()
            return json.loads(body) if body else {}
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        raise RuntimeError(f"{method} {url} failed ({e.code}): {body}") from e


def fetch_all_records(base_id: str) -> list[dict]:
    records = []
    offset = None
    while True:
        params = {"view": VIEW_ID, "pageSize": "100"}
        if offset:
            params["offset"] = offset
        url = f"{API_BASE}/{base_id}/{TABLE_ID}?{urllib.parse.urlencode(params)}"
        data = api_request("GET", url)
        records.extend(data.get("records", []))
        offset = data.get("offset")
        if not offset:
            break
    return records


def normalize(value):
    if value is None:
        return None
    if isinstance(value, list):
        return tuple(normalize(v) for v in value)
    if isinstance(value, dict):
        return json.dumps(value, sort_keys=True)
    return str(value).strip()


def record_signature(fields: dict) -> str:
    return json.dumps(
        {k: normalize(v) for k, v in sorted(fields.items())},
        sort_keys=True,
    )


def chunked(items, size):
    for i in range(0, len(items), size):
        yield items[i : i + size]


def create_records(base_id: str, field_rows: list[dict], dry_run: bool) -> list[str]:
    created_ids = []
    url = f"{API_BASE}/{base_id}/{TABLE_ID}"
    for batch in chunked(field_rows, BATCH_SIZE):
        if dry_run:
            created_ids.extend([f"dry-run-{i}" for i in range(len(batch))])
            continue
        payload = {"records": [{"fields": fields} for fields in batch]}
        result = api_request("POST", url, payload)
        created_ids.extend(r["id"] for r in result.get("records", []))
        time.sleep(REQUEST_DELAY)
    return created_ids


def delete_records(base_id: str, record_ids: list[str], dry_run: bool) -> int:
    deleted = 0
    for batch in chunked(record_ids, BATCH_SIZE):
        if dry_run:
            deleted += len(batch)
            continue
        params = urllib.parse.urlencode([("records[]", rid) for rid in batch], doseq=True)
        url = f"{API_BASE}/{base_id}/{TABLE_ID}?{params}"
        api_request("DELETE", url)
        deleted += len(batch)
        time.sleep(REQUEST_DELAY)
    return deleted


def find_exact_duplicates(records: list[dict]) -> list[str]:
    """Return Airtable record IDs to delete (keep oldest rec id per identical group)."""
    groups = defaultdict(list)
    for rec in records:
        groups[record_signature(rec.get("fields", {}))].append(rec)

    to_delete = []
    for group in groups.values():
        if len(group) < 2:
            continue
        group.sort(key=lambda r: r["id"])
        to_delete.extend(r["id"] for r in group[1:])
    return to_delete


def plan_sync(base1_records: list[dict], base2_records: list[dict]) -> list[dict]:
    base2_lead_ids = {
        normalize(r["fields"].get("lead_id"))
        for r in base2_records
        if normalize(r["fields"].get("lead_id"))
    }
    to_create = []
    seen_signatures = {record_signature(r["fields"]) for r in base2_records}

    for rec in base1_records:
        fields = rec.get("fields", {})
        lead_id = normalize(fields.get("lead_id"))
        if not lead_id or lead_id in base2_lead_ids:
            continue
        sig = record_signature(fields)
        if sig in seen_signatures:
            continue
        to_create.append(fields)
        seen_signatures.add(sig)
        base2_lead_ids.add(lead_id)

    return to_create


def main():
    parser = argparse.ArgumentParser(description="Sync missing leads and remove exact duplicates")
    parser.add_argument("--dry-run", action="store_true", help="Plan only, no API writes")
    parser.add_argument("--sync-only", action="store_true")
    parser.add_argument("--dedupe-only", action="store_true")
    args = parser.parse_args()

    print("Fetching Base 1...", file=sys.stderr)
    base1_records = fetch_all_records(BASE1)
    print(f"  {len(base1_records)} records", file=sys.stderr)

    print("Fetching Base 2...", file=sys.stderr)
    base2_records = fetch_all_records(BASE2)
    print(f"  {len(base2_records)} records", file=sys.stderr)

    do_sync = not args.dedupe_only
    do_dedupe = not args.sync_only

    report = {"dry_run": args.dry_run, "sync": {}, "dedupe": {}}

    if do_sync:
        to_create = plan_sync(base1_records, base2_records)
        print(f"\nSync: {len(to_create)} records to create in Base 2")
        report["sync"] = {
            "records_to_create": len(to_create),
            "lead_ids": sorted({f.get("lead_id") for f in to_create}),
        }
        if not args.dry_run and to_create:
            created = create_records(BASE2, to_create, dry_run=False)
            report["sync"]["created_ids"] = created
            print(f"  Created {len(created)} records in Base 2")
        elif args.dry_run:
            print("  [dry-run] Skipping create")

    if do_dedupe:
        for base_id, label, records in [
            (BASE1, "Base 1", base1_records),
            (BASE2, "Base 2", base2_records),
        ]:
            to_delete = find_exact_duplicates(records)
            print(f"\nDedupe {label}: {len(to_delete)} exact duplicate records to delete")
            report["dedupe"][base_id] = {
                "label": label,
                "records_to_delete": len(to_delete),
                "record_ids": to_delete,
            }
            if not args.dry_run and to_delete:
                deleted = delete_records(base_id, to_delete, dry_run=False)
                report["dedupe"][base_id]["deleted"] = deleted
                print(f"  Deleted {deleted} records")
            elif args.dry_run:
                print("  [dry-run] Skipping delete")

    out_path = "/workspace/sync_dedupe_report.json"
    with open(out_path, "w") as f:
        json.dump(report, f, indent=2)
    print(f"\nReport saved to {out_path}", file=sys.stderr)

    if args.dry_run:
        print("\nRe-run without --dry-run to apply changes.")


if __name__ == "__main__":
    main()
