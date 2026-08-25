#!/usr/bin/env python3
"""Compare two Airtable tables for missing records and duplicates."""

import json
import os
import sys
import urllib.parse
import urllib.request
from collections import Counter, defaultdict

API_KEY = os.environ["AIRTABLE_API_KEY"]
API_BASE = "https://api.airtable.com/v0"

BASES = {
    "appZoN6xBB9mDv8h4": "Base 1 (appZoN6xBB9mDv8h4)",
    "appwocx9mhLR8Mh33": "Base 2 (appwocx9mhLR8Mh33)",
}
TABLE_ID = "tblPosmpZAiDpHAkS"
VIEW_ID = "viwV3D5roNTUKUPJl"


def fetch_all_records(base_id: str) -> list[dict]:
    records = []
    offset = None
    while True:
        params = {"view": VIEW_ID, "pageSize": "100"}
        if offset:
            params["offset"] = offset
        url = f"{API_BASE}/{base_id}/{TABLE_ID}?{urllib.parse.urlencode(params)}"
        req = urllib.request.Request(url, headers={"Authorization": f"Bearer {API_KEY}"})
        with urllib.request.urlopen(req) as resp:
            data = json.load(resp)
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


def record_signature(fields: dict) -> tuple:
    """Comparable signature across all fields except Airtable-managed ones."""
    return tuple(sorted((k, normalize(v)) for k, v in fields.items()))


