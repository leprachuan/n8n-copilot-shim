#!/usr/bin/env tsx
/**
 * Agent-aware proxy server for n8n-copilot-shim
 * Based on opencode-web proxy server (https://github.com/sst/opencode-web)
 * 
 * This server manages multiple OpenCode instances, one per agent,
 * allowing the web UI to interact with different agents from agents.json
 */

import { spawn, ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';

interface Agent {
  name: string;
  description: string;
  path: string;
}

interface AgentInstance {
  agent: Agent;
  proc: ChildProcess;
  url: string;
  port: number;
  proxy?: any; // http-proxy-middleware instance
}

const agentInstances = new Map<string, AgentInstance>();
let currentAgentName: string | null = null;

function loadAgents(): Agent[] {
  const agentsPath = path.resolve(process.cwd(), '..', 'agents.json');
  try {
    const content = fs.readFileSync(agentsPath, 'utf-8');
    const data = JSON.parse(content);
    return data.agents || [];
  } catch (err) {
    console.error('[agent-proxy] Failed to load agents.json:', err);
    return [];
  }
}

function extractUrl(text: string): string | null {
  const urlMatch = text.match(/https?:\/\/[^\s]+/);
  return urlMatch ? urlMatch[0] : null;
}

async function startOpencodeForAgent(agent: Agent): Promise<AgentInstance> {
  return new Promise((resolve, reject) => {
    console.log(`[agent-proxy] Starting OpenCode for agent: ${agent.name} in ${agent.path}`);
    
    const proc = spawn('opencode', ['serve'], { 
      stdio: ['ignore', 'pipe', 'pipe'], 
      cwd: agent.path 
    });

    let resolved = false;
    const onData = (buf: Buffer) => {
      const text = buf.toString();
      console.log(`[agent-proxy][${agent.name}] ${text.trim()}`);
      const url = extractUrl(text);
      if (!resolved && url) {
        resolved = true;
        cleanup();
        const urlObj = new URL(url);
        const port = parseInt(urlObj.port);
        resolve({ agent, proc, url, port });
      }
    };

    const onErr = (buf: Buffer) => {
      const text = buf.toString();
      console.error(`[agent-proxy][${agent.name}] ${text.trim()}`);
      const url = extractUrl(text);
      if (!resolved && url) {
        resolved = true;
        cleanup();
        const urlObj = new URL(url);
        const port = parseInt(urlObj.port);
        resolve({ agent, proc, url, port });
      }
    };

    const onExit = (code: number | null) => {
      console.log(`[agent-proxy] OpenCode for agent ${agent.name} exited with code ${code}`);
      agentInstances.delete(agent.name);
      if (!resolved) {
        reject(new Error(`opencode serve exited early with code ${code}`));
      }
    };

    const cleanup = () => {
      proc.stdout?.off('data', onData);
      proc.stderr?.off('data', onErr);
      proc.off('exit', onExit);
    };

    proc.stdout?.on('data', onData);
    proc.stderr?.on('data', onErr);
    proc.on('exit', onExit);

    // Timeout after 30 seconds
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        cleanup();
        proc.kill('SIGTERM');
        reject(new Error(`Timeout starting OpenCode for agent ${agent.name}`));
      }
    }, 30000);
  });
}

async function getOrCreateAgentInstance(agentName: string): Promise<AgentInstance> {
  const existing = agentInstances.get(agentName);
  if (existing) {
    return existing;
  }

  const agents = loadAgents();
  const agent = agents.find(a => a.name === agentName);
  if (!agent) {
    throw new Error(`Agent not found: ${agentName}`);
  }

  const instance = await startOpencodeForAgent(agent);
  
  // Create a proxy middleware for this instance
  instance.proxy = createProxyMiddleware({
    target: instance.url,
    changeOrigin: true,
    pathRewrite: { '^/api': '' },
    ws: true,
    onError: (err, req, res) => {
      console.error(`[agent-proxy][${agent.name}] Proxy error:`, err);
    }
  });
  
  agentInstances.set(agentName, instance);
  return instance;
}

function stopAgentInstance(agentName: string): boolean {
  const instance = agentInstances.get(agentName);
  if (!instance) {
    return false;
  }

  console.log(`[agent-proxy] Stopping OpenCode for agent: ${agentName}`);
  instance.proc.kill('SIGTERM');
  agentInstances.delete(agentName);
  
  if (currentAgentName === agentName) {
    currentAgentName = null;
  }
  
  return true;
}

