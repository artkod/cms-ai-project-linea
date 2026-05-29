#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$PROJECT_DIR/.dev-pids"

echo "Stopping..."

if [[ -f "$PID_FILE" ]]; then
  while read -r pid; do
    kill "$pid" 2>/dev/null && echo "  Killed process $pid" || true
  done < "$PID_FILE"
  rm -f "$PID_FILE"
fi

cd "$PROJECT_DIR" && docker compose down 2>/dev/null && echo "  Database stopped." || true

echo "Done."
