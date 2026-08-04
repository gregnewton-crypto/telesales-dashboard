#!/usr/bin/env python3
"""Audit the Marro D2MS export and compute the five retention tracker metrics.

The export fans each subscription out into several near-identical rows, so every
figure here is calculated on a de-duplicated table rather than the raw rows.

Usage:
    python3 tools/d2ms_retention_audit.py "Marro D2MS V3.csv" [--snapshot YYYY-MM-DD]
"""

import argparse
import csv
import re
import statistics
import sys
from collections import Counter, defaultdict
from datetime import date, timedelta

EARLY_WINDOW_DAYS = 7
MIN_COHORT_SIZE = 30
USER_ID_RE = re.compile(r"/users/(\d+)")

# Rep codes that refer to the same person under different spellings.
REP_ALIASES = {"D2MSJagodaaaa": "D2MSJagoda"}


def parse_date(value):
    value = (value or "").strip()
    if not value:
        return None
    try:
        year, month, day = value.split("-")
        return date(int(year), int(month), int(day))
    except ValueError:
        return None


def parse_int(value):
    value = (value or "").strip().replace(",", "")
    return int(value) if value else None


def parse_percent(value):
    """'100.00%' -> 1.0, '0.00%' -> 0.0, blank -> None (not yet eligible)."""
    value = (value or "").strip()
    if not value:
        return None
    try:
        return float(value.rstrip("%")) / 100.0
    except ValueError:
        return None


def canonical_rep(code):
    code = (code or "").strip()
    return REP_ALIASES.get(code, code)


def subscription_key(row):
    """Identify one subscription.

    The created date is part of the key so that a customer who resubscribes the
    same pet later counts as two sales rather than being merged into one.
    """
    match = USER_ID_RE.search(row.get("Admin User Link", "") or "")
    user_id = match.group(1) if match else (row.get("Email", "") or "").strip().lower()
    return (
        user_id,
        (row.get("Animal Name", "") or "").strip().lower(),
        (row.get("Subscription Created Date", "") or "").strip(),
    )


def load_raw(path):
    with open(path, newline="", encoding="utf-8-sig") as handle:
        return list(csv.DictReader(handle))


def deduplicate(raw_rows):
    """Collapse the export fan-out to one record per subscription.

    Identity and product fields are identical across a fan-out group, so the
    first row supplies them. The retention and interruption fields are only
    populated on one row of the group, so they are taken as first-non-blank.
    """
    groups = defaultdict(list)
    for row in raw_rows:
        groups[subscription_key(row)].append(row)

    records = []
    for (user_id, animal, _created), group in groups.items():
        base = group[0]

        def first_non_blank(column):
            for row in group:
                value = (row.get(column, "") or "").strip()
                if value:
                    return value
            return ""

        records.append(
            {
                "user_id": user_id,
                "animal": animal,
                "rep": canonical_rep(base["Acquisition Discount Code"]),
                "created": parse_date(base["Subscription Created Date"]),
                "pause": parse_date(base["First Pause Date"]),
                "pause_reason": first_non_blank("First Pause Reason"),
                "delivery_1": parse_date(base["Order 1 Delivery Date"]),
                "delivery_2": parse_date(base["Order 2 Delivery Date"]),
                "distinct_recipes": parse_int(base["Distinct Recipes"]),
                "trial_days": parse_int(base["Trial Box Duration In Days"]),
                "retention_14": parse_percent(first_non_blank("14 Day Retention")),
                "retention_28": parse_percent(first_non_blank("28 Day Retention")),
                "cohort_week": parse_date(base["Subscription Created Week"]),
                "fanout_rows": len(group),
            }
        )
    return records


def derive(record, snapshot):
    """Add the helper fields the tracker needs."""
    created, pause, delivery = record["created"], record["pause"], record["delivery_1"]
    record["days_to_pause"] = (pause - created).days if (pause and created) else None
    record["days_delivery_to_pause"] = (pause - delivery).days if (pause and delivery) else None
    record["paused_pre_delivery"] = bool(pause and delivery and pause < delivery)
    record["paused_never_delivered"] = bool(pause and not delivery)
    record["age_days"] = (snapshot - created).days if created else None
    record["is_mature"] = record["age_days"] is not None and record["age_days"] >= EARLY_WINDOW_DAYS
    record["is_early_pause"] = (
        record["days_to_pause"] is not None and 0 <= record["days_to_pause"] < EARLY_WINDOW_DAYS
    )
    return record


def pct(numerator, denominator):
    return f"{numerator / denominator * 100:.1f}%" if denominator else "n/a"


def section(title):
    print(f"\n{title}")
    print("-" * len(title))


