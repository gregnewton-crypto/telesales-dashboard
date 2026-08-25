#!/usr/bin/env python3
"""Profile the IE Telesales System Airtable base.

Pulls every record from the two IE tables and prints a field-by-field profile:
fill rates, distinct values, date coverage and the joins between calls and leads.
Used to work out which dashboard metrics the base can actually support.

Usage: AIRTABLE_API_KEY=pat... python3 tools/ie_data_profile.py
"""

import os
import sys
import json
import time
from collections import Counter, defaultdict
from datetime import datetime

import requests

BASE_ID = "appIxUjQdnPPLvSrp"
TABLES = {
    "leads": "tblBTK97ySGD8j9uZ",   # Ireland Leads
    "calls": "tblHzJwEqbcpOpXOf",   # Adversus Ireland
}
API = "https://api.airtable.com/v0"


def fetch_all(token, table_id):
    records, offset = [], None
    while True:
        params = {"pageSize": 100}
        if offset:
            params["offset"] = offset
        r = requests.get(
            f"{API}/{BASE_ID}/{table_id}",
            headers={"Authorization": f"Bearer {token}"},
            params=params,
            timeout=60,
        )
        r.raise_for_status()
        data = r.json()
        records.extend(data.get("records", []))
        offset = data.get("offset")
        if not offset:
            return records
        time.sleep(0.22)  # stay under Airtable's 5 req/s limit


def profile(name, records, max_distinct=25):
    print(f"\n{'=' * 78}\n{name}: {len(records)} records\n{'=' * 78}")
    fill = Counter()
    values = defaultdict(Counter)
    for rec in records:
        for field, val in rec["fields"].items():
            fill[field] += 1
            if isinstance(val, list):
                val = f"<list len={len(val)}>"
            values[field][str(val)[:60]] += 1

    total = len(records) or 1
    for field in sorted(fill, key=lambda f: -fill[f]):
        distinct = len(values[field])
        pct = 100 * fill[field] / total
        print(f"\n  {field}\n    filled {fill[field]}/{total} ({pct:.1f}%), {distinct} distinct")
        if distinct <= max_distinct:
            for v, c in values[field].most_common():
                print(f"      {c:>7}  {v}")
        else:
            for v, c in values[field].most_common(5):
                print(f"      {c:>7}  {v}")
            print(f"      ... {distinct - 5} more")


def date_span(records, field):
    dates = []
    for rec in records:
        v = rec["fields"].get(field)
        if isinstance(v, str) and len(v) >= 10:
            try:
                dates.append(datetime.fromisoformat(v[:10]))
            except ValueError:
                pass
    if not dates:
        return None
    return min(dates), max(dates), len(dates)


def main():
    token = os.environ.get("AIRTABLE_API_KEY")
    if not token:
        sys.exit("AIRTABLE_API_KEY not set")

    data = {}
    for name, table_id in TABLES.items():
        print(f"Fetching {name}...", file=sys.stderr)
        data[name] = fetch_all(token, table_id)

    for name, records in data.items():
        profile(name, records)

    print(f"\n{'=' * 78}\nDATE COVERAGE\n{'=' * 78}")
    for name, field in (("leads", "Date"), ("calls", "Date")):
        span = date_span(data[name], field)
        if span:
            lo, hi, n = span
            print(f"  {name}.{field}: {lo:%Y-%m-%d} to {hi:%Y-%m-%d} ({n} dated records)")

    print(f"\n{'=' * 78}\nJOIN INTEGRITY\n{'=' * 78}")
    lead_ids = {r["fields"].get("Databowl Lead ID") for r in data["leads"]}
    lead_ids.discard(None)
    call_lead_ids = [r["fields"].get("Databowl LeadId") for r in data["calls"]]
    matched = sum(1 for v in call_lead_ids if v in lead_ids)
    linked = sum(1 for r in data["calls"] if r["fields"].get("☘ Databowl Leads"))
    print(f"  distinct Databowl Lead ID in leads: {len(lead_ids)}")
    print(f"  calls with Databowl LeadId matching a lead: {matched}/{len(data['calls'])}")
    print(f"  calls with a record link to a lead:          {linked}/{len(data['calls'])}")

    print(f"\n{'=' * 78}\nCALLS PER LEAD\n{'=' * 78}")
    per_lead = Counter()
    for r in data["calls"]:
        lid = r["fields"].get("Databowl LeadId")
        if lid is not None:
            per_lead[lid] += 1
    dist = Counter(per_lead.values())
    for n in sorted(dist):
        print(f"  {n:>3} call(s): {dist[n]:>6} leads")

    print(f"\n{'=' * 78}\nOUTCOME COUNTS (conversion proxy)\n{'=' * 78}")
    outcome = Counter(
        r["fields"].get("Adversus Lead Status (single select)", "(blank)")
        for r in data["leads"]
    )
    for k, v in outcome.most_common():
        print(f"  {v:>7}  {k}")

    with open("/tmp/ie_raw.json", "w") as fh:
        json.dump({k: v for k, v in data.items()}, fh)
    print("\nRaw records written to /tmp/ie_raw.json", file=sys.stderr)


if __name__ == "__main__":
    main()
