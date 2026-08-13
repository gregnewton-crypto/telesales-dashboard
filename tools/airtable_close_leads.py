#!/usr/bin/env python3
"""Match exported lead lists against the Databowl Leads table and close the matches.

The exports carry no Databowl Lead ID, so records are matched on email and phone
with the lead's first name as a tie-breaker. Airtable holds genuine duplicate
submissions (the same person entering twice) alongside households that share one
phone number, so a single key on its own is not safe: two of the three signals
must agree before a record is closed.

Only the "Lead open/closed" field is ever written, via PATCH, so every other
field on the record is left untouched. A rollback file recording the previous
value of each touched record is written before the first write.

The reports name individual leads, so --out defaults inside out/, which this
repository ignores. This repo is public: keep the reports out of commits.

Usage:
    export AIRTABLE_API_KEY=pat...
    python3 tools/airtable_close_leads.py leads_a.csv leads_b.csv            # dry run
    python3 tools/airtable_close_leads.py leads_a.csv leads_b.csv --apply
    python3 tools/airtable_close_leads.py --rollback out/rollback.json --apply
"""

import argparse
import csv
import difflib
import json
import os
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter, defaultdict

API_ROOT = "https://api.airtable.com/v0"
BASE_ID = "appZoN6xBB9mDv8h4"
TABLE_ID = "tbllpLbEtTkmMQOY9"
STATUS_FIELD = "Lead open/closed"
TARGET_STATUS = "Closed"

# Airtable allows 5 requests/second per base.
REQUEST_INTERVAL = 0.22
BATCH_SIZE = 10
MAX_RETRIES = 5

# Irish mobile numbers are stored as +353XXXXXXXXX; exports occasionally use the
# national 08X form or a 00 international prefix.
IE_COUNTRY_CODE = "353"

# Shortenings that appear in the exports but not in Airtable (or vice versa).
NAME_ALIASES = {
    "tommy": "thomas",
    "tom": "thomas",
    "ben": "benjamin",
    "dolly": "dolores",
    "kate": "katherine",
    "katie": "katherine",
    "cathy": "catherine",
    "kathy": "catherine",
    "liz": "elizabeth",
    "lizzie": "elizabeth",
    "beth": "elizabeth",
    "mick": "michael",
    "mike": "michael",
    "paddy": "patrick",
    "pat": "patrick",
    "pj": "patrick",
    "danny": "daniel",
    "dan": "daniel",
    "jim": "james",
    "jimmy": "james",
    "seamie": "seamus",
    "maggie": "margaret",
    "peggy": "margaret",
    "sue": "susan",
    "suzie": "susan",
    "chris": "christopher",
    "steve": "stephen",
    "dave": "david",
    "nick": "nicholas",
    "rob": "robert",
    "bob": "robert",
    "bobby": "robert",
    "tony": "anthony",
    "andy": "andrew",
    "matt": "matthew",
    "joe": "joseph",
    "jo": "joanne",
    "sam": "samuel",
    "will": "william",
    "billy": "william",
    "harry": "henry",
    "eddie": "edward",
    "ted": "edward",
    "ger": "gerard",
    "gerry": "gerard",
    "derry": "dermot",
    "trish": "patricia",
    "tricia": "patricia",
    "sandy": "sandra",
    "sally": "sarah",
    "molly": "mary",
    "may": "mary",
    "nan": "nancy",
    "abbie": "abigail",
    "abby": "abigail",
    "ellie": "eleanor",
    "nikki": "nicola",
    "niki": "nicola",
    "weronika": "veronika",
}


def die(message):
    sys.stderr.write(f"error: {message}\n")
    sys.exit(1)


# ---------------------------------------------------------------- normalisation


def strip_accents(text):
    return "".join(c for c in unicodedata.normalize("NFKD", text) if not unicodedata.combining(c))


def norm_email(value):
    return (value or "").strip().lower()


def norm_phone(value):
    """Reduce a phone number to bare digits in +353 national form."""
    digits = re.sub(r"\D", "", value or "")
    if not digits:
        return ""
    if digits.startswith("00"):
        digits = digits[2:]
    if digits.startswith("0"):
        digits = IE_COUNTRY_CODE + digits[1:]
    return digits


