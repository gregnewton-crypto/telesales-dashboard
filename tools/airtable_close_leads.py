#!/usr/bin/env python3
"""Match exported lead lists against the Databowl Leads table and close the matches.

The Databowl lead id is the intended key and is used whenever the export carries
one. It cannot be trusted on its own: a small number of ids in the table belong
to a different lead entirely, complete with its own call history. An id match is
therefore only accepted when the email or phone on the same record backs it up.

When an id is contradicted by both contact fields, or when the export has no id
column at all, the row falls back to contact matching. Airtable holds genuine
duplicate submissions (the same person entering twice) alongside households that
share one phone number, so that fallback requires two of email, phone and first
name to agree before a record is closed.

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
    python3 tools/airtable_close_leads.py --sync-auto-formula --apply
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

# The lead id as it is spelled in the exports and on the table.
ID_COLUMN = "Databowl LeadId"
ID_FIELD = "Databowl Lead ID"

# "Lead open/closed (auto)" originally read only the Adversus outcome, so a lead
# closed by hand still showed as open in every view grouped on it. Field ids are
# used rather than names because Airtable rewrites names inside stored formulas.
AUTO_FIELD_ID = "fldiZLjWB3aXuUTW4"          # Lead open/closed (auto)
_ADVERSUS = "{fld0XrXF3YtWqWSAN}"            # Adversus Lead Status (lookup)
_MANUAL = "{fldBFGH4OGEBmuBID}"              # Lead open/closed (single select)
AUTO_FORMULA = (
    "IF(OR("
    f'SEARCH("Not interested", ARRAYJOIN({_ADVERSUS})), '
    f'SEARCH("Invalid", ARRAYJOIN({_ADVERSUS})), '
    f'SEARCH("Success", ARRAYJOIN({_ADVERSUS})), '
    f'SEARCH("Unqualified", ARRAYJOIN({_ADVERSUS})), '
    f'TRIM({_MANUAL}) = "{TARGET_STATUS}"'
    f'), "{TARGET_STATUS} ", "Open ")'
)
AUTO_DESCRIPTION = (
    "Closed when Adversus reports Not interested, Invalid, Success or Unqualified, "
    "or when Lead open/closed is set to Closed by hand. Prefer this over the manual "
    "single-select field. Maintained by tools/airtable_close_leads.py --sync-auto-formula."
)

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
        return rows, ID_COLUMN in (reader.fieldnames or [])


def build_index(records):
    index = {"id": defaultdict(list), "email": defaultdict(list), "phone": defaultdict(list)}
    for record in records:
        fields = record["fields"]
        lead_id = fields.get(ID_FIELD)
        if lead_id is not None:
            index["id"][str(int(lead_id))].append(record)
        email = norm_email(fields.get("Email"))
        if email:
            index["email"][email].append(record)
        phone = norm_phone(fields.get("Phone"))
        if phone:
            index["phone"][phone].append(record)
    return index


def contact_signals(row, fields):
    email = norm_email(row.get("Email"))
    phone = norm_phone(row.get("Phone number"))
    return (
        bool(email) and norm_email(fields.get("Email")) == email,
        bool(phone) and norm_phone(fields.get("Phone")) == phone,
    )


def resolve_row(row, index):
    """Pick the record(s) one export row refers to.

    Returns (accepted, review). Anything in review is reported but never written,
    so an ambiguous row leaves the table untouched.
    """
    lead_id = (row.get(ID_COLUMN) or "").strip()
    by_id = index["id"].get(lead_id, []) if lead_id else []

    # An id match wins outright, but only once a contact field agrees with it.
    verified, contradicted = [], []
    for record in by_id:
        email_hit, phone_hit = contact_signals(row, record["fields"])
        if email_hit or phone_hit:
            signals = ["lead id"] + [s for s, hit in (("email", email_hit), ("phone", phone_hit)) if hit]
            verified.append({"record": record, "tier": " + ".join(signals)})
        elif not norm_email(row.get("Email")) and not norm_phone(row.get("Phone number")):
            verified.append({"record": record, "tier": "lead id (no contact details to check)"})
        else:
            contradicted.append({"record": record, "tier": "lead id belongs to a different lead"})
    if verified:
        return verified, contradicted

    # Otherwise fall back to contact matching: two of email, phone and name.
    candidates = {}
    for record in index["email"].get(norm_email(row.get("Email")), []) + index["phone"].get(norm_phone(row.get("Phone number")), []):
        candidates[record["id"]] = record

    accepted = []
    review = list(contradicted)
    for record in candidates.values():
        email_hit, phone_hit = contact_signals(row, record["fields"])
        name_hit = names_agree(row.get("First name"), record["fields"])
        signals = [s for s, hit in (("email", email_hit), ("phone", phone_hit), ("name", name_hit)) if hit]
        label = " + ".join(signals) or "none"
        if len(signals) >= 2:
            accepted.append({"record": record, "tier": f"no usable lead id, matched on {label}"})
        else:
            review.append({"record": record, "tier": f"too weak to trust ({label})"})
    return accepted, review


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


def run_sync_auto_formula(token, apply_changes):
    """Point the auto field at the manual field as well as the Adversus outcome."""
    url = f"{API_ROOT}/meta/bases/{BASE_ID}/tables/{TABLE_ID}/fields/{AUTO_FIELD_ID}"
    schema = request_json(f"{API_ROOT}/meta/bases/{BASE_ID}/tables", token)
    table = next(t for t in schema["tables"] if t["id"] == TABLE_ID)
    field = next(f for f in table["fields"] if f["id"] == AUTO_FIELD_ID)
    current = field.get("options", {}).get("formula", "")
    print(f"field   : {field['name']!r}")
    print(f"current : {current}")
    print(f"wanted  : {AUTO_FORMULA}")
    if current == AUTO_FORMULA and field.get("description") == AUTO_DESCRIPTION:
        print("already up to date")
        return
    if not apply_changes:
        print("\ndry run - pass --apply to write the formula and description")
        return
    result = request_json(url, token, method="PATCH", payload={"options": {"formula": AUTO_FORMULA}, "description": AUTO_DESCRIPTION})
    if not result.get("options", {}).get("isValid"):
        die(f"Airtable rejected the formula: {result}")
    print("\nformula updated and reported valid by Airtable")


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
    parser.add_argument("exports", nargs="*", help=f"CSV export(s) of leads to close; a {ID_COLUMN!r} column is used when present")
    parser.add_argument("--apply", action="store_true", help="write to Airtable (default is a dry run)")
    parser.add_argument("--out", default="out", help="directory for reports and the rollback file")
    parser.add_argument("--view", help="restrict the Airtable read to a single view")
    parser.add_argument("--rollback", help="restore statuses from a rollback file and exit")
    parser.add_argument("--sync-auto-formula", action="store_true", help="update the 'Lead open/closed (auto)' formula and exit")
    args = parser.parse_args()

    token = os.environ.get("AIRTABLE_API_KEY")
    if not token:
        die("AIRTABLE_API_KEY is not set")

    if args.sync_auto_formula:
        run_sync_auto_formula(token, args.apply)
        return
    if args.rollback:
        run_rollback(token, args.rollback, args.apply)
        return
    if not args.exports:
        die("give at least one CSV export, or use --rollback or --sync-auto-formula")

    closed_value, choices = resolve_status_choice(token)
    print(f"field {STATUS_FIELD!r} options: {choices}")
    print(f"writing {closed_value!r}\n")

    rows = []
    for path in args.exports:
        export_rows, has_id = read_export(path)
        note = "with lead ids" if has_id else f"NO {ID_COLUMN!r} column - falling back to contact matching"
        print(f"read {len(export_rows):>5} rows from {path} ({note})")
        rows.extend(export_rows)

    records = fetch_records(token, args.view)
    print(f"read {len(records):>5} records from Airtable{f' (view {args.view})' if args.view else ''}")
    index = build_index(records)

    tier_counts = Counter()
    matched = {}          # record id -> (row, entry)
    unmatched = []        # export rows with no trustworthy candidate
    review = []           # candidates deliberately left untouched
    for row in rows:
        accepted, rejected = resolve_row(row, index)
        if accepted:
            for entry in accepted:
                tier_counts[entry["tier"]] += 1
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

    unique_leads = {
        (r.get(ID_COLUMN) or "").strip() or (norm_email(r.get("Email")), norm_phone(r.get("Phone number")))
        for r in rows
    }
    summarise(
        "Reconciliation",
        [
            ("Rows across all export files", len(rows)),
            ("Unique leads in exports", len(unique_leads)),
            ("Airtable records matched", len(matched)),
            *[(f"  - {tier}", count) for tier, count in sorted(tier_counts.items())],
            ("Records needing a status change", len(to_update)),
            ("Records already Closed", len(already_closed)),
            ("Export rows with no trustworthy match", len(unmatched)),
            ("Candidates left untouched for review", len(review)),
        ],
    )

    os.makedirs(args.out, exist_ok=True)
    write_csv(
        os.path.join(args.out, "matched.csv"),
        ["record_id", "airtable_lead_id", "airtable_name", "airtable_email", "airtable_phone", "previous_status", "new_status", "matched_on", "source_file", "source_line", "source_lead_id"],
        [
            [
                u["id"],
                matched[u["id"]][1]["record"]["fields"].get(ID_FIELD, ""),
                f"{matched[u['id']][1]['record']['fields'].get('First Name', '')} {matched[u['id']][1]['record']['fields'].get('Last Name', '')}".strip(),
                matched[u["id"]][1]["record"]["fields"].get("Email", ""),
                matched[u["id"]][1]["record"]["fields"].get("Phone", ""),
                u["_previous"] or "",
                closed_value,
                matched[u["id"]][1]["tier"],
                u["_row"]["_source"],
                u["_row"]["_line"],
                u["_row"].get(ID_COLUMN, ""),
            ]
            for u in to_update
        ],
    )
    write_csv(
        os.path.join(args.out, "exceptions_not_found.csv"),
        ["source_file", "source_line", "source_lead_id", "first_name", "email", "phone", "campaign"],
        [[r["_source"], r["_line"], r.get(ID_COLUMN, ""), r.get("First name", ""), r.get("Email", ""), r.get("Phone number", ""), r.get("Campaign", "")] for r in unmatched],
    )
    write_csv(
        os.path.join(args.out, "review_left_untouched.csv"),
        ["source_file", "source_line", "source_lead_id", "csv_first_name", "csv_email", "csv_phone", "record_id", "airtable_lead_id", "airtable_name", "airtable_email", "airtable_phone", "airtable_status", "reason"],
        [
            [
                row["_source"], row["_line"], row.get(ID_COLUMN, ""), row.get("First name", ""), row.get("Email", ""), row.get("Phone number", ""),
                entry["record"]["id"],
                entry["record"]["fields"].get(ID_FIELD, ""),
                f"{entry['record']['fields'].get('First Name', '')} {entry['record']['fields'].get('Last Name', '')}".strip(),
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