def report_integrity(raw_rows, records):
    section("1. STRUCTURAL AUDIT")
    print(f"raw rows                      : {len(raw_rows):,}")
    print(f"subscriptions after de-dupe   : {len(records):,}")
    print(f"distinct customers            : {len({r['user_id'] for r in records}):,}")
    print(f"mean fan-out rows / sub       : {len(raw_rows) / len(records):.2f}")

    inflation = Counter(r["fanout_rows"] for r in records)
    print("fan-out group sizes           : " + ", ".join(
        f"{size} rows x{count}" for size, count in sorted(inflation.items())
    ))

    # 'Is Retained' is an exploded pivot dimension: it splits ~50/50 inside every
    # group, so counting it on raw rows always returns roughly half the file.
    retained = Counter((row["Is Retained (Yes / No)"] or "").strip() for row in raw_rows)
    total_flagged = sum(retained.values())
    print(
        "raw 'Is Retained' Yes share   : "
        f"{pct(retained.get('Yes', 0), total_flagged)}  <-- artefact of the fan-out, do not report"
    )

    aliased = sorted({r["rep"] for r in records})
    print(f"rep codes after aliasing      : {len(aliased)}")
    raw_codes = {(row["Acquisition Discount Code"] or "").strip() for row in raw_rows}
    print(f"rep codes before aliasing     : {len(raw_codes)}")

    section("2. FIELD COMPLETENESS (de-duplicated)")
    checks = [
        ("Subscription Created Date", lambda r: r["created"] is None),
        ("First Pause Date", lambda r: r["pause"] is None),
        ("Order 1 Delivery Date", lambda r: r["delivery_1"] is None),
        ("Order 2 Delivery Date", lambda r: r["delivery_2"] is None),
        ("Distinct Recipes", lambda r: r["distinct_recipes"] is None),
        ("14 Day Retention", lambda r: r["retention_14"] is None),
        ("28 Day Retention", lambda r: r["retention_28"] is None),
    ]
    for label, is_missing in checks:
        missing = sum(1 for r in records if is_missing(r))
        print(f"{label:28s} missing {missing:6,} ({pct(missing, len(records))})")


def report_metrics(records, snapshot):
    mature = [r for r in records if r["is_mature"]]
    paused = [r for r in records if r["pause"]]

    section("3. THE FIVE TRACKER METRICS")

    week_end = snapshot - timedelta(days=snapshot.isoweekday())
    week_start = week_end - timedelta(days=6)
    prior_end, prior_start = week_end - timedelta(days=7), week_start - timedelta(days=7)

    def early_pauses_in(start, end):
        return [r for r in paused if r["is_early_pause"] and start <= r["pause"] <= end]

    this_week = early_pauses_in(week_start, week_end)
    last_week = early_pauses_in(prior_start, prior_end)
    print(f"M1 Early pauses, week {week_start} to {week_end}: {len(this_week)}")
    print(f"   prior week ({prior_start} to {prior_end}): {len(last_week)}")
    by_rep = Counter(r["rep"] for r in this_week)
    all_pauses_by_rep = Counter(
        r["rep"] for r in paused if week_start <= r["pause"] <= week_end
    )
    print(f"   {'rep':<16}{'early':>7}{'all pauses':>12}")
    for rep, count in by_rep.most_common():
        print(f"   {rep.replace('D2MS', ''):<16}{count:>7}{all_pauses_by_rep[rep]:>12}")

    from_created = [r["days_to_pause"] for r in paused if r["days_to_pause"] is not None]
    from_delivery = [
        r["days_delivery_to_pause"] for r in paused if r["days_delivery_to_pause"] is not None
    ]
    print(
        f"\nM2 Days to first pause (from created)  : mean {statistics.mean(from_created):.1f}, "
        f"median {statistics.median(from_created):.0f}, n={len(from_created):,}"
    )
    print(
        f"   Days to first pause (from delivery) : mean {statistics.mean(from_delivery):.1f}, "
        f"median {statistics.median(from_delivery):.0f}, n={len(from_delivery):,}"
    )

    recipes = [r["distinct_recipes"] for r in records if r["distinct_recipes"] is not None]
    print(f"\nM3 Avg distinct recipes / subscription : {statistics.mean(recipes):.2f} (n={len(recipes):,})")
    single = sum(1 for value in recipes if value == 1)
    print(f"   single-recipe subscriptions         : {single:,} ({pct(single, len(recipes))})")

    pre_delivery = [r for r in records if r["paused_pre_delivery"]]
    never_delivered = [r for r in records if r["paused_never_delivered"]]
    print(f"\nM4 Pauses before first delivery        : {len(pre_delivery):,} ({pct(len(pre_delivery), len(records))} of sales)")
    print(f"   Paused with no delivery date at all : {len(never_delivered):,} (report separately)")
    for reason, count in Counter(r["pause_reason"] for r in pre_delivery).most_common(5):
        print(f"     {reason or '(blank)':<52}{count:>5}")

    early_mature = [r for r in mature if r["is_early_pause"]]
    print(f"\nM5 Early pause rate (< day {EARLY_WINDOW_DAYS})          : {pct(len(early_mature), len(mature))}")
    print(f"   numerator {len(early_mature):,} / denominator {len(mature):,} (both restricted to subs aged >= {EARLY_WINDOW_DAYS}d)")
    naive = sum(1 for r in records if r["is_early_pause"])
    print(f"   unfiltered version would report     : {pct(naive, len(records))} over {len(records):,} sales")


