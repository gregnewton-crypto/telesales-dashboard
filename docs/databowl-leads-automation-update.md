# Databowl Leads automation fix

## Do NOT create a new automation

Update these **two existing automations**:

| Automation name | Script file | Why |
|---|---|---|
| **Databowl lead date IE** | `scripts/databowl-lead-date-ie-automation.js` | Primary sync for Called?, times-called select, Adversus status select, Lead open/closed |
| **Linking Leads Adversus & Databowl** | `scripts/linking-leads-adversus-databowl-automation.js` | Links calls to leads — v5 now also syncs lead fields immediately after linking |

All other automations in your list are unrelated — leave them unchanged.

---

## 1. Update "Databowl lead date IE"

1. Open **Automations** → **Databowl lead date IE**
2. Click the **Run script** action
3. Select all script text → delete → paste entire contents of `scripts/databowl-lead-date-ie-automation.js`
4. Confirm input variable **`recordId`** = `{{recordId}}` from the trigger

### Trigger settings (important)

Trigger should be: **When a record is updated** in **☘ Databowl Leads**

**Watch these fields only** (do not watch the output fields this script writes):

| Field | Field ID |
|---|---|
| 🔗 Adversus Calls | `fld3DeParsIUfU1FL` |
| Times Lead has been Called | `fldsKBO1ZpAImfV8C` |
| Adversus Lead Status (lookup) | `fld0XrXF3YtWqWSAN` |

If **🔗 Adversus Calls** is not in the watch list, the automation will not run when a call is first linked — that is why fields stayed blank while the lookup already showed Success / Not interested.

### What v5 fixes in the script

| Bug in old script | Fix |
|---|---|
| `Unqualified` missing from closed statuses | Added to `CLOSED_STATUSES` |
| `Shared callback` missing from open statuses | Added to `OPEN_STATUSES` |
| Lookup used **first** call status only | Now uses **latest** lookup value |
| Lead open/closed ignored lookup when single-select blank | Open/closed computed from lookup text directly |

Terminal → **Closed**: `Not interested`, `Invalid`, `Success`, `Unqualified`

---

## 2. Update "Linking Leads Adversus & Databowl"

1. Open **Automations** → **Linking Leads Adversus & Databowl**
2. Replace the Run script with `scripts/linking-leads-adversus-databowl-automation.js`

This adds **Job 3**: after a call is linked to a Databowl lead, it immediately syncs Called?, status select, and Lead open/closed — so you are not waiting for the other automation's trigger.

Input variable stays: **`recordId`** = Adversus call record ID from trigger.

---

## 3. Optional: use the formula column in views

A formula field **`Lead open/closed (auto)`** already exists in the base. It reads the lookup directly and never drifts. You can show it in grid views while verifying the automations work.

---

## 4. One-off catch-up for existing bad rows

```bash
export AIRTABLE_API_KEY=your_pat
python3 scripts/sync-databowl-leads-fields.py
```

---

## Quick test after updating

1. Find a lead where lookup shows **Not interested** or **Success** but Lead open/closed still says Open
2. Open any linked Adversus call record and save it (or re-run Linking automation)
3. Refresh the Databowl Leads grid — Called?, status select, and Lead open/closed should all update

If it still fails, send the trigger configuration for **Databowl lead date IE** (screenshot or field watch list).
