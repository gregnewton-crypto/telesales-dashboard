#!/usr/bin/env python3
"""Sync one KPI row: count Marro sales in Live, write 🔴 Sales to Reporting.

First bridge between Live and Reporting bases. Defaults to W26 D2MS Marro UK.

Usage:
  export AIRTABLE_PAT="pat_..."
  python3 scripts/sync_marro_sales_one_row.py

Optional args: week year channel brand market
  python3 scripts/sync_marro_sales_one_row.py 26 2026 D2MS Marro UK
"""
import json
import os
import sys
import time
import urllib.parse
import urllib.request

LIVE_BASE = "appwocx9mhLR8Mh33"
REPORTING_BASE = "appmGv8xrLQ7RaeIa"

LIVE_TABLE = "Marro Sales"
REPORTING_TABLE = "📊 Weekly KPIs v2"

WEEK = int(sys.argv[1]) if len(sys.argv) > 1 else 26
YEAR = int(sys.argv[2]) if len(sys.argv) > 2 else 2026
CHANNEL = sys.argv[3] if len(sys.argv) > 3 else "D2MS"
BRAND = sys.argv[4] if len(sys.argv) > 4 else "Marro"
MARKET = sys.argv[5] if len(sys.argv) > 5 else "UK"

# Maps Reporting Channel to Live Direct Sales Team Name
TEAM_FOR_CHANNEL = {
    "D2MS": "D2MS",
    "Internal Telesales": None,  # multiple teams — not supported in this minimal script
}


def get_pat():
    pat = os.environ.get("AIRTABLE_PAT") or os.environ.get("AIRTABLE_API_KEY")
    if not pat:
        raise SystemExit("Set AIRTABLE_PAT to your personal access token.")
    return pat


def api(method, url, pat, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={
            "Authorization": f"Bearer {pat}",
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read())


def count_live_sales(pat, team):
    formula = f"AND({{⚙️ ISO Week}}={WEEK}, {{⚙️ Year}}={YEAR}, {{Direct Sales Team Name}}='{team}')"
    total = 0
    offset = None
    while True:
        url = (
            f"https://api.airtable.com/v0/{LIVE_BASE}/{urllib.parse.quote(LIVE_TABLE)}"
            f"?pageSize=100&filterByFormula={urllib.parse.quote(formula)}"
        )
        if offset:
            url += f"&offset={urllib.parse.quote(offset)}"
        data = api("GET", url, pat)
        total += len(data.get("records", []))
        offset = data.get("offset")
        if not offset:
            return total
        time.sleep(0.21)


def find_reporting_row(pat):
    formula = (
        f"AND({{⚙️ Week Number}}='{WEEK}', {{📡 Channel}}='{CHANNEL}', "
        f"{{🎯 Brand}}='{BRAND}', {{🌍 Market}}='{MARKET}')"
    )
    url = (
        f"https://api.airtable.com/v0/{REPORTING_BASE}/{urllib.parse.quote(REPORTING_TABLE)}"
        f"?filterByFormula={urllib.parse.quote(formula)}&maxRecords=1"
    )
    data = api("GET", url, pat)
    records = data.get("records", [])
    if not records:
        raise SystemExit(
            f"No Reporting row found for W{WEEK} {CHANNEL} {BRAND} {MARKET}."
        )
    return records[0]


def update_sales(pat, record_id, sales_count):
    url = f"https://api.airtable.com/v0/{REPORTING_BASE}/{urllib.parse.quote(REPORTING_TABLE)}"
    body = {"records": [{"id": record_id, "fields": {"🔴 Sales": sales_count}}]}
    api("PATCH", url, pat, body)


def main():
    pat = get_pat()
    team = TEAM_FOR_CHANNEL.get(CHANNEL)
    if not team:
        raise SystemExit(f"Channel '{CHANNEL}' needs team mapping — use D2MS for this script.")

    print(f"Reading Live: {BRAND} sales, W{WEEK} {YEAR}, team={team}...")
    sales_count = count_live_sales(pat, team)
    print(f"  Live count: {sales_count}")

    row = find_reporting_row(pat)
    kpi_key = row["fields"].get("KPI Key", row["id"])
    old_sales = row["fields"].get("🔴 Sales")
    print(f"Reporting row: {kpi_key}")
    print(f"  Old 🔴 Sales: {old_sales}")

    update_sales(pat, row["id"], sales_count)
    print(f"  Updated 🔴 Sales -> {sales_count}")
    print("Done.")


if __name__ == "__main__":
    main()
