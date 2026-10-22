import { config } from '../config.js';

export interface RetrievedMemory {
  id: string;
  title: string;
  problemDescription: string;
  rootCausePattern: string;
  patchDiff: string;
  similarityScore: number;
}

/**
 * Tri-Phase Agent Memory Engine:
 * - Working Memory (Short-term scratchpad per run)
 * - Episodic Memory (MongoDB Vector Search over past successful PRs)
 * - Semantic Memory (Static rules & framework invariants)
 */
export class MemoryEngine {
  private workingMemory: string[] = [];

  constructor(private controlPlaneUrl = config.controlPlaneUrl) {}

  addWorkingHypothesis(note: string) {
    this.workingMemory.push(`[T+${Date.now()}] ${note}`);
  }

  getWorkingMemorySummary(): string {
    if (this.workingMemory.length === 0) return 'No prior hypotheses tested.';
    return this.workingMemory.slice(-4).join('\n');
  }

  /**
   * Vector-based recall from MongoDB agent_memories collection
   */
  async recallEpisodicMemories(query: string, agentSlug: string): Promise<RetrievedMemory[]> {
    try {
      const res = await fetch(`${this.controlPlaneUrl}/api/memory/recall`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, agentSlug, limit: 2 })
      });

      if (res.ok) {
        return (await res.json()) as RetrievedMemory[];
      }
    } catch {
      // Fallback if control plane vector service is offline
    }
    return [];
  }

  /**
   * Formats retrieved episodic memories for Few-Shot reasoning
   */
  formatFewShotContext(memories: RetrievedMemory[]): string {
    if (memories.length === 0) return '';
    const items = memories.map(m =>
      `Example Historical Fix (${Math.round(m.similarityScore * 100)}% Match): "${m.title}"
  Problem: ${m.problemDescription}
  Root Cause: ${m.rootCausePattern}
  Accepted Patch:
${m.patchDiff}`
    ).join('\n\n');

    return `=== RECALLED EPISODIC MEMORIES (MONGODB VECTOR SEARCH) ===\n${items}\n=======================================================\n`;
  }
}
