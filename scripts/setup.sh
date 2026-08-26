#!/usr/bin/env bash
# One-time setup: installs deps for api/, web/, agents/ (via the root npm
# workspace), and creates any missing .env files from their .example
# counterparts (never overwrites an existing one).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "==> Installing dependencies (api/, web/, agents/)"
(cd "$ROOT_DIR" && npm install)

copy_env() {
  local example="$1" target="$2"
  if [[ -f "$target" ]]; then
    echo "==> $target already exists, leaving it alone"
  elif [[ -f "$example" ]]; then
    cp "$example" "$target"
    echo "==> Created $target from $(basename "$example") — fill in the real values before running"
  fi
}

copy_env "$ROOT_DIR/api/.env.example" "$ROOT_DIR/api/.env"
copy_env "$ROOT_DIR/web/.env.local.example" "$ROOT_DIR/web/.env.local"
copy_env "$ROOT_DIR/agents/.env.example" "$ROOT_DIR/agents/.env"

echo "==> Done. Fill in any newly-created .env files, then run scripts/dev.sh"
