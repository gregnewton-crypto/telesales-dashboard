#!/usr/bin/env python3
"""Second-pass analysis of the IE telesales data.

The first pass (ie_metric_validation.py) answers "can we compute this?".
This one answers "is the number honest?" — it reworks the naive cuts that look
compelling but are biased, and pins down the data gaps that would otherwise be
read as performance changes on the dashboard.

Usage: python3 tools/ie_data_profile.py && python3 tools/ie_deep_insights.py
"""

import json
import re
import statistics
from collections import Counter, defaultdict
from datetime import datetime

RAW = "/tmp/ie_raw.json"
OUTCOME = "Adversus Lead Status (single select)"

AGENT_ALIASES = {
    "holly mcdonagh": "Holly McDonagh",
    "holly mc donagh": "Holly McDonagh",
    "saoirse oflaherty": "Saoirse O'Flaherty",
    "saoirse o'flaherty": "Saoirse O'Flaherty",
    "megan o'neill": "Megan O'Neill",
    "megan oneil": "Megan O'Neill",
    "megan oneill": "Megan O'Neill",
}
NON_AGENTS = {"Adversus Support - ndn", "Greg Newton"}
CONNECT_THRESHOLD = 20  # seconds; see part 2 for why


def norm_agent(name):
    if not name:
        return None
    key = re.sub(r"\s+", " ", name.strip()).lower()
    return AGENT_ALIASES.get(key, re.sub(r"\s+", " ", name.strip()))


def h(title):
    print(f"\n{'=' * 78}\n{title}\n{'=' * 78}")


def pct(a, b):
    return f"{100 * a / b:.1f}%" if b else "n/a"


def parse_ts(val):
    if not val:
        return None
    try:
        return datetime.fromisoformat(val.replace(" ", "T").replace("Z", "+00:00"))
    except ValueError:
        return None


def load():
    with open(RAW) as fh:
        data = json.load(fh)
    return [r["fields"] for r in data["leads"]], [r["fields"] for r in data["calls"]]