function stopAllAgentInstances() {
  console.log('[agent-proxy] Stopping all agent instances...');
  for (const [name, instance] of agentInstances.entries()) {
    console.log(`[agent-proxy] Stopping ${name}...`);
    instance.proc.kill('SIGTERM');
  }
  agentInstances.clear();
  currentAgentName = null;
}

function startVite(env: Record<string, string>): ChildProcess {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const projectDir = path.resolve(__dirname, '..');
  
  console.log(`[agent-proxy] Starting Vite in ${projectDir}`);
  
  const vite = spawn('vite', { 
    stdio: 'inherit', 
    env: { ...process.env, ...env }, 
    cwd: projectDir 
  });
  
  vite.on('exit', (code) => {
    console.log(`[agent-proxy] Vite exited with code ${code}`);
    stopAllAgentInstances();
    process.exit(code ?? 0);
  });
  
  return vite;
}

async function main() {
  try {
    const agents = loadAgents();
    console.log(`[agent-proxy] Loaded ${agents.length} agents from agents.json`);

    // Create Express app for API and proxy
    const app = express();
    app.use(express.json());

    // Add CORS middleware for frontend
    app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type');
      if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
      }
      next();
    });

    // API endpoint to list agents
    app.get('/agents/list', (req, res) => {
      res.json({ agents });
    });

    // API endpoint to get current agent
    app.get('/agents/current', (req, res) => {
      res.json({ 
        agentName: currentAgentName,
        running: currentAgentName ? agentInstances.has(currentAgentName) : false
      });
    });

    // API endpoint to set current agent
    app.post('/agents/set', async (req, res) => {
      try {
        const { agentName } = req.body;
        if (!agentName) {
          return res.status(400).json({ error: 'agentName is required' });
        }

        const agent = agents.find(a => a.name === agentName);
        if (!agent) {
          return res.status(404).json({ error: `Agent not found: ${agentName}` });
        }

        // Start or get the instance for this agent
        const instance = await getOrCreateAgentInstance(agentName);
        currentAgentName = agentName;

        res.json({ 
          success: true, 
          agentName: currentAgentName,
          url: instance.url,
          port: instance.port
        });
      } catch (error: any) {
        console.error('[agent-proxy] Error setting agent:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // API endpoint to stop an agent
    app.post('/agents/stop', (req, res) => {
      const { agentName } = req.body;
      if (!agentName) {
        return res.status(400).json({ error: 'agentName is required' });
      }

      const stopped = stopAgentInstance(agentName);
      res.json({ success: stopped });
    });

    // Proxy middleware for OpenCode API
    app.use('/api', async (req, res, next) => {
      if (!currentAgentName) {
        return res.status(503).json({ 
          error: 'No agent selected. Please select an agent first.' 
        });
      }

      try {
        const instance = await getOrCreateAgentInstance(currentAgentName);
        
        // Use the existing proxy middleware for this instance
        if (instance.proxy) {
          instance.proxy(req, res, next);
        } else {
          res.status(500).json({ error: 'Proxy not initialized for this agent' });
        }
      } catch (error: any) {
        console.error('[agent-proxy] Error proxying request:', error);
        res.status(500).json({ error: error.message });
      }
    });

    const PORT = process.env.PORT || 3000;
    const server = app.listen(PORT, () => {
      console.log(`[agent-proxy] Management API listening on http://localhost:${PORT}`);
    });
    
    // Increase max listeners to handle multiple proxy connections
    server.setMaxListeners(50);

    // Start default agent if specified
    const defaultAgent = process.env.DEFAULT_AGENT || agents[0]?.name;
    if (defaultAgent) {
      console.log(`[agent-proxy] Starting default agent: ${defaultAgent}`);
      try {
        await getOrCreateAgentInstance(defaultAgent);
        currentAgentName = defaultAgent;
        console.log(`[agent-proxy] Default agent ${defaultAgent} is ready`);
      } catch (error) {
        console.error(`[agent-proxy] Failed to start default agent:`, error);
      }
    }

    // Start Vite dev server
    const env = {
      // Don't set VITE_API_DEFAULT - let the frontend detect the correct URL dynamically
      VITE_AGENTS_API: `http://localhost:${PORT}/agents`,
    } as Record<string, string>;
    
    const vite = startVite(env);

    const stopAll = () => {
      console.log('[agent-proxy] Shutting down...');
      vite.kill('SIGINT');
      server.close();
      stopAllAgentInstances();
      process.exit(0);
    };

    process.on('SIGINT', stopAll);
    process.on('SIGTERM', stopAll);
  } catch (err) {
    console.error('[agent-proxy] Failed to start agent proxy mode:', err);
    process.exit(1);
  }
}

main();
