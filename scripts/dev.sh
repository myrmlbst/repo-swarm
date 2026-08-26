#!/usr/bin/env bash
# Starts the api/ and web/ dev servers together. The agents/ orchestrator
# isn't wired into the API yet and takes its own arguments per run, so it's
# started separately via scripts/agents.sh, not here.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ ! -f "$ROOT_DIR/api/.env" || ! -f "$ROOT_DIR/web/.env.local" ]]; then
  echo "Missing api/.env or web/.env.local — run scripts/setup.sh first, then fill them in." >&2
  exit 1
fi

pids=()
cleanup() {
  echo "==> Stopping..."
  for pid in "${pids[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
}
trap cleanup EXIT INT TERM

(cd "$ROOT_DIR/api" && npm run dev) &
pids+=("$!")

(cd "$ROOT_DIR/web" && npm run dev) &
pids+=("$!")

wait
