#!/usr/bin/env bash
# Optional one-command development launcher; both servers remain foreground-managed.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ -x "$ROOT/.venv/bin/python" ]]; then
  PYTHON="$ROOT/.venv/bin/python"
else
  PYTHON="${PYTHON_BINARY:-python}"
fi
cleanup() {
  trap - EXIT INT TERM
  [[ -n "${API_PID:-}" ]] && kill "$API_PID" 2>/dev/null || true
  [[ -n "${WEB_PID:-}" ]] && kill "$WEB_PID" 2>/dev/null || true
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM
(cd "$ROOT/backend" && exec "$PYTHON" -m uvicorn app.main:app --host 0.0.0.0 --port 8000) &
API_PID=$!
(cd "$ROOT/frontend" && exec node node_modules/vite/bin/vite.js --host 0.0.0.0) &
WEB_PID=$!
echo "QubitLab: http://localhost:5173 | API: http://localhost:8000/docs"
wait -n "$API_PID" "$WEB_PID"
