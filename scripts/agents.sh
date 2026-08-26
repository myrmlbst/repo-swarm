#!/usr/bin/env bash
# Runs the orchestrator standalone (no api/ or web/ needed).
# Usage: scripts/agents.sh <repo_url> "<question>"
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ ! -f "$ROOT_DIR/agents/.env" ]]; then
  echo "Missing agents/.env — run scripts/setup.sh first, then fill in ANTHROPIC_API_KEY." >&2
  exit 1
fi

if [[ $# -lt 2 ]]; then
  echo 'Usage: scripts/agents.sh <repo_url> "<question>"' >&2
  exit 1
fi

cd "$ROOT_DIR/agents" && npm run dev -- "$@"
