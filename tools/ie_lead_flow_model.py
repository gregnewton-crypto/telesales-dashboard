#!/usr/bin/env python3
"""Work out how many fresh leads/day the IE dialler actually needs.

The previous scripts establish that performance decays as a lead is worked.
This one turns that decay into a supply figure: given agent capacity and a
sales target, how many NEW leads have to land each working day for the team to
hit target without falling back on exhausted list.

Two decays are separated deliberately, because they imply different fixes:
  - attempt decay   (dial 1 vs dial 5)   -> fixed by capping attempts
  - age decay       (day 0 vs day 30)    -> fixed by supply and speed-to-lead

Usage: python3 tools/ie_data_profile.py && python3 tools/ie_lead_flow_model.py
"""

import json
import re
import statistics
from collections import Counter, defaultdict
from datetime import datetime

RAW = "/tmp/ie_raw.json"
CONNECT_THRESHOLD = 20  # seconds; the dialler's ring timeout, see ie_deep_insights.py B
NON_AGENTS = {"Adversus Support - ndn", "Greg Newton"}
AGENT_ALIASES = {
    "holly mcdonagh": "Holly McDonagh",
    "holly mc donagh": "Holly McDonagh",
    "saoirse oflaherty": "Saoirse O'Flaherty",
    "saoirse o'flaherty": "Saoirse O'Flaherty",
    "megan o'neill": "Megan O'Neill",
    "megan oneil": "Megan O'Neill",
    "megan oneill": "Megan O'Neill",
}


def h(title):
    print(f"\n{'=' * 78}\n{title}\n{'=' * 78}")


def pct(a, b):
    return f"{100 * a / b:.1f}%" if b else "n/a"


def norm_agent(name):
    if not name:
        return None
    key = re.sub(r"\s+", " ", name.strip()).lower()
    return AGENT_ALIASES.get(key, re.sub(r"\s+", " ", name.strip()))


def parse_ts(val):
    if not val:
        return None
    try:
        return datetime.fromisoformat(str(val).replace(" ", "T").replace("Z", "+00:00"))
    except ValueError:
        return None


def load():
    with open(RAW) as fh:
        data = json.load(fh)
    return [r["fields"] for r in data["leads"]], [r["fields"] for r in data["calls"]]


