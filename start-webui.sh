#!/bin/bash
# Quick start script for n8n-copilot-shim Web UI
# This starts both the agent proxy server and Vite dev server

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEBUI_DIR="$SCRIPT_DIR/webui"
LOG_FILE="$SCRIPT_DIR/webui.log"
PID_FILE="$SCRIPT_DIR/webui.pid"

# Default port for agent proxy
PORT="${PORT:-3001}"

cd "$WEBUI_DIR"

# Check if already running
if [ -f "$PID_FILE" ]; then
    OLD_PID=$(cat "$PID_FILE")
    if ps -p "$OLD_PID" > /dev/null 2>&1; then
        echo "Web UI is already running (PID: $OLD_PID)"
        echo "Stop it first with: ./stop-webui.sh"
        exit 1
    else
        rm -f "$PID_FILE"
    fi
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Start the server in background
echo "Starting Web UI on port $PORT..."
PORT=$PORT nohup npm run dev > "$LOG_FILE" 2>&1 &
echo $! > "$PID_FILE"

# Wait for server to start
echo "Waiting for server to start..."
for i in {1..30}; do
    if curl -s "http://localhost:$PORT/agents/list" > /dev/null 2>&1; then
        echo "✓ Web UI started successfully!"
        echo ""
        echo "Access URLs:"
        echo "  Local:   http://localhost:3002/"
        
        # Try to detect network IP
        if command -v hostname > /dev/null 2>&1; then
            HOSTNAME=$(hostname -I 2>/dev/null | awk '{print $1}')
            if [ -n "$HOSTNAME" ]; then
                echo "  Network: http://$HOSTNAME:3002/"
            fi
        fi
        
        echo ""
        echo "API Endpoint: http://localhost:$PORT"
        echo "Log file: $LOG_FILE"
        echo ""
        echo "To stop: ./stop-webui.sh"
        exit 0
    fi
    sleep 1
done

echo "✗ Server failed to start within 30 seconds"
echo "Check logs: tail -f $LOG_FILE"
exit 1
