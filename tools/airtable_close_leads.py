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
    python3 tools/airtable_close_leads.py --mark-open-list open_leads.csv --apply
    python3 tools/airtable_close_leads.py --reconcile-open open_leads.csv --apply

Writing "Lead open/closed" directly does not survive on this table: the
"Databowl lead date IE" automation recomputes it on every run and overwrote a
2,814-record update within seconds. Prefer --mark-open-list, which writes the
field that automation reads. See tools/airtable_automation_lead_status.js.
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
_OPEN_LIST = "{fldltpNNg1dKOMOAe}"           # In Adversus Open List

# Mirrors the precedence the two lead automations use, so the two status fields
# cannot disagree. Without the open list first, a lead Adversus still has queued
# but whose last outcome was terminal reads Open in one field and Closed in the
# other, which is the contradiction this whole exercise started from.
_OUTCOME_RULE = (
    "IF(OR("
    f'SEARCH("Not interested", ARRAYJOIN({_ADVERSUS})), '
    f'SEARCH("Invalid", ARRAYJOIN({_ADVERSUS})), '
    f'SEARCH("Success", ARRAYJOIN({_ADVERSUS})), '
    f'SEARCH("Unqualified", ARRAYJOIN({_ADVERSUS})), '
    f'TRIM({_MANUAL}) = "{TARGET_STATUS}"'
    f'), "{TARGET_STATUS} ", "Open ")'
)
AUTO_FORMULA = (
    f'IF({_OPEN_LIST} = "No", "{TARGET_STATUS} ", '
    f'IF({_OPEN_LIST} = "Yes", "Open ", {_OUTCOME_RULE}))'
)
# Single select read by the "Databowl lead date IE" automation. That automation
# rewrites Lead open/closed on every run, so writing the status directly does not
# survive; this field is an input to it rather than an output of it.
OPEN_LIST_FIELD = "In Adversus Open List"
OPEN_LIST_YES = "Yes"
OPEN_LIST_NO = "No"

