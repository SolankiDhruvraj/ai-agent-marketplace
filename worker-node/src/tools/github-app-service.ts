import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { config } from '../config.js';

export class GitHubAppService {
  private appId: string;
  private privateKey: string;

  constructor() {
    this.appId = process.env.GITHUB_APP_ID || '';
    const keyPath = process.env.GITHUB_APP_PRIVATE_KEY_PATH || '';
    if (keyPath && fs.existsSync(keyPath)) {
      this.privateKey = fs.readFileSync(keyPath, 'utf8');
    } else {
      this.privateKey = '';
    }
  }

  isConfigured(): boolean {
    return Boolean(this.appId && this.privateKey);
  }

  /**
   * Clones real GitHub repository into workspace using short-lived installation access token.
   */
  async cloneRepository(owner: string, repo: string, destinationDir: string): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error('GitHub App credentials (GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY_PATH) are not configured.');
    }

    const appOctokit = new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId: this.appId,
        privateKey: this.privateKey,
      },
    });

    // Get installation ID for the target repository
    const { data: installation } = await appOctokit.apps.getRepoInstallation({
      owner,
      repo,
    });

    // Obtain scoped, short-lived token (1 hr)
    const installationOctokit = new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId: this.appId,
        privateKey: this.privateKey,
        installationId: installation.id,
      },
    });

    const { data: authData } = await installationOctokit.rest.apps.createInstallationAccessToken({
      installation_id: installation.id,
    });

    const token = authData.token;

    // Clone target repository cleanly into destination directory
    const authenticatedCloneUrl = `https://x-access-token:${token}@github.com/${owner}/${repo}.git`;
    execSync(`git clone --depth 1 ${authenticatedCloneUrl} "${destinationDir}"`, { stdio: 'pipe' });

    return token;
  }

  /**
   * Pushes generated branch and creates a real pull request on GitHub
   */
  async pushBranchAndOpenPullRequest(
    owner: string,
    repo: string,
    branchName: string,
    title: string,
    body: string,
    baseBranch = 'main'
  ): Promise<string> {
    const appOctokit = new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId: this.appId,
        privateKey: this.privateKey,
      },
    });

    const { data: installation } = await appOctokit.apps.getRepoInstallation({
      owner,
      repo,
    });

    const installationOctokit = new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId: this.appId,
        privateKey: this.privateKey,
        installationId: installation.id,
      },
    });

    const { data: pr } = await installationOctokit.pulls.create({
      owner,
      repo,
      title,
      head: branchName,
      base: baseBranch,
      body,
    });

    return pr.html_url;
  }
}
