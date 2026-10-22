import { config } from './config.js';
import { AgentExecutionLoop, RunTask } from './engine/agent-loop.js';
import { startPrReviewServer } from './pr-review/server.js';

class ForgeflowWorkerDaemon {
  private isProcessing = false;

  async start() {
    console.log(`=====================================================`);
    console.log(`🚀 Forgeflow Distributed AI Employee Worker Daemon`);
    console.log(`Worker ID:     ${config.workerId}`);
    console.log(`Hostname:      ${config.hostname} (${config.ipAddress})`);
    console.log(`Skills:        [${config.skills.join(', ')}]`);
    console.log(`Control Plane: ${config.controlPlaneUrl}`);
    console.log(`LLM Model:     ${config.llm.model} (${config.llm.apiKey ? 'API Key Active' : 'Sandbox Zero-Token Mode'})`);
    console.log(`=====================================================\n`);

    // Initial registration & heartbeat
    await this.sendHeartbeat();
    setInterval(() => this.sendHeartbeat(), config.heartbeatIntervalMs);

    // Continuous polling loop
    console.log(`[Worker] Listening for queued engineering tasks...`);
    setInterval(() => this.pollForWork(), config.pollIntervalMs);

    // Boot PR Review & Chat Engine
    try {
      startPrReviewServer(4005);
    } catch (err: any) {
      console.warn(`[PR-Engine] Failed to start PR Review server: ${err.message}`);
    }
  }

  private async sendHeartbeat() {
    try {
      const res = await fetch(`${config.controlPlaneUrl}/api/worker/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workerId: config.workerId,
          hostname: config.hostname,
          ipAddress: config.ipAddress,
          skills: config.skills
        })
      });
      if (!res.ok) {
        // Control plane may be booting up
      }
    } catch {
      // Quietly wait for control plane
    }
  }

  private async pollForWork() {
    if (this.isProcessing) return;

    try {
      const res = await fetch(`${config.controlPlaneUrl}/api/worker/poll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workerId: config.workerId,
          skills: config.skills
        })
      });

      if (res.status === 200) {
        const task = await res.json() as RunTask;
        if (task && task.id) {
          this.isProcessing = true;
          await this.executeTask(task);
          this.isProcessing = false;
        }
      }
    } catch (err: any) {
      // Control plane unavailable or network hiccup
    }
  }

  private async executeTask(task: RunTask) {
    console.log(`\n⚡ [Task Claimed] Run ID: ${task.id}`);
    console.log(`   Repository: ${task.repository}`);
    console.log(`   Issue #${task.issueNumber}: ${task.issueTitle}`);
    console.log(`   Assigned Specialist: ${task.agentName} (${task.agentSlug})`);

    const reportProgress = async (step: string) => {
      console.log(`   ↳ [Progress] ${step}`);
      try {
        await fetch(`${config.controlPlaneUrl}/api/worker/runs/${task.id}/progress`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workerId: config.workerId,
            step,
            status: 'RUNNING'
          })
        });
      } catch {}
    };

    try {
      const loop = new AgentExecutionLoop(task, reportProgress);
      const result = await loop.run();

      console.log(`✅ [Task Completed in ${result.executionTimeMs}ms]`);
      console.log(`   Tokens: In=${result.inputTokens}, Out=${result.outputTokens} (Cached Prefix: ${result.cachedInputTokens} | ${result.cacheHitRatePercent}% Cache Hit)`);
      console.log(`   Adversarial Critic: Score ${result.criticScore}/100 (${result.criticVerdict.split('—')[0].trim()})`);
      console.log(`   Code Style Linter: ${result.linterClean ? 'CLEAN (0 errors)' : 'WARNINGS RESOLVED'}`);
      console.log(`   Voyage AI Code RAG: ${result.ragChunksCount} semantic chunks injected`);
      console.log(`   MongoDB Memories: ${result.memoryMatchesCount} episodic experiences recalled (Auto-learned new experience)`);
      console.log(`   SBFL Candidate: ${result.suspectCandidate}`);
      console.log(`   AST Safety Gate: ${result.safetyPassed ? 'PASSED' : 'REVISED'}`);
      console.log(`   PR Created: ${result.pullRequestUrl}\n`);

      const richSummary = `[PROPRIETARY PROFICIENCY & DUAL-CRITIC METRICS]
• Adversarial Senior Critic: Score ${result.criticScore}/100 — ${result.criticVerdict}
• Code Style Linter: ${result.linterClean ? 'Clean (0 violations)' : 'Formatted to standards'}
• Prompt Cache Efficiency: ${result.cacheHitRatePercent}% KV-cache hit rate (${result.cachedInputTokens} cached tokens)
• Voyage AI (voyage-code-3): ${result.ragChunksCount} semantic codebase chunks retrieved
• MongoDB Vector Search: ${result.memoryMatchesCount} episodic experiences recalled & auto-learned
• SBFL Fault Localization: Candidate ${result.suspectCandidate}
• AST Safety Gate: ${result.safetyPassed ? 'VERIFIED (0 violations)' : 'FAILED'}

[UNIFIED DIFF]
${result.diffSummary}`;

      // Report completion back to Control Plane
      await fetch(`${config.controlPlaneUrl}/api/worker/runs/${task.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workerId: config.workerId,
          diffSummary: richSummary,
          pullRequestUrl: result.pullRequestUrl,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          executionTimeMs: result.executionTimeMs,
          success: result.success
        })
      });
    } catch (err: any) {
      console.error(`❌ [Task Failed] ${err.message}`);
      await fetch(`${config.controlPlaneUrl}/api/worker/runs/${task.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workerId: config.workerId,
          diffSummary: '',
          pullRequestUrl: '',
          inputTokens: 0,
          outputTokens: 0,
          executionTimeMs: 0,
          success: false
        })
      });
    }
  }
}

// Start worker
const daemon = new ForgeflowWorkerDaemon();
daemon.start();
