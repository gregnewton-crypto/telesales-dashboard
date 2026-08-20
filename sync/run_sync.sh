#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -f sync/.env ]]; then
  set -a
  # shellcheck disable=SC1091
  source sync/.env
  set +a
fi

if [[ -z "${GOOGLE_SERVICE_ACCOUNT_JSON:-}" && -n "${GOOGLE_SERVICE_ACCOUNT_FILE:-}" ]]; then
  export GOOGLE_SERVICE_ACCOUNT_JSON
  GOOGLE_SERVICE_ACCOUNT_JSON="$(cat "$GOOGLE_SERVICE_ACCOUNT_FILE")"
fi

python3 sync/airtable_to_sheets.py "$@"
