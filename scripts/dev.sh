#!/usr/bin/env bash
# Starts api/, web/, and the agents/ worker together — this is what actually
# makes submitting a repo through the web app do something: the API queues
# the analysis, the worker picks it up and runs the orchestrator against it.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ ! -f "$ROOT_DIR/api/.env" || ! -f "$ROOT_DIR/web/.env.local" || ! -f "$ROOT_DIR/agents/.env" ]]; then
  echo "Missing api/.env, web/.env.local, or agents/.env — run scripts/setup.sh first, then fill them in." >&2
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

(cd "$ROOT_DIR/agents" && npm run worker) &
pids+=("$!")

wait
