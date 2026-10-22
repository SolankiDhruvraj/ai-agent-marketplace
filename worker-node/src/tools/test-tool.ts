import { execSync } from 'child_process';
import { TokenPruner } from '../engine/token-pruner.js';

export class TestTool {
  constructor(private workspaceDir: string) {}

  /**
   * Runs the targeted test suite and filters output down to the essential 30 lines
   */
  runTest(command = 'npm test'): { success: boolean; prunedOutput: string } {
    try {
      // Execute command inside the workspace with 60s timeout
      const raw = execSync(command, {
        cwd: this.workspaceDir,
        timeout: 60000,
        stdio: 'pipe'
      }).toString('utf8');

      const pruned = TokenPruner.pruneTestOutput(raw);
      return { success: true, prunedOutput: pruned || 'ALL TESTS PASSED' };
    } catch (err: any) {
      const raw = (err.stdout?.toString('utf8') || '') + '\n' + (err.stderr?.toString('utf8') || '');
      const pruned = TokenPruner.pruneTestOutput(raw.length > 0 ? raw : err.message);
      return { success: false, prunedOutput: pruned };
    }
  }
}