AUTO_DESCRIPTION = (
    "Follows In Adversus Open List when it is set, otherwise closes on an Adversus "
    "outcome of Not interested, Invalid, Success or Unqualified, or on a manual close. "
    "Same precedence as the lead automations, so it should always agree with "
    "Lead open/closed. Maintained by tools/airtable_close_leads.py --sync-auto-formula."
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

    def pick(label):
        exact = [c for c in choices if c.strip().lower() == label.lower()]
        if not exact:
            die(f"no {label!r} option on {STATUS_FIELD!r}; available: {choices}")
        return exact[0]

    return pick(TARGET_STATUS), pick("Open"), choices


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


def run_reconcile_open(token, paths, apply_changes, out_dir, open_value, closed_value):
    """Treat the export(s) as the definitive list of leads that are still open.

    Everything the list does not name is closed, so a truncated or wrong-campaign
    export would close most of the table. The match rate is checked first and the
    run aborts if the list does not resolve cleanly.
    """
    rows = []
    for path in paths:
        export_rows, has_id = read_export(path)
        print(f"read {len(export_rows):>5} rows from {path} ({'with lead ids' if has_id else 'no lead ids'})")
        rows.extend(export_rows)

    records = fetch_records(token)
    print(f"read {len(records):>5} records from Airtable")
    index = build_index(records)

    keep, unresolved, review = set(), [], []
    for row in rows:
        accepted, rejected = resolve_row(row, index)
        if accepted:
            keep.update(entry["record"]["id"] for entry in accepted)
        else:
            unresolved.append(row)
        review.extend((row, entry) for entry in rejected)

    resolved = len(rows) - len(unresolved)
    rate = resolved / len(rows) if rows else 0
    to_close, to_open = [], []
    for record in records:
        current = (record["fields"].get(STATUS_FIELD) or "").strip().lower()
        if record["id"] in keep:
            if current != "open":
                to_open.append({"id": record["id"], "fields": {STATUS_FIELD: open_value}, "_previous": record["fields"].get(STATUS_FIELD)})
        elif current != TARGET_STATUS.lower():
            to_close.append({"id": record["id"], "fields": {STATUS_FIELD: closed_value}, "_previous": record["fields"].get(STATUS_FIELD)})

    summarise(
        "Reconciliation against the open list",
        [
            ("Rows in the open list", len(rows)),
            ("Rows resolved to a record", f"{resolved} ({rate:.1%})"),
            ("Rows that resolved to nothing", len(unresolved)),
            ("Airtable records to keep open", len(keep)),
            ("Records to close", len(to_close)),
            ("Records to re-open", len(to_open)),
            ("Records left as they are", len(records) - len(to_close) - len(to_open)),
            ("Resulting open / closed", f"{len(keep)} / {len(records) - len(keep)}"),
        ],
    )

    os.makedirs(out_dir, exist_ok=True)
    write_csv(
        os.path.join(out_dir, "reconcile_changes.csv"),
        ["record_id", "airtable_lead_id", "airtable_name", "airtable_email", "previous_status", "new_status"],
        [
            [
                u["id"],
                next(r for r in records if r["id"] == u["id"])["fields"].get(ID_FIELD, ""),
                f"{next(r for r in records if r['id'] == u['id'])['fields'].get('First Name', '')} {next(r for r in records if r['id'] == u['id'])['fields'].get('Last Name', '')}".strip(),
                next(r for r in records if r["id"] == u["id"])["fields"].get("Email", ""),
                u["_previous"] or "",
                u["fields"][STATUS_FIELD],
            ]
            for u in to_close + to_open
        ],
    )
    write_csv(
        os.path.join(out_dir, "reconcile_unresolved.csv"),
        ["source_file", "source_line", "source_lead_id", "first_name", "email", "phone"],
        [[r["_source"], r["_line"], r.get(ID_COLUMN, ""), r.get("First name", ""), r.get("Email", ""), r.get("Phone number", "")] for r in unresolved],
    )
    print(f"\nreports written to {out_dir}/")

    if rate < 0.95:
        die(f"only {rate:.1%} of the open list resolved to a record; refusing to close {len(to_close)} records on a list this unreliable")
    updates = to_close + to_open
    if not updates:
        print("nothing to change")
        return
    if not apply_changes:
        print(f"dry run - pass --apply to close {len(to_close)} and re-open {len(to_open)} record(s)")
        return

    rollback_path = os.path.join(out_dir, "rollback.json")
    with open(rollback_path, "w", encoding="utf-8") as handle:
        json.dump({"base": BASE_ID, "table": TABLE_ID, "field": STATUS_FIELD,
                   "records": [{"id": u["id"], "previous": u["_previous"]} for u in updates]}, handle, indent=2)
    print(f"rollback file written to {rollback_path}")

    patch_records(token, [{"id": u["id"], "fields": u["fields"]} for u in updates])
    verify = {r["id"]: (r["fields"].get(STATUS_FIELD) or "").strip() for r in fetch_records(token)}
    wrong = [u for u in updates if verify.get(u["id"]) != u["fields"][STATUS_FIELD].strip()]
    print(f"verified {len(updates) - len(wrong)}/{len(updates)} record(s) now hold the intended status")
    if wrong:
        die(f"{len(wrong)} record(s) did not stick - something else is writing this field")


def run_mark_open_list(token, paths, apply_changes, out_dir, create_field):
    """Record, per lead, whether the Adversus export still lists it as open.

    Writing Lead open/closed directly does not survive, because the automation on
    this table recomputes it on every run. This writes the field the automation
    reads instead, so the status it derives matches the export.
    """
    schema = request_json(f"{API_ROOT}/meta/bases/{BASE_ID}/tables", token)
    table = next(t for t in schema["tables"] if t["id"] == TABLE_ID)
    field = next((f for f in table["fields"] if f["name"] == OPEN_LIST_FIELD), None)

    if field is None:
        if not create_field:
            die(
                f"field {OPEN_LIST_FIELD!r} does not exist on {table['name']!r}. "
                f"Re-run with --create-open-list-field to add it as a single select, "
                f"or add it by hand with options {OPEN_LIST_YES!r} and {OPEN_LIST_NO!r}."
            )
        if not apply_changes:
            print(f"dry run - would create single select {OPEN_LIST_FIELD!r} with options {OPEN_LIST_YES!r} / {OPEN_LIST_NO!r}")
            return
        payload = {
            "name": OPEN_LIST_FIELD,
            "type": "singleSelect",
            "description": "Yes when the latest Adversus campaign export still lists this lead as open. Read by the 'Databowl lead date IE' automation; maintained by tools/airtable_close_leads.py.",
            "options": {"choices": [{"name": OPEN_LIST_YES, "color": "greenLight2"}, {"name": OPEN_LIST_NO, "color": "redLight2"}]},
        }
        field = request_json(f"{API_ROOT}/meta/bases/{BASE_ID}/tables/{TABLE_ID}/fields", token, method="POST", payload=payload)
        print(f"created field {field['name']!r} ({field['id']})")
        print("paste this id into FIELD.ADVERSUS_OPEN_LIST in tools/airtable_automation_lead_status.js")

    choices = {c["name"].strip().lower(): c["name"] for c in field.get("options", {}).get("choices", [])}
    for label in (OPEN_LIST_YES, OPEN_LIST_NO):
        if label.lower() not in choices:
            die(f"field {OPEN_LIST_FIELD!r} has no {label!r} option; available: {sorted(choices.values())}")
    yes, no = choices[OPEN_LIST_YES.lower()], choices[OPEN_LIST_NO.lower()]

    rows = []
    for path in paths:
        export_rows, has_id = read_export(path)
        print(f"read {len(export_rows):>5} rows from {path} ({'with lead ids' if has_id else 'no lead ids'})")
        rows.extend(export_rows)

    records = fetch_records(token)
    print(f"read {len(records):>5} records from Airtable")
    index = build_index(records)

    keep, unresolved = set(), []
    for row in rows:
        accepted, _ = resolve_row(row, index)
        if accepted:
            keep.update(entry["record"]["id"] for entry in accepted)
        else:
            unresolved.append(row)

    rate = (len(rows) - len(unresolved)) / len(rows) if rows else 0
    updates = []
    for record in records:
        wanted = yes if record["id"] in keep else no
        if (record["fields"].get(OPEN_LIST_FIELD) or "") != wanted:
            updates.append({"id": record["id"], "fields": {OPEN_LIST_FIELD: wanted}, "_previous": record["fields"].get(OPEN_LIST_FIELD)})

    summarise(
        f"Marking {OPEN_LIST_FIELD!r}",
        [
            ("Rows in the open list", len(rows)),
            ("Rows resolved to a record", f"{len(rows) - len(unresolved)} ({rate:.1%})"),
            ("Rows that resolved to nothing", len(unresolved)),
            (f"Records to mark {OPEN_LIST_YES!r}", len(keep)),
            (f"Records to mark {OPEN_LIST_NO!r}", len(records) - len(keep)),
            ("Records needing a change", len(updates)),
        ],
    )

    if rate < 0.95:
        die(f"only {rate:.1%} of the open list resolved to a record; refusing to mark on a list this unreliable")
    if not updates:
        print("nothing to change")
        return
    if not apply_changes:
        print(f"dry run - pass --apply to write {OPEN_LIST_FIELD!r} on {len(updates)} record(s)")
        return

    os.makedirs(out_dir, exist_ok=True)
    rollback_path = os.path.join(out_dir, "rollback_open_list.json")
    with open(rollback_path, "w", encoding="utf-8") as handle:
        json.dump({"base": BASE_ID, "table": TABLE_ID, "field": OPEN_LIST_FIELD,
                   "records": [{"id": u["id"], "previous": u["_previous"]} for u in updates]}, handle, indent=2)
    print(f"rollback file written to {rollback_path}")

    patch_records(token, [{"id": u["id"], "fields": u["fields"]} for u in updates])
    verify = {r["id"]: (r["fields"].get(OPEN_LIST_FIELD) or "") for r in fetch_records(token)}
    wrong = [u for u in updates if verify.get(u["id"]) != u["fields"][OPEN_LIST_FIELD]]
    print(f"verified {len(updates) - len(wrong)}/{len(updates)} record(s) hold the intended value")
    if wrong:
        die(f"{len(wrong)} record(s) did not stick - something else is writing this field too")


def run_sync_status_from_open_list(token, apply_changes, out_dir, open_value, closed_value):
    """Bring Lead open/closed into line with In Adversus Open List.

    Preferred over --reconcile-open once the field is populated: the field is the
    live source of truth, including any corrections made by hand in Airtable,
    whereas an export file is only a snapshot of the moment it was taken.

    Records with a blank field are left alone, because the automation falls back
    to the Adversus outcome for those and this should not second-guess it.
    """
    records = fetch_records(token)
    print(f"read {len(records):>5} records from Airtable")

    updates, blank = [], 0
    for record in records:
        marker = (record["fields"].get(OPEN_LIST_FIELD) or "").strip().lower()
        if marker == OPEN_LIST_YES.lower():
            wanted = open_value
        elif marker == OPEN_LIST_NO.lower():
            wanted = closed_value
        else:
            blank += 1
            continue
        current = (record["fields"].get(STATUS_FIELD) or "").strip()
        if current != wanted.strip():
            updates.append({"id": record["id"], "fields": {STATUS_FIELD: wanted}, "_previous": record["fields"].get(STATUS_FIELD)})

    marked = collections_counter(records)
    summarise(
        f"Syncing {STATUS_FIELD!r} from {OPEN_LIST_FIELD!r}",
        [
            ("Records read", len(records)),
            *[(f"  marked {k!r}", v) for k, v in sorted(marked.items())],
            ("Blank, left to the automation", blank),
            ("Records needing a status change", len(updates)),
        ],
    )
    if not updates:
        print("nothing to change")
        return
    if not apply_changes:
        print(f"dry run - pass --apply to update {len(updates)} record(s)")
        return

    os.makedirs(out_dir, exist_ok=True)
    rollback_path = os.path.join(out_dir, "rollback_status_sync.json")
    with open(rollback_path, "w", encoding="utf-8") as handle:
        json.dump({"base": BASE_ID, "table": TABLE_ID, "field": STATUS_FIELD,
                   "records": [{"id": u["id"], "previous": u["_previous"]} for u in updates]}, handle, indent=2)
    print(f"rollback file written to {rollback_path}")

    patch_records(token, [{"id": u["id"], "fields": u["fields"]} for u in updates])
    verify = {r["id"]: (r["fields"].get(STATUS_FIELD) or "").strip() for r in fetch_records(token)}
    wrong = [u for u in updates if verify.get(u["id"]) != u["fields"][STATUS_FIELD].strip()]
    print(f"verified {len(updates) - len(wrong)}/{len(updates)} record(s) hold the intended status")
    if wrong:
        die(f"{len(wrong)} record(s) did not stick - an automation is still overwriting {STATUS_FIELD!r}")


def collections_counter(records):
    counts = Counter()
    for record in records:
        counts[(record["fields"].get(OPEN_LIST_FIELD) or "blank")] += 1
    return counts


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
    parser.add_argument(
        "--reconcile-open",
        action="store_true",
        help="treat the export(s) as the definitive list of open leads and close everything else",
    )
    parser.add_argument(
        "--mark-open-list",
        action="store_true",
        help=f"record in {OPEN_LIST_FIELD!r} whether each lead is on the open list, for the automation to read",
    )
    parser.add_argument("--create-open-list-field", action="store_true", help=f"create {OPEN_LIST_FIELD!r} if it is missing")
    parser.add_argument(
        "--sync-status-from-open-list",
        action="store_true",
        help=f"set {STATUS_FIELD!r} from {OPEN_LIST_FIELD!r}, honouring edits made in Airtable",
    )
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
    if args.sync_status_from_open_list:
        closed_value, open_value, choices = resolve_status_choice(token)
        print(f"field {STATUS_FIELD!r} options: {choices}\n")
        run_sync_status_from_open_list(token, args.apply, args.out, open_value, closed_value)
        return
    if not args.exports:
        die("give at least one CSV export, or use --rollback or --sync-auto-formula")

    if args.mark_open_list:
        run_mark_open_list(token, args.exports, args.apply, args.out, args.create_open_list_field)
        return

    closed_value, open_value, choices = resolve_status_choice(token)
    if args.reconcile_open:
        print(f"field {STATUS_FIELD!r} options: {choices}\n")
        run_reconcile_open(token, args.exports, args.apply, args.out, open_value, closed_value)
        return

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
