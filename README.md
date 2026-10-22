# Forgeflow — Distributed AI Engineering Agent Marketplace

> Discover, deploy, and govern specialized AI agents running on distributed remote worker servers to resolve GitHub issues safely, cost-effectively, and with minimal tokens.

---

## 🏛️ System Architecture

Forgeflow is split into **two decoupled repositories/modules**:

```
AI marketplace/
├── backend/            # Central Control Plane API (Spring Boot 3.4 + MongoDB)
│                       # Manages tenants, agents, billing, and worker dispatching
│
├── frontend/           # Central Web UI (React + TypeScript + Vite)
│                       # Marketplace catalog, connected worker nodes, and live run queue
│
├── worker-node/        # Distributed AI Employee Daemon (Independent Node.js/TS project)
│                       # Deployable to ANY remote server, VM, or Docker host
│                       # Runs token-optimized ReAct loops with isolated sandboxes
│
└── docker-compose.yml  # Zero-cost infrastructure (MongoDB, Mongo Express, Prometheus, Grafana)
```

---

## 🚀 How to Run the Distributed System

### Step 1: Start Central Infrastructure (MongoDB + UI)
```bash
docker compose up -d
```
- MongoDB running on `localhost:27017`
- Mongo Express GUI on `http://localhost:8081`

### Step 2: Start Central Control Plane (Spring Boot)
```bash
cd backend
mvn spring-boot:run
```
- API live on `http://localhost:8080`

### Step 3: Start Web Marketplace UI
```bash
cd frontend
npm install
npm run dev
```
- Open **`http://localhost:5173`** in your browser.

### Step 4: Launch Distributed Worker Nodes (Any Remote Server!)
You can run as many worker servers as you want. Each worker polls the central server for jobs matching its specialized skills:

```bash
cd worker-node
npm install
npm start
```
*To run inside Docker on a remote server:*
```bash
cd worker-node
docker build -t forgeflow-worker .
docker run -d \
  -e CONTROL_PLANE_URL="http://<CENTRAL_SERVER_IP>:8080" \
  -e WORKER_ID="worker-srv-eu-central" \
  forgeflow-worker
```

---

## ⚡ How It Achieves 70–80% Token Reduction & Efficiency

1. **Deterministic Slicing (No Full Files to LLM):** Local search finds the symbol, and the worker only sends a 40-line function window into the prompt.
2. **Search & Replace Diffs:** Agents generate unified replacement blocks (~40 tokens) instead of rewriting 500-line files.
3. **Test Log Pruning:** Verbose JVM/npm trace logs are pruned before LLM ingestion, preserving only failing assertions.
4. **Skill Specialization:** Each worker uses a focused system prompt and restricted toolset for its exact domain (`bug-fix`, `dependency-remediation`, or `test-repair`).
5. **Free & Local LLM Support:** Ready for Groq (`llama-3.3-70b-versatile`), Google Gemini Flash, or local Ollama.
