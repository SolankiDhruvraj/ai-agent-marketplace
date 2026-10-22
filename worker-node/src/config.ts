import * as dotenv from 'dotenv';
dotenv.config();

export const config = {
  controlPlaneUrl: process.env.CONTROL_PLANE_URL || 'http://localhost:8080',
  workerId: process.env.WORKER_ID || `worker-${Math.random().toString(36).substring(2, 8)}`,
  hostname: process.env.WORKER_HOSTNAME || require('os').hostname(),
  ipAddress: process.env.WORKER_IP || '127.0.0.1',
  skills: (process.env.WORKER_SKILLS || 'bug-fix,dependency-remediation,test-repair')
    .split(',')
    .map(s => s.trim()),
  pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS || '3000', 10),
  heartbeatIntervalMs: parseInt(process.env.HEARTBEAT_INTERVAL_MS || '10000', 10),

  llm: {
    apiBase: process.env.LLM_API_BASE || 'https://api.groq.com/openai/v1',
    apiKey: process.env.LLM_API_KEY || '',
    model: process.env.LLM_MODEL || 'llama-3.3-70b-versatile',
  },

  limits: {
    maxInputTokensPerStep: parseInt(process.env.MAX_INPUT_TOKENS_PER_STEP || '6000', 10),
    maxOutputTokensPerStep: parseInt(process.env.MAX_OUTPUT_TOKENS_PER_STEP || '800', 10),
    maxTotalTokensPerRun: parseInt(process.env.MAX_TOTAL_TOKENS_PER_RUN || '30000', 10),
    maxIterations: parseInt(process.env.MAX_AGENT_ITERATIONS || '6', 10),
  }
};
