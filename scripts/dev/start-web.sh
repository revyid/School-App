#!/usr/bin/env bash
# Menjalankan web app secara TERDETACH dari cgroup worker Hermes supaya tidak ikut OOM-kill.
# Usage: PORT=3100 scripts/dev/start-web.sh [dev|start]
set -u
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PORT="${PORT:-3100}"
MODE="${1:-dev}"

# Batasi heap Node agar tidak memakan semua memori cgroup
export NODE_OPTIONS="--max-old-space-size=1024"

cd "$ROOT/apps/web"

if [ "$MODE" = "start" ]; then
  CMD=(pnpm exec next start -p "$PORT")
  LOG="$ROOT/.next-start.log"
else
  CMD=(pnpm exec next dev -p "$PORT")
  LOG="$ROOT/.next-dev.log"
fi

# setsid -> sesi baru, lepas dari scope/cgroup process worker
setsid nohup "${CMD[@]}" >"$LOG" 2>&1 &
PID=$!
disown 2>/dev/null || true
echo "started pid=$PID mode=$MODE port=$PORT log=$LOG"
sleep 2
echo "pid sebenarnya: $(pgrep -f "next (dev|start) -p $PORT" | tr '\n' ' ')"
