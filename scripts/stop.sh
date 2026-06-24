#!/usr/bin/env sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
PID_FILE="$ROOT_DIR/logs/server.pid"

if [ ! -f "$PID_FILE" ]; then
  echo "server not running"
  exit 0
fi

PID="$(cat "$PID_FILE" 2>/dev/null || true)"

# pid file exists but empty/invalid
if [ -z "${PID:-}" ]; then
  rm -f "$PID_FILE"
  echo "server not running"
  exit 0
fi

# pid file exists but process is not running
if ! kill -0 "$PID" 2>/dev/null; then
  rm -f "$PID_FILE"
  echo "server not running"
  exit 0
fi

# ask process to terminate
kill "$PID" 2>/dev/null || true

# confirm it actually exits before cleaning up pid file
tries=0
while kill -0 "$PID" 2>/dev/null; do
  tries=$((tries + 1))
  if [ "$tries" -ge 5 ]; then
    echo "server still running (pid $PID)"
    exit 1
  fi
  sleep 1
done

rm -f "$PID_FILE"
echo "server stopped"
exit 0