def report_breakdowns(records, snapshot):
    mature = [r for r in records if r["is_mature"]]
    paused = [r for r in records if r["pause"]]

    section("4. WEEKLY COHORT TREND (maturity-filtered)")
    print(f"   {'cohort week':<14}{'sales':>7}{'mature':>8}{'early':>7}{'rate':>8}   note")
    for week in sorted({r["cohort_week"] for r in records if r["cohort_week"]})[-12:]:
        cohort = [r for r in records if r["cohort_week"] == week]
        eligible = [r for r in cohort if r["is_mature"]]
        early = [r for r in eligible if r["is_early_pause"]]
        if len(eligible) < MIN_COHORT_SIZE:
            note = "suppressed: cohort not yet mature"
            rate = "-"
        else:
            note = "partial week" if len(eligible) < len(cohort) else ""
            rate = pct(len(early), len(eligible))
        print(f"   {str(week):<14}{len(cohort):>7}{len(eligible):>8}{len(early):>7}{rate:>8}   {note}")

    section("5. REP LEAGUE TABLE (mature cohort)")
    print(f"   {'rep':<14}{'sales':>7}{'early':>7}{'early%':>8}{'preDlv':>8}{'preDlv%':>9}{'recipes':>9}{'28d ret':>9}")
    by_rep = defaultdict(list)
    for record in mature:
        by_rep[record["rep"]].append(record)
    for rep, group in sorted(by_rep.items(), key=lambda item: -len(item[1])):
        early = sum(1 for r in group if r["is_early_pause"])
        pre = sum(1 for r in group if r["paused_pre_delivery"])
        recipes = [r["distinct_recipes"] for r in group if r["distinct_recipes"] is not None]
        ret28 = [r["retention_28"] for r in group if r["retention_28"] is not None]
        print(
            f"   {rep.replace('D2MS', ''):<14}{len(group):>7}{early:>7}{pct(early, len(group)):>8}"
            f"{pre:>8}{pct(pre, len(group)):>9}"
            f"{statistics.mean(recipes) if recipes else 0:>9.2f}"
            f"{(f'{statistics.mean(ret28) * 100:.1f}%' if ret28 else 'n/a'):>9}"
        )

    section("6. PAUSE REASON MIX")
    print(f"   {'reason':<52}{'all':>7}{'share':>8}{'early':>7}{'share':>8}")
    early = [r for r in paused if r["is_early_pause"]]
    all_reasons = Counter(r["pause_reason"] for r in paused)
    early_reasons = Counter(r["pause_reason"] for r in early)
    for reason, count in all_reasons.most_common():
        print(
            f"   {reason or '(blank)':<52}{count:>7}{pct(count, len(paused)):>8}"
            f"{early_reasons[reason]:>7}{pct(early_reasons[reason], len(early)):>8}"
        )

    section("7. DRIVER CUTS (mature cohort)")
    def cut(label, key_fn, values):
        print(f"   by {label}")
        for value in values:
            group = [r for r in mature if key_fn(r) == value]
            if len(group) < MIN_COHORT_SIZE:
                continue
            early = sum(1 for r in group if r["is_early_pause"])
            ret28 = [r["retention_28"] for r in group if r["retention_28"] is not None]
            print(
                f"     {label} = {value!s:<6} n={len(group):>6,}  early {pct(early, len(group)):>7}"
                f"  28d ret {(f'{statistics.mean(ret28) * 100:.1f}%' if ret28 else 'n/a'):>7}"
            )

    cut("distinct recipes", lambda r: r["distinct_recipes"], range(1, 8))
    cut("trial box days", lambda r: r["trial_days"], sorted({r["trial_days"] for r in mature if r["trial_days"]}))

    section("8. DAYS-TO-PAUSE DISTRIBUTION")
    buckets = [
        ("day 0", 0, 0), ("day 1-3", 1, 3), ("day 4-6", 4, 6), ("day 7-13", 7, 13),
        ("day 14-27", 14, 27), ("day 28-55", 28, 55), ("day 56+", 56, 10**6),
    ]
    values = [r["days_to_pause"] for r in paused if r["days_to_pause"] is not None]
    for label, low, high in buckets:
        count = sum(1 for value in values if low <= value <= high)
        print(f"   {label:<12}{count:>6,}{pct(count, len(values)):>8}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("csv_path", help="Path to the Marro D2MS export")
    parser.add_argument("--snapshot", help="Reporting snapshot date (default: latest date in file)")
    args = parser.parse_args()

    raw_rows = load_raw(args.csv_path)
    if not raw_rows:
        sys.exit("No rows found in export.")
    records = deduplicate(raw_rows)

    if args.snapshot:
        snapshot = parse_date(args.snapshot)
    else:
        candidates = [
            value
            for record in records
            for value in (record["created"], record["pause"], record["delivery_1"], record["delivery_2"])
            if value
        ]
        snapshot = max(candidates)

    for record in records:
        derive(record, snapshot)

    print("=" * 78)
    print(f"MARRO D2MS RETENTION & PAUSE AUDIT   snapshot = {snapshot}")
    print("=" * 78)
    report_integrity(raw_rows, records)
    report_metrics(records, snapshot)
    report_breakdowns(records, snapshot)


if __name__ == "__main__":
    main()