def norm_name(value):
    name = strip_accents((value or "").strip().lower())
    name = re.sub(r"[^a-z]", "", name)
    return NAME_ALIASES.get(name, name)


def names_agree(csv_first, record_fields):
    """True when the export's first name plausibly belongs to the Airtable record."""
    left = norm_name(csv_first)
    if len(left) < 2:
        return False
    candidates = {
        norm_name(record_fields.get("First Name")),
        norm_name(record_fields.get("Last Name")),
    }
    for part in re.split(r"\s+", strip_accents(str(record_fields.get("Lead") or ""))):
        candidates.add(norm_name(part))
    for right in candidates:
        if len(right) < 2:
            continue
        if left == right:
            return True
        shortest = min(len(left), len(right))
        if shortest >= 3 and (left.startswith(right) or right.startswith(left)):
            return True
        if difflib.SequenceMatcher(None, left, right).ratio() >= 0.85:
            return True
    return False


# ------------------------------------------------------------------- Airtable IO


def request_json(url, token, method="GET", payload=None):
    data = json.dumps(payload).encode() if payload is not None else None
    headers = {"Authorization": f"Bearer {token}"}
    if data:
        headers["Content-Type"] = "application/json"
    for attempt in range(MAX_RETRIES):
        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req) as response:
                return json.load(response)
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", "replace")
            retryable = exc.code == 429 or exc.code >= 500
            if retryable and attempt < MAX_RETRIES - 1:
                time.sleep(2**attempt)
                continue
            die(f"{method} {url} -> HTTP {exc.code}: {body}")
        except urllib.error.URLError as exc:
            if attempt < MAX_RETRIES - 1:
                time.sleep(2**attempt)
                continue
            die(f"{method} {url} -> {exc.reason}")
    return None


def resolve_status_choice(token):
    """Return the select option exactly as Airtable spells it.

    The live option name carries a trailing space ("Closed "); sending a trimmed
    string would either fail validation or create a second look-alike option.
    """
    schema = request_json(f"{API_ROOT}/meta/bases/{BASE_ID}/tables", token)
    table = next((t for t in schema["tables"] if t["id"] == TABLE_ID), None)
    if table is None:
        die(f"table {TABLE_ID} not found in base {BASE_ID}")
    field = next((f for f in table["fields"] if f["name"] == STATUS_FIELD), None)
    if field is None:
        die(f"field {STATUS_FIELD!r} not found on table {table['name']!r}")
    choices = [c["name"] for c in field.get("options", {}).get("choices", [])]
    exact = [c for c in choices if c.strip().lower() == TARGET_STATUS.lower()]
    if not exact:
        die(f"no {TARGET_STATUS!r} option on {STATUS_FIELD!r}; available: {choices}")
    return exact[0], choices


def fetch_records(token, view=None):
    records = []
    offset = None
    while True:
        query = {"pageSize": 100}
        if view:
            query["view"] = view
        if offset:
            query["offset"] = offset
        url = f"{API_ROOT}/{BASE_ID}/{TABLE_ID}?{urllib.parse.urlencode(query)}"
        page = request_json(url, token)
        records.extend(page["records"])
        offset = page.get("offset")
        if not offset:
            return records
        time.sleep(REQUEST_INTERVAL)


def patch_records(token, updates, progress=True):
    """PATCH in batches; only the fields supplied are modified."""
    url = f"{API_ROOT}/{BASE_ID}/{TABLE_ID}"
    written = 0
    for start in range(0, len(updates), BATCH_SIZE):
        batch = updates[start : start + BATCH_SIZE]
        request_json(url, token, method="PATCH", payload={"records": batch, "typecast": False})
        written += len(batch)
        if progress:
            print(f"  updated {written}/{len(updates)}", end="\r", flush=True)
        time.sleep(REQUEST_INTERVAL)
    if progress and written:
        print(f"  updated {written}/{len(updates)}")
    return written


# ---------------------------------------------------------------------- matching


