#!/usr/bin/env sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
LOG_DIR="$ROOT_DIR/logs"
DATA_DIR="$ROOT_DIR/data"
PID_FILE="$LOG_DIR/server.pid"
LOG_FILE="$LOG_DIR/server.log"

mkdir -p "$LOG_DIR" "$DATA_DIR"

touch "$LOG_FILE"

if [ -f "$PID_FILE" ]; then
  PID="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [ -n "${PID:-}" ] && kill -0 "$PID" 2>/dev/null; then
    echo "server already running (pid $PID)"
    exit 1
  fi

  # stale pid
  rm -f "$PID_FILE"
fi

nohup node "$ROOT_DIR/server.js" >> "$LOG_FILE" 2>&1 &
PID="$!"

echo "$PID" > "$PID_FILE"
echo "server started (pid $PID)"
