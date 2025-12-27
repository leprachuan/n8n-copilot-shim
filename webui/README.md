# Web UI Quick Start Guide

This guide will help you get started with the n8n-copilot-shim web interface.

## Prerequisites

- Node.js 25.0.0 or higher
- OpenCode CLI installed and in your PATH
- Agents configured in `agents.json` at the project root

## Installation

```bash
cd webui
npm install
```

## Starting the Web UI

```bash
npm run dev
```

This will:
1. Start the agent proxy server on port 3000
2. Launch the Vite dev server for the frontend
3. Automatically detect and load agents from `../agents.json`

The web interface will be available at `http://localhost:5173` (Vite default) or the port shown in your terminal.

## First Time Setup

When you first open the web UI, you'll see a settings dialog:

1. **Agents API Endpoint** (default: `http://localhost:3000/agents`)
   - This should match where your agent-proxy server is running
   - Click "Load" to fetch available agents

2. **Agent Selection**
   - Select which agent you want to work with from the dropdown
   - Each agent corresponds to an entry in your `agents.json`
   - Examples: devops, family, projects, orchestrator

3. **API Endpoint** (default: `http://localhost:3000/api`)
   - The proxy endpoint for OpenCode API requests
   - This proxies to the OpenCode instance for your selected agent

4. **Theme**
   - Choose your preferred UI theme from 32 options
   - Default is "dark"

5. Click "Save & Connect"

The web UI will:
- Start an OpenCode instance in the selected agent's directory
- Connect to the OpenCode API
- Load existing sessions
- Be ready for your first message

## Using the Web UI

### Creating a Session

Click the "+ New" button in the sidebar to create a new session.

### Sending Messages

Type your message in the input box at the bottom and press Enter or click Send.

### Switching Agents

1. Click the settings icon (gear)
2. Select a different agent from the dropdown
3. Click "Save & Connect"

The web UI will:
- Start an OpenCode instance for the new agent if not already running
- Switch your active session to the new agent's workspace
- Keep the previous agent's OpenCode instance running (for fast switching)

### Managing Sessions

- **Rename**: Click the session name to rename it
- **Delete**: Click the trash icon next to a session
- **Fork**: Create a copy of a session (available in session menu)

### Settings

Access settings anytime by clicking the gear icon in the top right.

## Architecture

The web UI consists of two main components:

### 1. Agent Proxy Server (`server/agent-proxy.ts`)

- Manages multiple OpenCode instances (one per agent)
- Provides REST API for agent management:
  - `GET /agents/list` - List available agents
  - `GET /agents/current` - Get current agent
  - `POST /agents/set` - Switch to an agent
  - `POST /agents/stop` - Stop an agent's OpenCode instance
- Proxies OpenCode API requests to the correct instance
- Keeps OpenCode instances running for fast switching

### 2. Frontend (SolidJS application)

- Real-time message streaming via Server-Sent Events (SSE)
- Virtual scrolling for performance with large conversations
- Session management (create, rename, delete, fork)
- Agent selection UI
- Theme customization

## Environment Variables

You can customize the server behavior with environment variables:

```bash
# Set the default agent to start on launch
DEFAULT_AGENT=devops npm run dev

# Change the server port
PORT=8080 npm run dev
```

## Differences from CLI Mode

The web UI differs from the CLI `agent_manager.py` approach:

| Feature | Web UI | CLI (agent_manager.py) |
|---------|--------|----------------------|
| OpenCode instances | Keeps running | Restarts each request |
| Agent switching | Fast (reuses instance) | Slow (restart required) |
| Session management | Visual UI | Command-line |
| Real-time updates | SSE streaming | Batch output |
| Performance | High (persistent) | Lower (ephemeral) |

## Troubleshooting

### Can't load agents

**Problem:** Clicking "Load" doesn't show any agents

**Solutions:**
- Check that `agents.json` exists in the project root
- Verify the Agents API Endpoint is correct (default: `http://localhost:3000/agents`)
- Check the browser console for errors
- Verify the agent-proxy server is running

### OpenCode won't start

**Problem:** Error when trying to connect after selecting an agent

**Solutions:**
- Verify OpenCode is installed: `opencode --version`
- Check that OpenCode is in your PATH
- Verify the agent's path exists and is accessible
- Look at the agent-proxy server logs for detailed error messages

### Connection failed

**Problem:** "Failed to connect to API endpoint"

**Solutions:**
- Verify the API Endpoint is correct (default: `http://localhost:3000/api`)
- Check that the agent-proxy server is running
- Ensure you've selected an agent before trying to connect
- Check browser console and server logs for errors

### Sessions not loading

**Problem:** Can't see existing sessions

**Solutions:**
- Make sure OpenCode has been run at least once in the agent's directory
- Check OpenCode session storage: `~/.local/share/opencode/storage/session/global/`
- Try creating a new session to verify connectivity

## Advanced Usage

### Running Multiple Agent Instances

The agent-proxy server can run multiple OpenCode instances simultaneously:

```bash
# Start with default agent
npm run dev

# In the UI, switch to different agents
# Each agent gets its own OpenCode instance
# All instances remain running for fast switching
```

### Production Deployment

For production use:

```bash
# Build the frontend
npm run build

# Serve the built files with your preferred static file server
# Run the agent-proxy server with production settings
PORT=3000 NODE_ENV=production tsx server/agent-proxy.ts
```

### Custom Agent Configuration

Edit `../agents.json` to add or modify agents:

```json
{
  "agents": [
    {
      "name": "my-project",
      "description": "My custom project workspace",
      "path": "/path/to/my/project"
    }
  ]
}
```

Restart the agent-proxy server and reload the web UI to see your new agents.

## Credits

This web UI is based on [OpenCode Web](https://github.com/sst/opencode-web) by SST. See [ATTRIBUTION.md](./ATTRIBUTION.md) for details.
