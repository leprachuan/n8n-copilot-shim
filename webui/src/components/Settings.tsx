import { createSignal, For, onMount } from "solid-js";
import {
  config,
  updateApiEndpoint,
  updateTheme,
  updateSelectedAgent,
  updateAgentsApiEndpoint,
  AVAILABLE_THEMES,
  type Theme,
} from "../stores/config";
import { createClient } from "../api/client";

interface Agent {
  name: string;
  description: string;
  path: string;
}

interface SettingsProps {
  onClose: () => void;
}

export default function Settings(props: SettingsProps) {
  // Use current host instead of localhost to support network access
  const defaultHost = window.location.hostname;
  const defaultPort = "3001";
  
  const [endpoint, setEndpoint] = createSignal(
    config().apiEndpoint || `http://${defaultHost}:${defaultPort}/api`,
  );
  const [agentsEndpoint, setAgentsEndpoint] = createSignal(
    config().agentsApiEndpoint || `http://${defaultHost}:${defaultPort}/agents`,
  );
  const [selectedTheme, setSelectedTheme] = createSignal<Theme>(config().theme);
  const [error, setError] = createSignal("");
  const [agents, setAgents] = createSignal<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = createSignal(config().selectedAgent || "");
  const [loadingAgents, setLoadingAgents] = createSignal(false);
  let hasSaved = false;

  onMount(async () => {
    // Load available agents
    await loadAgents();
  });

  const loadAgents = async () => {
    const url = agentsEndpoint().trim();
    if (!url) return;

    setLoadingAgents(true);
    setError("");
    try {
      console.log('[Settings] Loading agents from:', `${url}/list`);
      const response = await fetch(`${url}/list`);
      console.log('[Settings] Response status:', response.status);
      if (!response.ok) {
        throw new Error(`Failed to fetch agents: ${response.statusText}`);
      }
      const data = await response.json();
      console.log('[Settings] Loaded agents:', data.agents);
      setAgents(data.agents || []);
      
      // Set first agent as default if none selected
      if (!selectedAgent() && data.agents.length > 0) {
        setSelectedAgent(data.agents[0].name);
        console.log('[Settings] Auto-selected first agent:', data.agents[0].name);
      }
    } catch (e: any) {
      console.error('[Settings] Failed to load agents:', e);
      setError(`Failed to load agents: ${e.message}`);
    } finally {
      setLoadingAgents(false);
    }
  };

  const applyTheme = (theme: Theme) => {
    document.documentElement.setAttribute("data-theme", theme);
  };

  const handleThemeChange = (theme: Theme) => {
    setSelectedTheme(theme);
    applyTheme(theme);
  };

  const handleSave = async () => {
    const url = endpoint().trim();
    const agentsUrl = agentsEndpoint().trim();
    const agent = selectedAgent();

    if (!url) {
      setError("API endpoint is required");
      return;
    }

    if (!agent) {
      setError("Please select an agent");
      return;
    }

    try {
      // First, set the selected agent on the backend
      const agentResponse = await fetch(`${agentsUrl}/set`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentName: agent })
      });

      if (!agentResponse.ok) {
        throw new Error('Failed to set agent on backend');
      }

      // Then verify the API endpoint works
      const client = createClient(url);
      const { data } = await client.session.list();
      if (!data) {
        throw new Error("Failed to connect");
      }

      updateApiEndpoint(url);
      updateAgentsApiEndpoint(agentsUrl);
      updateSelectedAgent(agent);
      updateTheme(selectedTheme());
      hasSaved = true;
      setError("");
      window.location.reload();
    } catch (e: any) {
      setError(
        e.message || "Failed to connect to API endpoint. Please check the URL and try again.",
      );
    }
  };

  return (
    <div class="card w-full max-w-lg bg-base-200 shadow-xl">
      <div class="card-body space-y-6">
        <h2 class="card-title text-2xl">n8n Copilot Shim Settings</h2>

        <div class="space-y-2">
          <label
            for="settings-agents-endpoint"
            class="text-sm font-medium text-base-content"
          >
            Agents API Endpoint
          </label>
          <div class="flex gap-2">
            <input
              id="settings-agents-endpoint"
              type="text"
              placeholder={`http://${window.location.hostname}:3001/agents`}
              class="input w-full max-w-none"
              value={agentsEndpoint()}
              onInput={(e) => setAgentsEndpoint(e.currentTarget.value)}
            />
            <button 
              class="btn btn-primary"
              onClick={loadAgents}
              disabled={loadingAgents()}
            >
              {loadingAgents() ? "Loading..." : "Load"}
            </button>
          </div>
          <p class="text-xs text-base-content/70">
            Enter the URL of the agents API server.
          </p>
        </div>

        <div class="space-y-2">
          <label
            for="settings-agent"
            class="text-sm font-medium text-base-content"
          >
            Agent
          </label>
          <select
            id="settings-agent"
            class="select w-full max-w-none"
            value={selectedAgent()}
            onChange={(e) => setSelectedAgent(e.currentTarget.value)}
            disabled={agents().length === 0}
          >
            <option value="" disabled>Select an agent...</option>
            <For each={agents()}>
              {(agent) => (
                <option value={agent.name}>
                  {agent.name} - {agent.description}
                </option>
              )}
            </For>
          </select>
          <p class="text-xs text-base-content/70">
            Select which agent's workspace to use.
          </p>
        </div>

        <div class="space-y-2">
          <label
            for="settings-api-endpoint"
            class="text-sm font-medium text-base-content"
          >
            API Endpoint
          </label>
          <input
            id="settings-api-endpoint"
            type="text"
            placeholder={`http://${window.location.hostname}:3001/api`}
            class="input w-full max-w-none"
            value={endpoint()}
            onInput={(e) => setEndpoint(e.currentTarget.value)}
            onKeyPress={(e) => {
              if (e.key === "Enter") {
                handleSave();
              }
            }}
          />
          <p class="text-xs text-base-content/70">
            Enter the URL of your OpenCode API proxy.
          </p>
        </div>

        <div class="space-y-2">
          <label
            for="settings-theme"
            class="text-sm font-medium text-base-content"
          >
            Theme
          </label>
          <select
            id="settings-theme"
            class="select w-full max-w-none"
            value={selectedTheme()}
            onChange={(e) => handleThemeChange(e.currentTarget.value as Theme)}
          >
            <For each={AVAILABLE_THEMES}>
              {(theme) => (
                <option value={theme}>
                  {theme.charAt(0).toUpperCase() + theme.slice(1)}
                </option>
              )}
            </For>
          </select>
          <p class="text-xs text-base-content/70">
            Choose your preferred theme.
          </p>
        </div>

        {error() && (
          <div class="alert alert-error">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="stroke-current shrink-0 h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>{error()}</span>
          </div>
        )}

        <div class="card-actions justify-end gap-2">
          {config().apiEndpoint && (
            <button class="btn btn-ghost" onClick={props.onClose}>
              Close
            </button>
          )}
          <button class="btn btn-primary" onClick={handleSave}>
            Save & Connect
          </button>
        </div>
      </div>
    </div>
  );
}
