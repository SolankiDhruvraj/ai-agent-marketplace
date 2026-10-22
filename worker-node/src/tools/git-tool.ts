import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { GitHubAppService } from './github-app-service.js';

export class GitTool {
  private ghService = new GitHubAppService();

  constructor(private workspaceDir: string) {}

  /**
   * Initializes or checks out a dedicated branch for this agent run
   */
  prepareBranch(runId: string): string {
    const branchName = `forgeflow/agent-${runId.substring(0, 8)}`;
    if (!fs.existsSync(path.join(this.workspaceDir, '.git'))) {
      execSync(`git init -b main`, { cwd: this.workspaceDir, stdio: 'pipe' });
    }
    execSync(`git checkout -B ${branchName}`, { cwd: this.workspaceDir, stdio: 'pipe' });
    return branchName;
  }

  /**
   * Obtains unified diff of changes made by agent
   */
  getDiff(): string {
    try {
      execSync(`git add -A`, { cwd: this.workspaceDir, stdio: 'pipe' });
      return execSync(`git diff --staged`, { cwd: this.workspaceDir, stdio: 'pipe' }).toString('utf8');
    } catch {
      return '';
    }
  }

  /**
   * Real GitHub Pull Request Creator using authenticated GitHub App credentials
   */
  async openPullRequest(
    repository: string,
    branchName: string,
    issueNumber: number,
    title: string,
    diffSummary: string
  ): Promise<string> {
    if (!repository.includes('/')) {
      throw new Error(`Invalid repository format '${repository}'. Expected 'owner/repo'.`);
    }

    const [owner, repo] = repository.split('/');

    // Commit changes to local git
    try {
      execSync(`git add -A`, { cwd: this.workspaceDir, stdio: 'pipe' });
      execSync(`git commit -m "fix: resolve issue #${issueNumber} - ${title.replace(/"/g, '')}"`, {
        cwd: this.workspaceDir,
        stdio: 'pipe',
      });
    } catch (e: any) {
      // Nothing to commit or already committed
    }

    if (this.ghService.isConfigured()) {
      try {
        // Push branch to origin
        execSync(`git push -u origin ${branchName} --force`, { cwd: this.workspaceDir, stdio: 'pipe' });

        const body = `### Forgeflow Autonomous AI Engineer PR\n\nCloses #${issueNumber}\n\n**Issue**: ${title}\n\n#### Quality & Verification Report:\n\`\`\`\n${diffSummary}\n\`\`\``;
        return await this.ghService.pushBranchAndOpenPullRequest(owner, repo, branchName, `[Forgeflow] ${title}`, body);
      } catch (err: any) {
        console.error('Failed to open real GitHub PR:', err.message);
        throw err;
      }
    }

    throw new Error('GitHub App is not configured. Please supply GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY_PATH in .env');
  }
}
