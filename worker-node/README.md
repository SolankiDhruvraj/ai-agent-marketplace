# Forgeflow Distributed Worker Node

> Standalone, token-optimized AI employee worker daemon. Deploy on any remote VM or server.

## Features

- **Distributed Execution**: Connects to the central Forgeflow Control Plane via HTTP polling & heartbeats.
- **Skill Specialization**: Configure which skill manifests this node runs (`bug-fix`, `dependency-remediation`, `test-repair`).
- **70–80% Token Reduction**: Uses local code search, function window slicing, and test-log pruning to avoid sending entire codebases to LLMs.
- **Multi-Provider Support**: Supports free Groq (`llama-3.3-70b`), Google Gemini free tier, local Ollama, or LiteLLM.
- **Zero-Token Sandbox Mode**: Runs without an API key for deterministic offline testing and CI.

---

## Quick Start (Deploy on any server)

### 1. Install & configure

```bash
cd worker-node
npm install
cp .env.example .env
```

Configure `.env`:
```bash
CONTROL_PLANE_URL=http://<YOUR_CENTRAL_SERVER_IP>:8080
WORKER_ID=remote-worker-node-1
WORKER_SKILLS=bug-fix,dependency-remediation,test-repair
LLM_API_KEY=gsk_... # Optional: Groq free API key
```

### 2. Run the Worker Daemon

```bash
# Development (with auto-reload)
npm run dev

# Production
npm run build
npm start
```

### 3. Or Run with Docker

```bash
docker build -t forgeflow-worker .
docker run -d \
  --name forgeflow-worker-1 \
  -e CONTROL_PLANE_URL="http://host.docker.internal:8080" \
  -e WORKER_ID="docker-worker-srv1" \
  forgeflow-worker
```