def main():
    leads, calls = load()

    # ── A. Unbiased attempt economics ───────────────────────────────────────
    h("A. MARGINAL VALUE OF EACH ATTEMPT (survivorship-corrected)")
    print("  The naive 'CVR by total attempts' cut is biased: a lead that converts")
    print("  stops being dialled, so converters pile up in the low-attempt buckets.")
    print("  The honest question is: of the leads that actually received call N,")
    print("  what share converted ON call N?\n")

    reached = Counter()   # leads that received a call numbered N
    won_on = Counter()    # of those, converted on that call
    conn_on = Counter()   # of those, the call connected
    for c in calls:
        n = c.get("Call # for Lead")
        if not n:
            continue
        reached[n] += 1
        if c.get("Lead Status") == "Success":
            won_on[n] += 1
        if (c.get("Call Duration") or 0) > CONNECT_THRESHOLD:
            conn_on[n] += 1

    print(f"  {'call #':>7}{'dials':>8}{'connects':>10}{'connect%':>10}"
          f"{'sales':>7}{'sales/100 dials':>17}{'sales/100 connects':>20}")
    for n in sorted(reached):
        if reached[n] < 20:
            continue
        print(
            f"  {n:>7}{reached[n]:>8}{conn_on[n]:>10}{100 * conn_on[n] / reached[n]:>9.1f}%"
            f"{won_on[n]:>7}{100 * won_on[n] / reached[n]:>17.2f}"
            f"{(100 * won_on[n] / conn_on[n]) if conn_on[n] else 0:>20.2f}"
        )

    total_dials = sum(reached.values())
    total_wins = sum(won_on.values())
    for cutoff in (3, 4, 5):
        dials_beyond = sum(v for k, v in reached.items() if k > cutoff)
        wins_beyond = sum(v for k, v in won_on.items() if k > cutoff)
        print(
            f"\n  capping at {cutoff} attempts would drop {dials_beyond} dials "
            f"({pct(dials_beyond, total_dials)} of all dialling) "
            f"and forgo {wins_beyond} sales ({pct(wins_beyond, total_wins)})"
        )

    # ── B. Sanity-check the Success duration figure ─────────────────────────
    h("B. CALL DURATION BY OUTCOME — FULL DISTRIBUTION")
    by_status = defaultdict(list)
    for c in calls:
        d = c.get("Call Duration")
        if d is not None:
            by_status[c.get("Lead Status", "(blank)")].append(d)
    print(f"  {'status':<20}{'n':>6}{'p10':>7}{'p25':>7}{'median':>8}{'p75':>7}{'p90':>7}{'mean':>8}")
    for status, ds in sorted(by_status.items(), key=lambda kv: -len(kv[1])):
        ds.sort()

        def q(p):
            return ds[min(len(ds) - 1, int(p * len(ds)))]

        print(f"  {status:<20}{len(ds):>6}{q(.1):>7}{q(.25):>7}"
              f"{statistics.median(ds):>8.0f}{q(.75):>7}{q(.90):>7}{statistics.mean(ds):>8.0f}")

    exact20 = sum(1 for c in calls if c.get("Call Duration") == 20)
    print(f"\n  calls lasting exactly 20s: {exact20} "
          f"({pct(exact20, len(calls))} of all calls) -> the dialler's ring timeout,")
    print(f"  which is why >{CONNECT_THRESHOLD}s is a defensible 'connected' cut.")

    short_wins = [c for c in calls
                  if c.get("Lead Status") == "Success"
                  and (c.get("Call Duration") or 0) <= CONNECT_THRESHOLD]
    print(f"\n  'Success' calls that never really connected (<={CONNECT_THRESHOLD}s): "
          f"{len(short_wins)} of {len(by_status.get('Success', []))}")
    print("  -> the outcome is stamped on the lead's last dial, not the dial that sold it.")

    # ── C. Data completeness by week ────────────────────────────────────────
    h("C. CALL EXPORT COMPLETENESS — MISSING WEEKS")
    lead_wk = Counter(l.get("⚙️ Lead Week") for l in leads if l.get("⚙️ Lead Week"))
    call_wk = Counter(c.get("⚙️ Call Week (formula)") for c in calls
                      if c.get("⚙️ Call Week (formula)"))
    weeks = sorted({int(w[1:]) for w in list(lead_wk) + list(call_wk)})
    print(f"  {'week':>6}{'leads in':>10}{'calls made':>12}   flag")
    for w in range(min(weeks), max(weeks) + 1):
        key = f"W{w}"
        li, ci = lead_wk.get(key, 0), call_wk.get(key, 0)
        flag = ""
        if li > 100 and ci == 0:
            flag = "<-- LEADS BUT NO CALLS: export gap"
        elif li == 0 and ci == 0:
            flag = "(no data either side)"
        print(f"  {key:>6}{li:>10}{ci:>12}   {flag}")

    # ── D. Cohort maturity ──────────────────────────────────────────────────
    h("D. COHORT MATURITY — HOW LONG BEFORE A LEAD WEEK IS FINISHED?")
    print("  A lead can convert weeks after it arrives, so recent weeks always look")
    print("  worse than they are. This curve says how long to wait before judging.\n")
    lead_date = {}
    for l in leads:
        lid, ld = l.get("Databowl Lead ID"), parse_ts(l.get("Lead Date"))
        if lid is not None and ld:
            lead_date[lid] = ld.date()
    lags = []
    for c in calls:
        if c.get("Lead Status") != "Success":
            continue
        lid = c.get("Databowl LeadId")
        sale = parse_ts(c.get("Start of Call") or c.get("Session Start (No Offset)"))
        if lid in lead_date and sale:
            lags.append((sale.date() - lead_date[lid]).days)
    lags = [x for x in lags if x >= 0]
    lags.sort()
    print(f"  {'by day':>8}{'sales':>8}{'cumulative % of cohort sales':>32}")
    for day in (0, 1, 3, 7, 14, 21, 28, 45, 60):
        n = sum(1 for x in lags if x <= day)
        print(f"  {day:>8}{n:>8}{pct(n, len(lags)):>32}")
    print(f"\n  -> a lead week is only ~{pct(sum(1 for x in lags if x <= 28), len(lags))} "
          f"complete after 28 days.")
    print("  -> the dashboard must grey out or flag immature weeks.")

    # ── E. Split dialling skill from selling skill ──────────────────────────
    h("E. AGENT: REACHING PEOPLE vs CONVERTING THEM")
    print("  Two different jobs. An agent can look weak on sales-per-dial simply")
    print("  because they are dialling dead lists, so split the funnel in two.\n")
    ag = defaultdict(lambda: {"dials": 0, "conn": 0, "wins": 0, "talk": 0, "days": set()})
    for c in calls:
        a = norm_agent(c.get("Agent Name"))
        if not a or a in NON_AGENTS:
            continue
        s = ag[a]
        s["dials"] += 1
        s["talk"] += c.get("Call Duration") or 0
        if (c.get("Call Duration") or 0) > CONNECT_THRESHOLD:
            s["conn"] += 1
        if c.get("Lead Status") == "Success":
            s["wins"] += 1
        if c.get("Date"):
            s["days"].add(c["Date"])

    print(f"  {'agent':<20}{'dials':>7}{'connect%':>10}{'close% of connects':>20}"
          f"{'sales/100 dials':>17}{'avg talk/connect':>18}")
    for a, s in sorted(ag.items(), key=lambda kv: -kv[1]["dials"]):
        close = 100 * s["wins"] / s["conn"] if s["conn"] else 0
        avg_talk = s["talk"] / s["conn"] if s["conn"] else 0
        print(
            f"  {a:<20}{s['dials']:>7}{100 * s['conn'] / s['dials']:>9.1f}%"
            f"{close:>19.1f}%{100 * s['wins'] / s['dials']:>17.2f}"
            f"{avg_talk / 60:>16.1f}m"
        )

    # ── F. Hour of day, separating answer rate from close rate ──────────────
    h("F. BEST HOUR TO DIAL — ANSWER RATE vs CLOSE RATE")
    hour = defaultdict(lambda: {"dials": 0, "conn": 0, "wins": 0})
    for c in calls:
        dt = parse_ts(c.get("Session Start (No Offset)") or c.get("Start of Call"))
        if not dt:
            continue
        s = hour[dt.hour]
        s["dials"] += 1
        if (c.get("Call Duration") or 0) > CONNECT_THRESHOLD:
            s["conn"] += 1
        if c.get("Lead Status") == "Success":
            s["wins"] += 1
    print(f"  {'hour':>5}{'dials':>8}{'connect%':>10}{'close% of connects':>20}"
          f"{'sales/100 dials':>17}{'share of dials':>16}")
    tot = sum(s["dials"] for s in hour.values())
    for hr in sorted(hour):
        s = hour[hr]
        if s["dials"] < 50:
            continue
        close = 100 * s["wins"] / s["conn"] if s["conn"] else 0
        print(
            f"  {hr:>5}{s['dials']:>8}{100 * s['conn'] / s['dials']:>9.1f}%"
            f"{close:>19.1f}%{100 * s['wins'] / s['dials']:>17.2f}"
            f"{pct(s['dials'], tot):>16}"
        )

    # ── G. Where the dialling effort actually goes ──────────────────────────
    h("G. EFFORT ALLOCATION — DIALS vs SALES BY ATTEMPT BAND")
    bands = [(1, 1), (2, 2), (3, 3), (4, 5), (6, 99)]
    print(f"  {'attempt band':<14}{'dials':>8}{'% of dials':>12}{'sales':>7}{'% of sales':>12}"
          f"{'sales/100 dials':>17}")
    for lo, hi in bands:
        d = sum(v for k, v in reached.items() if lo <= k <= hi)
        w = sum(v for k, v in won_on.items() if lo <= k <= hi)
        label = f"{lo}" if lo == hi else f"{lo}-{hi}" if hi < 99 else f"{lo}+"
        print(f"  {label:<14}{d:>8}{pct(d, total_dials):>12}{w:>7}{pct(w, total_wins):>12}"
              f"{100 * w / d if d else 0:>17.2f}")

    # ── H. Callback discipline ──────────────────────────────────────────────
    h("H. CALLBACK BOOK — IS IT BEING WORKED?")
    cb_states = ("Private callback", "VIP callback", "Shared callback")
    cb_leads = [l for l in leads if l.get(OUTCOME) in cb_states]
    print(f"  leads currently parked on a callback: {len(cb_leads)}")
    stale = 0
    today = max((parse_ts(c.get("Session Start (No Offset)")) for c in calls
                 if parse_ts(c.get("Session Start (No Offset)"))), default=None)
    if today:
        for l in cb_leads:
            last = l.get("Date of Latest")
            try:
                d = datetime.strptime(last, "%m/%d/%Y")
            except (TypeError, ValueError):
                continue
            if (today.replace(tzinfo=None) - d).days > 7:
                stale += 1
        print(f"  of those, not touched in over 7 days: {stale} ({pct(stale, len(cb_leads))})")
    cb_win = sum(1 for l in leads
                 if l.get(OUTCOME) == "Success"
                 and any(c.get("Lead Status") in cb_states
                         for c in calls
                         if c.get("Databowl LeadId") == l.get("Databowl Lead ID")))
    print(f"  sales that passed through a callback state at some point: {cb_win}")

    # ── I. Contact-rate ceiling per lead ────────────────────────────────────
    h("I. LEADS NEVER REACHED AT ALL")
    per_lead_max_dur = defaultdict(int)
    per_lead_dials = Counter()
    for c in calls:
        lid = c.get("Databowl LeadId")
        if lid is None:
            continue
        per_lead_dials[lid] += 1
        per_lead_max_dur[lid] = max(per_lead_max_dur[lid], c.get("Call Duration") or 0)
    never_reached = [lid for lid, d in per_lead_max_dur.items() if d <= CONNECT_THRESHOLD]
    print(f"  leads dialled at least once:               {len(per_lead_dials)}")
    print(f"  leads never once connected (>{CONNECT_THRESHOLD}s):        {len(never_reached)} "
          f"({pct(len(never_reached), len(per_lead_dials))})")
    wasted = sum(per_lead_dials[lid] for lid in never_reached)
    print(f"  dials spent on those never-reached leads:  {wasted} "
          f"({pct(wasted, sum(per_lead_dials.values()))} of all dialling)")
    burn = Counter(per_lead_dials[lid] for lid in never_reached)
    print(f"\n  {'dials before giving up':>24}{'leads':>8}")
    for n in sorted(burn):
        print(f"  {n:>24}{burn[n]:>8}")


if __name__ == "__main__":
    main()
