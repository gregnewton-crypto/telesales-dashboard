# telesales-dashboard

## Cursor Cloud specific instructions

This repo is a **single self-contained static web app**: everything lives in `index.html`
(HTML + CSS + vanilla JS). There is **no build step, no package manager, no lockfile, and
no test/lint tooling**. Chart.js and chartjs-plugin-datalabels are loaded at runtime from the
jsDelivr CDN, so the page needs outbound network access to render charts.

### Running the app (dev)

Serve the repo root with any static file server and open `index.html`, e.g.:

```
python3 -m http.server 8000   # then open http://localhost:8000/index.html
```

Opening via `file://` also works but serving over HTTP avoids browser file-origin quirks.

### Core functionality / data source

- The dashboard pulls data **directly from Airtable in the browser** (`https://api.airtable.com/v0`),
  from the hardcoded base `appZoN6xBB9mDv8h4` (see the `BASE_ID`/`TABLE_*` constants in `index.html`).
- On first load it shows a token-entry overlay. The user pastes an Airtable **Personal Access Token**
  (must start with `pat`); it is stored in `localStorage` (`airtable_pat`) and sent only to Airtable.
- **To see real data you need a valid PAT with access to that specific private base.** Without one,
  the connect flow still runs end-to-end but the fetch returns `Authentication required` and the
  chart containers render empty. This is expected, not an environment problem.
- Data auto-refreshes every 5 minutes (`REFRESH_INTERVAL`).

### Lint / test / build

There are none — there is no tooling to run. Verification is manual: serve the file and exercise
the UI (token overlay → connect → tab navigation).