def read_export(path):
    with open(path, newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        required = {"Email", "Phone number", "First name"}
        missing = required - set(reader.fieldnames or [])
        if missing:
            die(f"{path} is missing column(s): {', '.join(sorted(missing))}")
        rows = []
        for line, row in enumerate(reader, start=2):
            row["_source"] = os.path.basename(path)
            row["_line"] = line
            rows.append(row)
    return rows


def build_indexes(records):
    by_email = defaultdict(list)
    by_phone = defaultdict(list)
    for record in records:
        fields = record["fields"]
        email = norm_email(fields.get("Email"))
        phone = norm_phone(fields.get("Phone"))
        if email:
            by_email[email].append(record)
        if phone:
            by_phone[phone].append(record)
    return by_email, by_phone


def score_candidates(row, by_email, by_phone):
    """Score every candidate record for one export row.

    Two of {email, phone, name} must agree. Email plus phone is treated as an
    exact match; a lone key with a matching name is accepted as the same person
    re-submitting with a new address or number.
    """
    email = norm_email(row.get("Email"))
    phone = norm_phone(row.get("Phone number"))
    candidates = {}
    for record in by_email.get(email, []) + by_phone.get(phone, []):
        candidates[record["id"]] = record

    accepted, rejected = [], []
    for record in candidates.values():
        fields = record["fields"]
        email_hit = bool(email) and norm_email(fields.get("Email")) == email
        phone_hit = bool(phone) and norm_phone(fields.get("Phone")) == phone
        name_hit = names_agree(row.get("First name"), fields)
        signals = [s for s, hit in (("email", email_hit), ("phone", phone_hit), ("name", name_hit)) if hit]
        entry = {"record": record, "signals": signals}
        if email_hit and phone_hit:
            entry["tier"] = "exact (email+phone)"
            accepted.append(entry)
        elif len(signals) >= 2:
            entry["tier"] = f"corroborated ({'+'.join(signals)})"
            accepted.append(entry)
        else:
            entry["tier"] = f"weak ({'+'.join(signals) or 'none'})"
            rejected.append(entry)
    return accepted, rejected


# ------------------------------------------------------------------- reporting


def write_csv(path, header, rows):
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(header)
        writer.writerows(rows)


def summarise(title, pairs):
    width = max(len(label) for label, _ in pairs)
    print(f"\n{title}")
    print("-" * len(title))
    for label, value in pairs:
        print(f"  {label.ljust(width)}  {value}")


# ----------------------------------------------------------------------- driver


def run_rollback(token, path, apply_changes):
    with open(path, encoding="utf-8") as handle:
        entries = json.load(handle)["records"]
    updates = [{"id": e["id"], "fields": {STATUS_FIELD: e["previous"]}} for e in entries]
    print(f"rollback: restoring {STATUS_FIELD} on {len(updates)} record(s) from {path}")
    if not apply_changes:
        print("dry run - pass --apply to write")
        return
    patch_records(token, updates)
    print("rollback complete")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("exports", nargs="*", help="CSV export(s) of leads to close")
    parser.add_argument("--apply", action="store_true", help="write to Airtable (default is a dry run)")
    parser.add_argument("--out", default="out", help="directory for reports and the rollback file")
    parser.add_argument("--view", help="restrict the Airtable read to a single view")
    parser.add_argument("--rollback", help="restore statuses from a rollback file and exit")
    args = parser.parse_args()

    token = os.environ.get("AIRTABLE_API_KEY")
    if not token:
        die("AIRTABLE_API_KEY is not set")

    if args.rollback:
        run_rollback(token, args.rollback, args.apply)
        return
    if not args.exports:
        die("give at least one CSV export, or use --rollback")

    closed_value, choices = resolve_status_choice(token)
    print(f"field {STATUS_FIELD!r} options: {choices}")
    print(f"writing {closed_value!r}\n")

    rows = []
    for path in args.exports:
        export_rows = read_export(path)
        print(f"read {len(export_rows):>5} rows from {path}")
        rows.extend(export_rows)

    records = fetch_records(token, args.view)
    print(f"read {len(records):>5} records from Airtable{f' (view {args.view})' if args.view else ''}")
    by_email, by_phone = build_indexes(records)

    tier_counts = Counter()
    matched = {}          # record id -> (row, entry)
    unmatched = []        # export rows with no acceptable candidate
    review = []           # candidates rejected as too weak to trust
    for row in rows:
        accepted, rejected = score_candidates(row, by_email, by_phone)
        if accepted:
            for entry in accepted:
                tier_counts[entry["tier"].split(" ")[0]] += 1
                matched.setdefault(entry["record"]["id"], (row, entry))
        else:
            unmatched.append(row)
        for entry in rejected:
            review.append((row, entry))

    to_update, already_closed = [], []
    for record_id, (row, entry) in matched.items():
        current = entry["record"]["fields"].get(STATUS_FIELD)
        if (current or "").strip().lower() == TARGET_STATUS.lower():
            already_closed.append((record_id, row, current))
        else:
            to_update.append({"id": record_id, "fields": {STATUS_FIELD: closed_value}, "_previous": current, "_row": row})

    unique_leads = {(norm_email(r.get("Email")), norm_phone(r.get("Phone number"))) for r in rows}
    summarise(
        "Reconciliation",
        [
            ("Rows across all export files", len(rows)),
            ("Unique leads in exports", len(unique_leads)),
            ("Airtable records matched", len(matched)),
            ("  - exact (email + phone)", tier_counts["exact"]),
            ("  - corroborated by name", tier_counts["corroborated"]),
            ("Records needing a status change", len(to_update)),
            ("Records already Closed", len(already_closed)),
            ("Export rows with no match", len(unmatched)),
            ("Weak candidates held for review", len(review)),
        ],
    )

    os.makedirs(args.out, exist_ok=True)
    write_csv(
        os.path.join(args.out, "matched.csv"),
        ["record_id", "databowl_lead_id", "lead", "airtable_email", "airtable_phone", "previous_status", "new_status", "tier", "source_file", "source_line"],
        [
            [
                u["id"],
                matched[u["id"]][1]["record"]["fields"].get("Databowl Lead ID", ""),
                matched[u["id"]][1]["record"]["fields"].get("Lead", ""),
                matched[u["id"]][1]["record"]["fields"].get("Email", ""),
                matched[u["id"]][1]["record"]["fields"].get("Phone", ""),
                u["_previous"] or "",
                closed_value,
                matched[u["id"]][1]["tier"],
                u["_row"]["_source"],
                u["_row"]["_line"],
            ]
            for u in to_update
        ],
    )
    write_csv(
        os.path.join(args.out, "exceptions_not_found.csv"),
        ["source_file", "source_line", "first_name", "email", "phone", "campaign"],
        [[r["_source"], r["_line"], r.get("First name", ""), r.get("Email", ""), r.get("Phone number", ""), r.get("Campaign", "")] for r in unmatched],
    )
    write_csv(
        os.path.join(args.out, "review_weak_matches.csv"),
        ["source_file", "source_line", "csv_first_name", "csv_email", "csv_phone", "record_id", "airtable_lead", "airtable_email", "airtable_phone", "airtable_status", "matched_on"],
        [
            [
                row["_source"], row["_line"], row.get("First name", ""), row.get("Email", ""), row.get("Phone number", ""),
                entry["record"]["id"],
                entry["record"]["fields"].get("Lead", ""),
                entry["record"]["fields"].get("Email", ""),
                entry["record"]["fields"].get("Phone", ""),
                entry["record"]["fields"].get(STATUS_FIELD, ""),
                entry["tier"],
            ]
            for row, entry in review
        ],
    )
    print(f"\nreports written to {args.out}/")

    if not to_update:
        print("nothing to change")
        return
    if not args.apply:
        print(f"dry run - pass --apply to set {STATUS_FIELD} on {len(to_update)} record(s)")
        return

    rollback_path = os.path.join(args.out, "rollback.json")
    with open(rollback_path, "w", encoding="utf-8") as handle:
        json.dump(
            {
                "base": BASE_ID,
                "table": TABLE_ID,
                "field": STATUS_FIELD,
                "records": [{"id": u["id"], "previous": u["_previous"]} for u in to_update],
            },
            handle,
            indent=2,
        )
    print(f"rollback file written to {rollback_path}")

    print(f"applying {closed_value!r} to {len(to_update)} record(s)")
    patch_records(token, [{"id": u["id"], "fields": u["fields"]} for u in to_update])

    verify = {r["id"]: r["fields"].get(STATUS_FIELD) for r in fetch_records(token)}
    confirmed = sum(1 for u in to_update if (verify.get(u["id"]) or "").strip().lower() == TARGET_STATUS.lower())
    print(f"verified {confirmed}/{len(to_update)} record(s) now read {closed_value!r}")
    if confirmed != len(to_update):
        die("verification failed - inspect the rollback file before retrying")


if __name__ == "__main__":
    main()
