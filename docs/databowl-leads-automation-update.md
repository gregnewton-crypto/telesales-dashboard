# Updating the existing Databowl Leads automation

## Why the fields drifted again

The single-select fields (`⚙ Called?`, `Time lead has been called`, `Adversus Lead Status (single select)`, `Lead open/closed`) are **not formulas**. They only update when an automation writes to them.

Your screenshot shows the root cause clearly:

- **Adversus Lead Status** (lookup from linked calls) already shows `Success` / `Not interested`
- **Adversus Lead Status (single select)** is often blank
- **Lead open/closed** stays `Open` because the automation either did not run or only looked at the single-select copy

New call records were created after the earlier one-off sync, so the problem returned on ~48 recent leads.

## Immediate fix already applied in the base

A formula field **`Lead open/closed (auto)`** was added. It reads directly from the **Adversus Lead Status lookup**, so it cannot drift:

- `Not interested`, `Invalid`, `Success`, `Unqualified` → **Closed**
- everything else → **Open**

**Recommendation:** show `Lead open/closed (auto)` in your views instead of the old `Lead open/closed` column, or hide the old column once you trust the automation again.

## Which automation to update (do not create a new one)

Open **Automations** in the Telesales System base and find the automation that already touches **☘ Databowl Leads**. It is usually named something like:

- Update lead status / called fields
- Sync Databowl lead fields
- When Adversus call created → update lead
- Databowl lead open closed

It will have one of these triggers:

1. **When a record is created/updated** in **Adversus Calls** (most likely — this is the one you want)
2. **When a record is updated** in **☘ Databowl Leads**

If you find **both**, update the script in **each** — or disable the weaker one so they do not fight each other.

### Required trigger coverage

The automation must run when **any** of these change on a lead:

- a call is linked (`🔗 Adversus Calls`)
- `Times Lead has been Called` rollup changes
- `Adversus Lead Status` lookup changes

Best trigger: **When a record is created or updated** in the **Adversus Calls** table, then update the linked Databowl Lead.

Optional second trigger: **When a record is updated** in **☘ Databowl Leads** and `Times Lead has been Called` or `Adversus Lead Status` changed.

## How to update the Run script action

1. Open the existing automation (do **not** duplicate it).
2. Click the **Run script** action.
3. Replace the entire script with the contents of `scripts/airtable-automation-sync-leads.js`.
4. Confirm the script input variable **`recordId`** is mapped to the Databowl Leads record ID:
   - From Adversus Calls trigger: use the linked **☘ Databowl Leads** record ID
   - From Databowl Leads trigger: use the triggering record's ID
5. Turn the automation **ON** and run a test.

## What the updated script fixes

| Field | Source of truth | Logic |
|---|---|---|
| ⚙ Called? | `Times Lead has been Called` | Yes if count > 0, else No |
| Time lead has been called | rollup count | string 1–20 (cap at 20) |
| Adversus Lead Status (single select) | **Adversus Lead Status lookup** | latest valid status |
| Lead open/closed | **lookup first**, then single select | Closed for terminal statuses |

Terminal (Closed) statuses: `Not interested`, `Invalid`, `Success`, `Unqualified`.

## Send your automation list

Paste the names + triggers of your current automations and I can tell you exactly which one to edit and whether any should be disabled.

Example format:

```
1. "Sync lead on call" — trigger: Adversus Calls updated — actions: Run script
2. "Mark lead open" — trigger: Databowl Leads updated — actions: Update record
```

## Manual catch-up (if needed)

```bash
export AIRTABLE_API_KEY=your_pat
python3 scripts/sync-databowl-leads-fields.py
```
