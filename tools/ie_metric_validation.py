#!/usr/bin/env python3
"""Validate candidate dashboard metrics against the real IE telesales data.

Reads the raw dump produced by ie_data_profile.py (/tmp/ie_raw.json) and works
out, for every metric the proposed dashboard wants to show, whether the base can
actually produce it and what the current value looks like. Anything that cannot
be computed is reported as a gap rather than silently skipped.

Usage: python3 tools/ie_data_profile.py && python3 tools/ie_metric_validation.py
"""

import json
import re
import statistics
from collections import Counter, defaultdict
from datetime import datetime

RAW = "/tmp/ie_raw.json"

# The same person is spelled several ways across Adversus exports. Every
# per-agent metric is wrong until these are folded together.
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


def norm_agent(name):
    if not name:
        return None
    key = re.sub(r"\s+", " ", name.strip()).lower()
    return AGENT_ALIASES.get(key, re.sub(r"\s+", " ", name.strip()))


def h(title):
    print(f"\n{'=' * 78}\n{title}\n{'=' * 78}")


def pct(a, b):
    return f"{100 * a / b:.1f}%" if b else "n/a"


def load():
    with open(RAW) as fh:
        data = json.load(fh)
    leads = [r["fields"] for r in data["leads"]]
    calls = [r["fields"] for r in data["calls"]]
    return leads, calls


def parse_ts(val):
    if not val:
        return None
    try:
        return datetime.fromisoformat(val.replace("Z", "+00:00"))
    except ValueError:
        return None


