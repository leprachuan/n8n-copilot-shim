#!/bin/bash
# Test script for n8n-copilot-shim Web UI
# Verifies all components are working correctly

set -e

PORT="${PORT:-3001}"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "========================================"
echo "Web UI Test Suite"
echo "========================================"
echo ""

# Test 1: Check if server is running
echo -n "Test 1: Server is running... "
if curl -s "http://localhost:$PORT/agents/list" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ PASS${NC}"
else
    echo -e "${RED}✗ FAIL${NC}"
    echo "Server is not running on port $PORT"
    exit 1
fi

# Test 2: Agents API - List
echo -n "Test 2: List agents API... "
AGENTS=$(curl -s "http://localhost:$PORT/agents/list")
AGENT_COUNT=$(echo "$AGENTS" | jq -r '.agents | length')
if [ "$AGENT_COUNT" -ge 1 ]; then
    echo -e "${GREEN}✓ PASS${NC} ($AGENT_COUNT agents)"
else
    echo -e "${RED}✗ FAIL${NC}"
    echo "Expected at least 1 agent, got: $AGENT_COUNT"
    exit 1
fi

# Test 3: Agents API - Current
echo -n "Test 3: Current agent API... "
CURRENT=$(curl -s "http://localhost:$PORT/agents/current")
AGENT_NAME=$(echo "$CURRENT" | jq -r '.agentName')
if [ -n "$AGENT_NAME" ] && [ "$AGENT_NAME" != "null" ]; then
    echo -e "${GREEN}✓ PASS${NC} (current: $AGENT_NAME)"
else
    echo -e "${YELLOW}⚠ WARN${NC} (no agent set)"
fi

# Test 4: OpenCode API - Session endpoint
echo -n "Test 4: OpenCode session API... "
if curl -s "http://localhost:$PORT/api/session" > /dev/null 2>&1; then
    SESSION_COUNT=$(curl -s "http://localhost:$PORT/api/session" | jq -r 'length')
    echo -e "${GREEN}✓ PASS${NC} ($SESSION_COUNT sessions)"
else
    echo -e "${RED}✗ FAIL${NC}"
    echo "OpenCode API not responding"
    exit 1
fi

# Test 5: Agent switching
echo -n "Test 5: Agent switching... "
FIRST_AGENT=$(echo "$AGENTS" | jq -r '.agents[0].name')
SWITCH_RESULT=$(curl -s -X POST "http://localhost:$PORT/agents/set" \
    -H "Content-Type: application/json" \
    -d "{\"agentName\": \"$FIRST_AGENT\"}")
SWITCHED=$(echo "$SWITCH_RESULT" | jq -r '.success')
if [ "$SWITCHED" = "true" ]; then
    echo -e "${GREEN}✓ PASS${NC} (switched to: $FIRST_AGENT)"
else
    echo -e "${RED}✗ FAIL${NC}"
    echo "Failed to switch agent: $SWITCH_RESULT"
    exit 1
fi

# Test 6: Vite dev server
echo -n "Test 6: Vite dev server... "
VITE_PORT=3002
if curl -s "http://localhost:$VITE_PORT/" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ PASS${NC} (port $VITE_PORT)"
else
    echo -e "${YELLOW}⚠ WARN${NC} (Vite not responding on port $VITE_PORT)"
fi

# Test 7: Check for running OpenCode instances
echo -n "Test 7: OpenCode instances... "
OPENCODE_PROCS=$(pgrep -f "opencode serve" | wc -l)
if [ "$OPENCODE_PROCS" -ge 1 ]; then
    echo -e "${GREEN}✓ PASS${NC} ($OPENCODE_PROCS running)"
else
    echo -e "${YELLOW}⚠ WARN${NC} (no OpenCode instances running)"
fi

# Test 8: Check for memory leaks warning
echo -n "Test 8: No memory leak warnings... "
if [ -f "webui.log" ]; then
    LEAK_COUNT=$(grep -c "MaxListenersExceededWarning" webui.log || true)
    if [ "$LEAK_COUNT" -eq 0 ]; then
        echo -e "${GREEN}✓ PASS${NC}"
    else
        echo -e "${YELLOW}⚠ WARN${NC} ($LEAK_COUNT warnings found)"
    fi
else
    echo -e "${YELLOW}⚠ WARN${NC} (log file not found)"
fi

echo ""
echo "========================================"
echo -e "${GREEN}All critical tests passed!${NC}"
echo "========================================"
echo ""
echo "Access the Web UI at:"
echo "  http://localhost:$VITE_PORT/"
echo ""
echo "Available agents:"
echo "$AGENTS" | jq -r '.agents[] | "  - \(.name): \(.description)"'
echo ""