def main():
    all_data = {}
    for base_id, label in BASES.items():
        print(f"Fetching {label}...", file=sys.stderr)
        records = fetch_all_records(base_id)
        all_data[base_id] = {"label": label, "records": records}
        print(f"  {len(records)} records", file=sys.stderr)

    base_ids = list(BASES.keys())
    b1, b2 = base_ids[0], base_ids[1]
    r1 = all_data[b1]["records"]
    r2 = all_data[b2]["records"]

    def build_indexes(records):
        by_lead_id = defaultdict(list)
        by_signature = defaultdict(list)
        for rec in records:
            fields = rec.get("fields", {})
            lead_id = normalize(fields.get("lead_id"))
            by_lead_id[lead_id].append(rec)
            by_signature[record_signature(fields)].append(rec)
        return by_lead_id, by_signature

    idx1_lead, idx1_sig = build_indexes(r1)
    idx2_lead, idx2_sig = build_indexes(r2)

    lead_ids_1 = {k for k in idx1_lead if k and k != "None"}
    lead_ids_2 = {k for k in idx2_lead if k and k != "None"}

    missing_in_2 = sorted(lead_ids_1 - lead_ids_2, key=lambda x: (len(x), x))
    missing_in_1 = sorted(lead_ids_2 - lead_ids_1, key=lambda x: (len(x), x))
    common = lead_ids_1 & lead_ids_2

    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)
    print(f"{all_data[b1]['label']}: {len(r1)} records, {len(lead_ids_1)} unique lead_ids")
    print(f"{all_data[b2]['label']}: {len(r2)} records, {len(lead_ids_2)} unique lead_ids")
    print(f"Common lead_ids: {len(common)}")
    print(f"In Base 1 only (missing from Base 2): {len(missing_in_2)}")
    print(f"In Base 2 only (missing from Base 1): {len(missing_in_1)}")

    # Duplicates within each base
    print("\n" + "=" * 70)
    print("DUPLICATES WITHIN EACH BASE (by lead_id)")
    print("=" * 70)
    for base_id in base_ids:
        label = all_data[base_id]["label"]
        dup_lead = {k: v for k, v in idx1_lead.items() if k and len(v) > 1} if base_id == b1 else {k: v for k, v in idx2_lead.items() if k and len(v) > 1}
        idx_lead = idx1_lead if base_id == b1 else idx2_lead
        dup_lead = {k: v for k, v in idx_lead.items() if k and k != "None" and len(v) > 1}
        print(f"\n{label}: {len(dup_lead)} duplicated lead_id values")
        for lead_id in sorted(dup_lead, key=lambda x: (-len(dup_lead[x]), x))[:20]:
            recs = dup_lead[lead_id]
            print(f"  lead_id={lead_id!r} -> {len(recs)} records: {[r['id'] for r in recs]}")

    print("\n" + "=" * 70)
    print("DUPLICATES WITHIN EACH BASE (identical field content)")
    print("=" * 70)
    for base_id in base_ids:
        label = all_data[base_id]["label"]
        idx_sig = idx1_sig if base_id == b1 else idx2_sig
        dup_sig = {k: v for k, v in idx_sig.items() if len(v) > 1}
        print(f"\n{label}: {len(dup_sig)} groups of identical records")
        shown = 0
        for sig, recs in sorted(dup_sig.items(), key=lambda x: -len(x[1])):
            if shown >= 10:
                break
            lead_ids = [normalize(r["fields"].get("lead_id")) for r in recs]
            print(f"  {len(recs)} identical records, lead_ids={lead_ids}, airtable_ids={[r['id'] for r in recs]}")
            shown += 1

    # Content differences for common lead_ids
    print("\n" + "=" * 70)
    print("COMMON lead_ids WITH DIFFERENT CONTENT")
    print("=" * 70)
    content_diffs = []
    for lead_id in common:
        sigs1 = {record_signature(r["fields"]) for r in idx1_lead[lead_id]}
        sigs2 = {record_signature(r["fields"]) for r in idx2_lead[lead_id]}
        if sigs1 != sigs2:
            content_diffs.append(lead_id)

    print(f"Found {len(content_diffs)} lead_ids present in both but with different field values")
    for lead_id in sorted(content_diffs)[:15]:
        r1_fields = idx1_lead[lead_id][0]["fields"]
        r2_fields = idx2_lead[lead_id][0]["fields"]
        diffs = []
        all_keys = set(r1_fields) | set(r2_fields)
        for k in sorted(all_keys):
            v1, v2 = normalize(r1_fields.get(k)), normalize(r2_fields.get(k))
            if v1 != v2:
                diffs.append(f"    {k}: {v1!r} vs {v2!r}")
        print(f"\n  lead_id={lead_id!r}")
        for d in diffs[:8]:
            print(d)
        if len(diffs) > 8:
            print(f"    ... and {len(diffs)-8} more field differences")

    print("\n" + "=" * 70)
    print(f"MISSING FROM BASE 2 ({len(missing_in_2)} records)")
    print("=" * 70)
    for lead_id in missing_in_2[:30]:
        rec = idx1_lead[lead_id][0]
        f = rec["fields"]
        print(f"  lead_id={lead_id!r} | email={f.get('email','')} | name={f.get('firstname','')} {f.get('lastname','')} | ts={f.get('timestamp','')}")
    if len(missing_in_2) > 30:
        print(f"  ... and {len(missing_in_2)-30} more")

    print("\n" + "=" * 70)
    print(f"MISSING FROM BASE 1 ({len(missing_in_1)} records)")
    print("=" * 70)
    for lead_id in missing_in_1[:30]:
        rec = idx2_lead[lead_id][0]
        f = rec["fields"]
        print(f"  lead_id={lead_id!r} | email={f.get('email','')} | name={f.get('firstname','')} {f.get('lastname','')} | ts={f.get('timestamp','')}")
    if len(missing_in_1) > 30:
        print(f"  ... and {len(missing_in_1)-30} more")

    # Save full report
    report = {
        "summary": {
            "base1_count": len(r1),
            "base2_count": len(r2),
            "base1_unique_lead_ids": len(lead_ids_1),
            "base2_unique_lead_ids": len(lead_ids_2),
            "common": len(common),
            "missing_in_base2": len(missing_in_2),
            "missing_in_base1": len(missing_in_1),
            "content_differences": len(content_diffs),
        },
        "missing_in_base2": [
            {"lead_id": lid, "fields": idx1_lead[lid][0]["fields"], "airtable_id": idx1_lead[lid][0]["id"]}
            for lid in missing_in_2
        ],
        "missing_in_base1": [
            {"lead_id": lid, "fields": idx2_lead[lid][0]["fields"], "airtable_id": idx2_lead[lid][0]["id"]}
            for lid in missing_in_1
        ],
        "content_differences": content_diffs,
    }
    with open("/workspace/airtable_comparison_report.json", "w") as f:
        json.dump(report, f, indent=2, default=str)
    print("\nFull report saved to airtable_comparison_report.json", file=sys.stderr)


if __name__ == "__main__":
    main()