def main():
    leads, calls = load()

    # ── 1. Agent name normalisation impact ──────────────────────────────────
    h("1. AGENT NAME NORMALISATION")
    raw_agents = Counter(c.get("Agent Name") for c in calls)
    norm_agents = Counter(norm_agent(c.get("Agent Name")) for c in calls)
    print(f"  raw distinct agent names:        {len(raw_agents)}")
    print(f"  after normalisation:             {len(norm_agents)}")
    for name, n in norm_agents.most_common():
        merged = [r for r in raw_agents if norm_agent(r) == name]
        note = f"   <- merged from {merged}" if len(merged) > 1 else ""
        print(f"    {n:>6}  {name}{note}")

    # ── 2. What counts as a connected call ──────────────────────────────────
    h("2. CALL DURATION vs OUTCOME (defining 'connected')")
    by_status = defaultdict(list)
    for c in calls:
        d = c.get("Call Duration")
        if d is not None:
            by_status[c.get("Lead Status", "(blank)")].append(d)
    print(f"  {'status':<22}{'n':>7}{'median':>9}{'mean':>9}{'%<=20s':>9}{'%>60s':>9}")
    for status, ds in sorted(by_status.items(), key=lambda kv: -len(kv[1])):
        short = sum(1 for d in ds if d <= 20)
        long = sum(1 for d in ds if d > 60)
        print(
            f"  {status:<22}{len(ds):>7}{statistics.median(ds):>9.0f}"
            f"{statistics.mean(ds):>9.0f}{pct(short, len(ds)):>9}{pct(long, len(ds)):>9}"
        )

    buckets = [(0, 0), (1, 20), (21, 60), (61, 180), (181, 600), (601, 10 ** 9)]
    print("\n  duration buckets across all calls:")
    durs = [c.get("Call Duration") for c in calls if c.get("Call Duration") is not None]
    for lo, hi in buckets:
        n = sum(1 for d in durs if lo <= d <= hi)
        label = f"{lo}-{hi}s" if hi < 10 ** 9 else f"{lo}s+"
        print(f"    {label:<12}{n:>7}  {pct(n, len(durs)):>7}")
    print(f"    (missing duration: {len(calls) - len(durs)})")

    # ── 3. Top-line funnel ──────────────────────────────────────────────────
    h("3. TOP-LINE FUNNEL")
    total_leads = len(leads)
    called = sum(1 for l in leads if l.get("⚙️ Called?") == "Yes")
    outcome_field = "Adversus Lead Status (single select)"
    success = sum(1 for l in leads if l.get(outcome_field) == "Success")
    closed = sum(1 for l in leads if (l.get("Lead open/closed") or "").strip() == "Closed")

    contacted_ids = {
        c.get("Databowl LeadId")
        for c in calls
        if (c.get("Call Duration") or 0) > 20
    }
    contacted_ids.discard(None)
    lead_ids = {l.get("Databowl Lead ID") for l in leads}
    contacted = len(contacted_ids & lead_ids)

    print(f"  leads loaded            {total_leads:>7}")
    print(f"  leads called            {called:>7}  {pct(called, total_leads)} of loaded")
    print(f"  leads contacted (>20s)  {contacted:>7}  {pct(contacted, total_leads)} of loaded")
    print(f"  sales (Success)         {success:>7}  {pct(success, total_leads)} of loaded")
    print(f"                                   {pct(success, called)} of called")
    print(f"                                   {pct(success, contacted)} of contacted")
    print(f"  leads closed            {closed:>7}  {pct(closed, total_leads)}")

    # Disagreement between the two outcome fields
    h("3b. THE TWO OUTCOME FIELDS DISAGREE")
    a = Counter(l.get("Adversus Lead Status") for l in leads)
    b = Counter(l.get(outcome_field) for l in leads)
    disagree = sum(
        1 for l in leads if l.get("Adversus Lead Status") != l.get(outcome_field)
    )
    print(f"  rows where the two fields differ: {disagree} ({pct(disagree, total_leads)})")
    print(f"  {'value':<22}{'text field':>12}{'single select':>15}")
    for k in sorted(set(a) | set(b), key=lambda x: -(a.get(x, 0) + b.get(x, 0))):
        print(f"  {str(k):<22}{a.get(k, 0):>12}{b.get(k, 0):>15}")

    # ── 4. Conversion by attempt number ─────────────────────────────────────
    h("4. CONVERSION BY NUMBER OF ATTEMPTS (does chasing pay?)")
    by_attempts = defaultdict(lambda: [0, 0])
    for l in leads:
        n = l.get("Times Lead has been Called")
        if n is None:
            continue
        by_attempts[n][0] += 1
        if l.get(outcome_field) == "Success":
            by_attempts[n][1] += 1
    print(f"  {'attempts':>9}{'leads':>8}{'sales':>7}{'CVR':>9}")
    for n in sorted(by_attempts):
        tot, won = by_attempts[n]
        print(f"  {n:>9}{tot:>8}{won:>7}{pct(won, tot):>9}")

    h("4b. WHICH ATTEMPT NUMBER LANDS THE SALE")
    win_attempt = Counter()
    for c in calls:
        if c.get("Lead Status") == "Success" and c.get("Call # for Lead"):
            win_attempt[c["Call # for Lead"]] += 1
    tot_wins = sum(win_attempt.values())
    cum = 0
    print(f"  {'call #':>7}{'sales':>7}{'share':>9}{'cumulative':>12}")
    for n in sorted(win_attempt):
        cum += win_attempt[n]
        print(f"  {n:>7}{win_attempt[n]:>7}{pct(win_attempt[n], tot_wins):>9}{pct(cum, tot_wins):>12}")

    # ── 5. Speed to lead ────────────────────────────────────────────────────
    h("5. SPEED TO LEAD: DAYS TO FIRST CALL vs CONVERSION")
    bands = [(0, 0, "same day"), (1, 1, "1 day"), (2, 3, "2-3 days"),
             (4, 7, "4-7 days"), (8, 14, "8-14 days"), (15, 9999, "15+ days")]
    print(f"  {'band':<12}{'leads':>8}{'sales':>7}{'CVR':>9}")
    for lo, hi, label in bands:
        sel = [l for l in leads if isinstance(l.get("⚙️ Days to First Call"), int)
               and lo <= l["⚙️ Days to First Call"] <= hi]
        won = sum(1 for l in sel if l.get(outcome_field) == "Success")
        print(f"  {label:<12}{len(sel):>8}{won:>7}{pct(won, len(sel)):>9}")

    # ── 6. Hour of day ──────────────────────────────────────────────────────
    h("6. CALLS AND SALES BY HOUR OF DAY (local Dublin clock)")
    hour_calls, hour_wins, hour_talk = Counter(), Counter(), defaultdict(list)
    for c in calls:
        ts = c.get("Session Start (No Offset)") or c.get("Start of Call")
        dt = parse_ts(ts.replace(" ", "T")) if ts else None
        if not dt:
            continue
        hour_calls[dt.hour] += 1
        if c.get("Lead Status") == "Success":
            hour_wins[dt.hour] += 1
        if c.get("Call Duration") is not None:
            hour_talk[dt.hour].append(c["Call Duration"])
    print(f"  {'hour':>5}{'calls':>8}{'sales':>7}{'sales/100 calls':>17}{'median dur':>12}")
    for hr in sorted(hour_calls):
        med = statistics.median(hour_talk[hr]) if hour_talk[hr] else 0
        rate = 100 * hour_wins[hr] / hour_calls[hr]
        print(f"  {hr:>5}{hour_calls[hr]:>8}{hour_wins[hr]:>7}{rate:>17.2f}{med:>12.0f}")

    # ── 7. Day of week ──────────────────────────────────────────────────────
    h("7. CALLS AND SALES BY DAY OF WEEK")
    order = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    dow_calls, dow_wins = Counter(), Counter()
    for c in calls:
        d = c.get("Day for the week")
        if d:
            dow_calls[d] += 1
            if c.get("Lead Status") == "Success":
                dow_wins[d] += 1
    print(f"  {'day':<11}{'calls':>8}{'sales':>7}{'sales/100 calls':>17}")
    for d in order:
        if dow_calls[d]:
            print(f"  {d:<11}{dow_calls[d]:>8}{dow_wins[d]:>7}{100 * dow_wins[d] / dow_calls[d]:>17.2f}")

    # ── 8. Agent leaderboard ────────────────────────────────────────────────
    h("8. AGENT LEADERBOARD (normalised names, real agents only)")
    ag = defaultdict(lambda: {"calls": 0, "talk": 0, "wins": 0, "conn": 0, "days": set()})
    for c in calls:
        a = norm_agent(c.get("Agent Name"))
        if not a or a in NON_AGENTS:
            continue
        s = ag[a]
        s["calls"] += 1
        s["talk"] += c.get("Call Duration") or 0
        if (c.get("Call Duration") or 0) > 20:
            s["conn"] += 1
        if c.get("Lead Status") == "Success":
            s["wins"] += 1
        if c.get("Date"):
            s["days"].add(c["Date"])
    print(f"  {'agent':<22}{'calls':>7}{'days':>6}{'calls/day':>11}{'conn%':>8}"
          f"{'talk hrs':>10}{'sales':>7}{'sales/100':>11}")
    for a, s in sorted(ag.items(), key=lambda kv: -kv[1]["calls"]):
        d = len(s["days"]) or 1
        print(
            f"  {a:<22}{s['calls']:>7}{len(s['days']):>6}{s['calls'] / d:>11.1f}"
            f"{100 * s['conn'] / s['calls']:>8.1f}{s['talk'] / 3600:>10.1f}"
            f"{s['wins']:>7}{100 * s['wins'] / s['calls']:>11.2f}"
        )

    # ── 9. Segment conversion ───────────────────────────────────────────────
    h("9. CONVERSION BY DOG SEGMENT")
    for field in ("Dog Age", "Dog Weight"):
        print(f"\n  {field}:")
        seg = defaultdict(lambda: [0, 0])
        for l in leads:
            v = l.get(field)
            if not v:
                continue
            seg[v][0] += 1
            if l.get(outcome_field) == "Success":
                seg[v][1] += 1
        for v, (tot, won) in sorted(seg.items(), key=lambda kv: -kv[1][0]):
            print(f"    {v:<14}{tot:>7}{won:>7}{pct(won, tot):>9}")

    # ── 10. Weekly trend ────────────────────────────────────────────────────
    h("10. WEEKLY TREND (lead cohort basis)")
    wk = defaultdict(lambda: {"leads": 0, "wins": 0, "called": 0})
    for l in leads:
        w = l.get("⚙️ Lead Week")
        if not w:
            continue
        wk[w]["leads"] += 1
        if l.get("⚙️ Called?") == "Yes":
            wk[w]["called"] += 1
        if l.get(outcome_field) == "Success":
            wk[w]["wins"] += 1
    wk_calls = Counter(c.get("⚙️ Call Week (formula)") for c in calls)
    print(f"  {'week':>6}{'leads':>8}{'called':>8}{'sales':>7}{'CVR':>9}{'calls made':>12}")
    for w in sorted(wk, key=lambda x: int(x[1:])):
        s = wk[w]
        print(f"  {w:>6}{s['leads']:>8}{s['called']:>8}{s['wins']:>7}"
              f"{pct(s['wins'], s['leads']):>9}{wk_calls.get(w, 0):>12}")

    # ── 11. Time from lead to sale ──────────────────────────────────────────
    h("11. DAYS FROM LEAD CREATED TO SALE")
    lead_date = {}
    for l in leads:
        lid, ld = l.get("Databowl Lead ID"), parse_ts(l.get("Lead Date"))
        if lid is not None and ld:
            lead_date[lid] = ld
    lags = []
    for c in calls:
        if c.get("Lead Status") != "Success":
            continue
        lid = c.get("Databowl LeadId")
        sale = parse_ts((c.get("Start of Call") or "").replace(" ", "T"))
        if lid in lead_date and sale:
            lags.append((sale.date() - lead_date[lid].date()).days)
    if lags:
        lags.sort()
        print(f"  n={len(lags)}  median={statistics.median(lags):.0f}d  "
              f"mean={statistics.mean(lags):.1f}d  p90={lags[int(0.9 * len(lags)) - 1]}d")
        for lo, hi, label in bands:
            n = sum(1 for x in lags if lo <= x <= hi)
            print(f"    {label:<12}{n:>7}{pct(n, len(lags)):>9}")

    # ── 12. Open pipeline ───────────────────────────────────────────────────
    h("12. WORKABLE PIPELINE RIGHT NOW")
    open_leads = [l for l in leads if (l.get("Lead open/closed") or "").strip() == "Open"]
    in_list = [l for l in leads if l.get("In Adversus Open List") == "Yes"]
    never = [l for l in leads if l.get("⚙️ Called?") == "No"]
    print(f"  leads marked Open            {len(open_leads):>6}")
    print(f"  leads in the Adversus dialer {len(in_list):>6}")
    print(f"  leads never called at all    {len(never):>6}")
    callback = sum(
        1 for l in leads
        if l.get(outcome_field) in ("Private callback", "VIP callback", "Shared callback")
    )
    print(f"  leads sitting on a callback  {callback:>6}")
    redial = sum(1 for l in leads if l.get(outcome_field) == "Automatic redial")
    print(f"  leads on automatic redial    {redial:>6}")

    # ── 13. Loss reasons ────────────────────────────────────────────────────
    h("13. LOSS REASONS (Disposition) — coverage problem")
    disp = Counter(c.get("Disposition") for c in calls if c.get("Disposition"))
    lost = sum(1 for l in leads if l.get(outcome_field) in ("Not interested", "Unqualified"))
    print(f"  calls carrying a disposition: {len(list(disp.elements()))} of {len(calls)} "
          f"({pct(sum(disp.values()), len(calls))})")
    print(f"  leads lost to Not interested/Unqualified: {lost}")
    print(f"  -> disposition explains at most {pct(sum(disp.values()), lost)} of losses\n")
    for k, v in disp.most_common():
        print(f"    {v:>6}  {k}  ({pct(v, sum(disp.values()))})")

    # ── 14. Metrics the base CANNOT produce ─────────────────────────────────
    h("14. METRICS THE UK DASHBOARD SHOWS THAT IE DATA CANNOT PRODUCE")
    for gap in [
        "CPA / CPL / any cost metric      - no spend table in the base",
        "Actual vs Budget, variance, RAG  - no budget or target table",
        "Forecast vs actual               - no forecast table",
        "B2 retention, Box1/Box2, paused  - no order or subscription table",
        "Pause reasons                    - no retention table",
        "Avg discount                     - no order table",
        "SPH / CPH (per hour worked)      - no shift, rota or logged-hours data",
        "Occupancy / utilisation          - no logged-in time, only call timestamps",
        "Revenue / AOV                    - no monetary value on any record",
        "Channel split                    - Source has exactly one value",
        "Brand split                      - Butternut only",
    ]:
        print(f"  - {gap}")


if __name__ == "__main__":
    main()
