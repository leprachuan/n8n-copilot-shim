#!/bin/bash
# Stop script for n8n-copilot-shim Web UI

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$SCRIPT_DIR/webui.pid"

if [ ! -f "$PID_FILE" ]; then
    echo "Web UI is not running (no PID file found)"
    exit 0
fi

PID=$(cat "$PID_FILE")

if ! ps -p "$PID" > /dev/null 2>&1; then
    echo "Web UI is not running (stale PID file)"
    rm -f "$PID_FILE"
    exit 0
fi

echo "Stopping Web UI (PID: $PID)..."
kill "$PID"

# Wait for process to stop
for i in {1..10}; do
    if ! ps -p "$PID" > /dev/null 2>&1; then
        echo "✓ Web UI stopped successfully"
        rm -f "$PID_FILE"
        exit 0
    fi
    sleep 1
done

# Force kill if still running
if ps -p "$PID" > /dev/null 2>&1; then
    echo "Force stopping Web UI..."
    kill -9 "$PID"
    rm -f "$PID_FILE"
    echo "✓ Web UI force stopped"
fi
