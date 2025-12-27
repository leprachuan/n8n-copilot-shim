# Attribution

## OpenCode Web

The web interface in the `webui/` directory is based on [OpenCode Web](https://github.com/sst/opencode-web) by SST.

**Original Repository:** https://github.com/sst/opencode-web  
**License:** MIT  
**Copyright:** (c) 2024 SST

### Modifications

The following modifications have been made to adapt OpenCode Web for use with n8n-copilot-shim:

1. **Agent Selection**: Added UI and backend logic to allow users to select which agent (from `agents.json`) to launch OpenCode sessions for
2. **Agent Proxy Server**: Created `webui/server/agent-proxy.ts` to manage multiple OpenCode instances, one per agent
3. **Settings Component**: Enhanced the Settings UI to include agent selection and agents API endpoint configuration
4. **Config Store**: Extended the configuration store to persist selected agent and agents API endpoint
5. **Package Naming**: Renamed the package to `n8n-copilot-shim-webui` to reflect its integration with this project

### Why These Changes?

The n8n-copilot-shim manages multiple specialized agents (devops, family, projects, orchestrator) each operating in different directories. The original OpenCode Web was designed to work with a single OpenCode instance. These modifications allow the web UI to:

- Select which agent's workspace to use
- Launch OpenCode in the corresponding agent directory
- Maintain separate sessions per agent
- Avoid restarting OpenCode when switching between agents (unlike the CLI approach in `agent_manager.py`)

### Credits

We are grateful to the SST team for creating OpenCode Web and making it available under the MIT license. Their work provided an excellent foundation for building this agent-aware web interface.