def main():
    leads, calls = load()

    lead_date = {}
    for l in leads:
        lid = l.get("Databowl Lead ID")
        ld = parse_ts(l.get("Lead Date")) or parse_ts(l.get("Date"))
        if lid is not None and ld:
            lead_date[lid] = ld.replace(tzinfo=None).date()

    # Index calls by lead, ordered by attempt number.
    by_lead = defaultdict(list)
    for c in calls:
        lid = c.get("Databowl LeadId")
        n = c.get("Call # for Lead")
        if lid is None or not n:
            continue
        by_lead[lid].append(c)
    for v in by_lead.values():
        v.sort(key=lambda c: c["Call # for Lead"])

    # ── 1. Lead-level attempt economics ─────────────────────────────────────
    # Sales are deduplicated to the lead and attributed to the attempt on which
    # the first Success was stamped, so a lead can only ever be counted once.
    h("1. WHAT EACH ATTEMPT IS WORTH (lead-level, one sale counted once)")

    dials_at = Counter()      # dials placed as attempt n
    conn_at = Counter()       # of those, connected
    sale_at = Counter()       # leads first stamped Success on attempt n
    for lid, cs in by_lead.items():
        won = False
        for c in cs:
            n = c["Call # for Lead"]
            dials_at[n] += 1
            if (c.get("Call Duration") or 0) > CONNECT_THRESHOLD:
                conn_at[n] += 1
            if not won and c.get("Lead Status") == "Success":
                sale_at[n] += 1
                won = True

    base = dials_at[1] or 1
    print(f"  {'attempt':>8}{'dials':>8}{'connect%':>10}{'sales':>7}"
          f"{'sales/100 dials':>17}{'dials per sale':>16}{'survival':>10}")
    for n in sorted(dials_at):
        if dials_at[n] < 20:
            continue
        d, s = dials_at[n], sale_at[n]
        print(f"  {n:>8}{d:>8}{100 * conn_at[n] / d:>9.1f}%{s:>7}"
              f"{100 * s / d:>17.2f}{(d / s if s else float('inf')):>16.0f}"
              f"{pct(d, base):>10}")

    # ── 2. Age decay, held separate from attempt decay ──────────────────────
    h("2. AGE DECAY — CONNECT RATE BY HOW OLD THE LEAD WAS WHEN DIALLED")
    print("  Same attempt number, different lead age. If age matters independently")
    print("  of attempt count, supply (not just attempt caps) is the real lever.\n")

    age_bands = [(0, 0), (1, 1), (2, 3), (4, 7), (8, 14), (15, 30), (31, 60), (61, 999)]

    def band_of(days):
        for lo, hi in age_bands:
            if lo <= days <= hi:
                return (lo, hi)
        return None

    def label(b):
        lo, hi = b
        return f"{lo}" if lo == hi else (f"{lo}-{hi}" if hi < 999 else f"{lo}+")

    cell = defaultdict(lambda: {"d": 0, "c": 0, "s": 0})
    for lid, cs in by_lead.items():
        if lid not in lead_date:
            continue
        won = False
        for c in cs:
            dt = parse_ts(c.get("Start of Call") or c.get("Session Start (No Offset)"))
            if not dt:
                continue
            age = (dt.replace(tzinfo=None).date() - lead_date[lid]).days
            if age < 0:
                continue
            b = band_of(age)
            k = (min(c["Call # for Lead"], 4), b)
            cell[k]["d"] += 1
            if (c.get("Call Duration") or 0) > CONNECT_THRESHOLD:
                cell[k]["c"] += 1
            if not won and c.get("Lead Status") == "Success":
                cell[k]["s"] += 1
                won = True

    def grid(title, num_key, fmt):
        print(title)
        print(f"  {'attempt':>8}" + "".join(f"{label(b):>9}" for b in age_bands))
        for n in (1, 2, 3, 4):
            row = f"  {n:>8}"
            for b in age_bands:
                s = cell[(n, b)]
                val = fmt.format(100 * s[num_key] / s["d"]) if s["d"] >= 30 else "."
                row += f"{val:>9}"
            print(row)

    grid("  connect rate, rows = attempt no. (4 = 4th or later), cols = lead age in days",
         "c", "{:.0f}%")
    grid("\n  sales per 100 dials, same grid", "s", "{:.2f}")

    agg = defaultdict(lambda: {"d": 0, "c": 0, "s": 0})
    for (n, b), s in cell.items():
        for k in ("d", "c", "s"):
            agg[b][k] += s[k]
    print(f"\n  {'lead age':>10}{'dials':>8}{'% of dials':>12}{'connect%':>10}"
          f"{'sales':>7}{'sales/100 dials':>17}")
    tot_d = sum(s["d"] for s in agg.values())
    for b in age_bands:
        s = agg[b]
        if not s["d"]:
            continue
        print(f"  {label(b):>10}{s['d']:>8}{pct(s['d'], tot_d):>12}"
              f"{100 * s['c'] / s['d']:>9.1f}%{s['s']:>7}{100 * s['s'] / s['d']:>17.2f}")

    # ── 3. Capacity actually observed ───────────────────────────────────────
    h("3. AGENT CAPACITY — WHAT ONE AGENT-DAY REALLY PRODUCES")
    agent_day = defaultdict(lambda: {"d": 0, "c": 0, "talk": 0})
    for c in calls:
        a = norm_agent(c.get("Agent Name"))
        day = c.get("Date")
        if not a or a in NON_AGENTS or not day:
            continue
        s = agent_day[(a, day)]
        s["d"] += 1
        dur = c.get("Call Duration") or 0
        s["talk"] += dur
        if dur > CONNECT_THRESHOLD:
            s["c"] += 1

    busy = [s for s in agent_day.values() if s["d"] >= 10]
    dials = sorted(s["d"] for s in busy)
    conns = sorted(s["c"] for s in busy)
    talks = sorted(s["talk"] / 3600 for s in busy)

    def q(arr, p):
        return arr[min(len(arr) - 1, int(p * len(arr)))]

    print(f"  agent-days with 10+ dials: {len(busy)}")
    print(f"  {'metric':<22}{'p25':>8}{'median':>9}{'p75':>8}{'p90':>8}{'mean':>9}")
    for name, arr, fmt in (("dials per agent-day", dials, "{:.0f}"),
                           ("connects per agent-day", conns, "{:.0f}"),
                           ("talk hours per day", talks, "{:.1f}")):
        print(f"  {name:<22}" + "".join(
            f"{fmt.format(v):>8}" if i < 4 else f"{fmt.format(v):>9}"
            for i, v in enumerate([q(arr, .25), q(arr, .5), q(arr, .75), q(arr, .9)])
        ) + f"{fmt.format(statistics.mean(arr)):>9}")

    cap_dials = statistics.median(dials)
    print(f"\n  -> planning figure: {cap_dials:.0f} dials per agent-day (median of real days)")

    # ── 4. Current supply vs current burn ───────────────────────────────────
    # Restricted to days the dialler actually ran: the call export has whole
    # missing weeks (see ie_deep_insights.py C) which would otherwise read as
    # quiet days and drag every per-day average down.
    h("4. SUPPLY vs BURN — ARE WE ALREADY UNDERFED?")
    lead_by_day = Counter(lead_date[lid] for lid in lead_date)
    call_by_day = Counter()
    sale_by_day = Counter()
    agents_by_day = defaultdict(set)
    for c in calls:
        dt = parse_ts(c.get("Start of Call") or c.get("Session Start (No Offset)"))
        if not dt:
            continue
        d = dt.replace(tzinfo=None).date()
        call_by_day[d] += 1
        a = norm_agent(c.get("Agent Name"))
        if a and a not in NON_AGENTS:
            agents_by_day[d].add(a)
    for lid, cs in by_lead.items():
        for c in cs:
            if c.get("Lead Status") == "Success":
                dt = parse_ts(c.get("Start of Call") or c.get("Session Start (No Offset)"))
                if dt:
                    sale_by_day[dt.replace(tzinfo=None).date()] += 1
                break

    live = sorted(d for d, n in call_by_day.items() if n >= 20)
    last8 = [d for d in live if (max(live) - d).days <= 56]

    def avg(counter, days):
        return sum(counter.get(d, 0) for d in days) / len(days) if days else 0

    print(f"  'live day' = a day the dialler placed 20+ calls, so export gaps do not")
    print(f"  count as quiet days. {len(live)} live days between {min(live)} and {max(live)}.\n")
    print(f"  {'':<36}{'all live days':>15}{'last 8 weeks':>15}")
    for name, counter in (("new leads arriving per day", lead_by_day),
                          ("dials per day", call_by_day),
                          ("sales per day", sale_by_day)):
        print(f"  {name:<36}{avg(counter, live):>15.0f}{avg(counter, last8):>15.0f}")
    conc_all = sum(len(agents_by_day[d]) for d in live) / len(live)
    conc_8 = sum(len(agents_by_day[d]) for d in last8) / len(last8) if last8 else 0
    print(f"  {'agents dialling per day':<36}{conc_all:>15.1f}{conc_8:>15.1f}")
    print(f"  {'dials per new lead (burn ratio)':<36}"
          f"{avg(call_by_day, live) / (avg(lead_by_day, live) or 1):>15.1f}"
          f"{avg(call_by_day, last8) / (avg(lead_by_day, last8) or 1):>15.1f}")

    print(f"\n  occupancy check: median agent-day is {statistics.median(talks):.1f}h talking.")
    print(f"  Against a 7.5h shift that is {100 * statistics.median(talks) / 7.5:.0f}% occupancy,")
    print("  which says the constraint is list supply, not agent hours.")
    live_agents = conc_8 or conc_all

    # ── 5. The model ────────────────────────────────────────────────────────
    h("5. THE MODEL — FRESH LEADS NEEDED PER DAY")
    print("  In steady state every fresh lead is eventually worked to the attempt")
    print("  cap, so:  dials/day = fresh leads/day x dials consumed per lead")
    print("  and       sales/day = fresh leads/day x sales per lead\n")

    capacity_dials = live_agents * cap_dials
    rows = {}
    print(f"  {'cap at':>7}{'dials':>8}{'sales':>9}{'sales per':>11}"
          f"{'fresh leads/day':>17}{'sales/day':>11}")
    print(f"  {'attempt':>7}{'/lead':>8}{'/lead':>9}{'100 dials':>11}"
          f"{'to fill the day':>17}{'that buys':>11}")
    for cap in (2, 3, 4, 5, 6):
        d_per_lead = sum(dials_at[n] for n in range(1, cap + 1)) / base
        s_per_lead = sum(sale_at[n] for n in range(1, cap + 1)) / base
        need = capacity_dials / d_per_lead
        rows[cap] = (d_per_lead, s_per_lead, need)
        print(f"  {cap:>7}{d_per_lead:>8.2f}{s_per_lead:>9.4f}"
              f"{100 * s_per_lead / d_per_lead:>11.2f}{need:>17.0f}"
              f"{need * s_per_lead:>11.1f}")
    print(f"\n  'fill the day' assumes {live_agents:.1f} agents x {cap_dials:.0f} dials "
          f"= {capacity_dials:.0f} dials/day of capacity.")

    h("6. LEADS NEEDED FOR A SALES TARGET, BY ATTEMPT CAP")
    print(f"  {'sales/day target':>18}" + "".join(f"{'cap ' + str(c):>12}" for c in (3, 4, 5)))
    for target in (10, 15, 20, 25, 30, 40):
        row = f"  {target:>18}"
        for cap in (3, 4, 5):
            d_per_lead, s_per_lead, _ = rows[cap]
            row += f"{target / s_per_lead:>12.0f}"
        print(row)
    print("\n  ...and the agent headcount that lead volume implies:")
    print(f"  {'sales/day target':>18}" + "".join(f"{'cap ' + str(c):>12}" for c in (3, 4, 5)))
    for target in (10, 15, 20, 25, 30, 40):
        row = f"  {target:>18}"
        for cap in (3, 4, 5):
            d_per_lead, s_per_lead, _ = rows[cap]
            row += f"{(target / s_per_lead) * d_per_lead / cap_dials:>12.1f}"
        print(row)

    # ── 7. Working stock ────────────────────────────────────────────────────
    h("7. WORKING STOCK — HOW BIG THE LIVE LIST SHOULD BE")
    print("  A lead is not consumed the day it lands; it occupies the list until it")
    print("  is closed or hits the cap. Little's law: stock = arrival rate x cycle time.\n")
    spans = []
    for lid, cs in by_lead.items():
        if lid not in lead_date or len(cs) < 2:
            continue
        ds = [parse_ts(c.get("Start of Call") or c.get("Session Start (No Offset)"))
              for c in cs]
        ds = [d.replace(tzinfo=None).date() for d in ds if d]
        if len(ds) >= 2:
            spans.append((max(ds) - min(ds)).days)
    spans.sort()
    if spans:
        print(f"  days from first to last dial:  median {statistics.median(spans):.0f}, "
              f"p75 {q(spans, .75)}, p90 {q(spans, .90)}")
        cycle = statistics.median(spans) or 1
        for cap in (3, 4, 5):
            _, _, need = rows[cap]
            print(f"  cap {cap}: {need:.0f} fresh/day x {cycle:.0f} day cycle "
                  f"-> live list of ~{need * cycle:.0f} workable leads")

    # ── 8. Where the attempt cap should sit ─────────────────────────────────
    h("8. WHERE TO SET THE CAP — IT DEPENDS ENTIRELY ON WHAT A LEAD COSTS")
    print("  Cost per sale under cap N = (cost_lead + cost_dial x dials/lead) / sales/lead.")
    print("  Rearranged, each extra attempt band pays for itself above a threshold")
    print("  lead price, expressed as a multiple of what one dial costs in agent time.\n")
    print(f"  {'move':>14}{'extra dials':>14}{'extra sales':>14}"
          f"{'break-even lead price':>24}")
    for lo, hi in ((3, 4), (4, 5), (5, 6)):
        d_lo, s_lo, _ = rows[lo]
        d_hi, s_hi, _ = rows[hi]
        dd, ds = d_hi - d_lo, s_hi - s_lo
        if ds <= 0:
            continue
        # cap hi beats cap lo when: c_l/c_d > (dd*s_lo - ... ) solved below
        thresh = (dd * s_lo) / ds - d_lo
        print(f"  {'cap ' + str(lo) + ' -> ' + str(hi):>14}{dd:>14.2f}{ds:>14.4f}"
              f"{'above ' + format(thresh, '.1f') + ' x dial cost':>24}")

    print("\n  putting money on it, at a few plausible fully-loaded agent costs:")
    print(f"  {'agent cost/hr':>15}{'cost per dial':>15}" +
          "".join(f"{'cap ' + str(a) + ' -> ' + str(b):>20}" for a, b in ((3, 4), (4, 5))))
    for hourly in (14, 18, 22):
        c_d = hourly * 7.5 / cap_dials
        row = f"  {str(hourly) + '/h':>15}{c_d:>15.2f}"
        for lo, hi in ((3, 4), (4, 5)):
            d_lo, s_lo, _ = rows[lo]
            d_hi, s_hi, _ = rows[hi]
            thresh = ((d_hi - d_lo) * s_lo) / (s_hi - s_lo) - d_lo
            row += f"{'worth it if lead > ' + format(thresh * c_d, '.2f'):>20}"
        print(row)

    print("\n  Read it the other way round: the cap is only worth tightening when")
    print("  fresh leads are cheap enough to replace the attempts you give up.")
    print("  With agents at part occupancy the spare dial is nearly free, so the")
    print("  binding question is lead supply and lead price, not attempt discipline.")

    # ── 9. Runway and the prize ─────────────────────────────────────────────
    h("9. SUPPLY TREND, BACKLOG RUNWAY, AND WHAT FIXING SUPPLY IS WORTH")
    wk = Counter()
    for lid, d in lead_date.items():
        iso = d.isocalendar()
        wk[(iso[0], iso[1])] += 1
    recent_wks = sorted(wk)[-10:]
    print("  new leads arriving, last 10 weeks with data:")
    print("  " + "".join(f"{'W' + str(w[1]):>7}" for w in recent_wks))
    print("  " + "".join(f"{wk[w]:>7}" for w in recent_wks))

    attempts = {lid: len(cs) for lid, cs in by_lead.items()}
    today = max(call_by_day)
    closed = {"Success", "Not interested", "Invalid", "Unqualified"}
    workable = 0
    for l in leads:
        lid = l.get("Databowl Lead ID")
        if lid is None or l.get("Adversus Lead Status (single select)") in closed:
            continue
        age = (today - lead_date[lid]).days if lid in lead_date else 999
        if attempts.get(lid, 0) < 4 and age <= 30:
            workable += 1
    print(f"\n  leads still open, under 4 attempts and under 30 days old: {workable}")
    dpd = avg(call_by_day, last8)
    print(f"  at {dpd:.0f} dials/day that backlog is {workable * 3 / dpd:.1f} days of dialling")
    print(f"  incoming supply is {avg(lead_by_day, last8):.0f}/day against a burn of "
          f"{dpd / rows[4][0]:.0f} leads/day at cap 4 -> "
          f"{100 * avg(lead_by_day, last8) / (dpd / rows[4][0]):.0f}% of what the dialler eats")

    cur_spd = 100 * avg(sale_by_day, last8) / dpd
    print(f"\n  current yield:  {cur_spd:.2f} sales per 100 dials "
          f"({avg(sale_by_day, last8):.1f} sales/day on {dpd:.0f} dials)")
    print(f"  cap-4 yield on a properly fed list: {100 * rows[4][1] / rows[4][0]:.2f} "
          f"sales per 100 dials")
    gain = (rows[4][1] / rows[4][0]) * dpd
    print(f"  same agents, same dials, fresh list: {gain:.1f} sales/day "
          f"(+{100 * (gain / avg(sale_by_day, last8) - 1):.0f}%)")
    print("  -> the first win is not more headcount, it is stopping the recycling.")


if __name__ == "__main__":
    main()
