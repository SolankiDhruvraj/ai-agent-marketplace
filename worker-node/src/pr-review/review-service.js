import { getPullRequestFiles, postPullRequestReview, buildReviewBody } from './github-service.js';
import { runAllAnalyses } from './analysis-engine.js';
import { enrichIssuesWithAI } from './ai-service.js';

const RISK_SCORE_THRESHOLD = parseInt(process.env.AUTO_REJECT_RISK_SCORE || '15', 10);
const HIGH_ISSUES_THRESHOLD = parseInt(process.env.AUTO_REJECT_HIGH_ISSUES || '3', 10);

// In-memory cache + MongoDB sync
const inMemoryReviews = new Map();

function emptySummary() {
  return {
    totalIssues: 0,
    riskScore: 0,
    severityDistribution: { HIGH: 0, MEDIUM: 0, LOW: 0 },
    filesAffected: []
  };
}

function formatErrorMessage(err) {
  if (!err) return 'Unknown error';
  const status = err.status || err.response?.status;
  const base = err.message || 'Unknown error';
  return status ? `GitHub/API error ${status}: ${base}` : base;
}

function buildErrorReview({ owner, repo, pullNumber, startedAt, files = [], issues = [], summary = emptySummary(), errorMessage = null }) {
  return {
    id: makeKey(owner, repo, pullNumber),
    owner,
    repo,
    number: pullNumber,
    status: 'ERROR',
    createdAt: startedAt,
    updatedAt: new Date().toISOString(),
    files,
    issues,
    summary,
    errorMessage,
    githubReviewStatus: null,
    githubReviewUrl: null
  };
}

function makeKey(owner, repo, number) {
  return `${owner}:${repo}:${number}`;
}

async function syncToBackend(review) {
  try {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8080';
    await fetch(`${backendUrl}/api/pr-reviews/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(review)
    });
  } catch (err) {
    // Non-blocking sync error
    console.warn(`[PR-Sync] Notice: could not sync review to backend: ${err.message}`);
  }
}

export async function processReview({ owner, repo, pullNumber, startedAt }) {
  console.log(`[PR Processor] Processing PR #${pullNumber} in ${owner}/${repo}`);

  let files = [];
  let analysisResult = { issues: [], summary: emptySummary() };

  try {
    files = await getPullRequestFiles({ owner, repo, pullNumber });
    analysisResult = runAllAnalyses(files);

    let issuesWithAI = analysisResult.issues;
    try {
      issuesWithAI = await enrichIssuesWithAI({
        owner,
        repo,
        number: pullNumber,
        files,
        issues: analysisResult.issues
      });
    } catch (err) {
      console.error(`[Processor] AI enrichment failed for PR #${pullNumber}:`, err.message);
    }

    const { summary } = analysisResult;
    const shouldReject =
      summary.riskScore >= RISK_SCORE_THRESHOLD ||
      summary.severityDistribution.HIGH >= HIGH_ISSUES_THRESHOLD;

    const status = shouldReject ? 'REJECTED' : 'COMPLETED';

    let githubReviewStatus = null;
    let githubReviewUrl = null;

    if (shouldReject) {
      try {
        const body = buildReviewBody({ summary, issues: issuesWithAI });
        const reviewResponse = await postPullRequestReview({
          owner,
          repo,
          pullNumber,
          event: 'REQUEST_CHANGES',
          body
        });
        githubReviewStatus = 'REJECTED';
        githubReviewUrl = reviewResponse?.html_url || null;
      } catch (err) {
        console.error(`[Processor] Failed to post GitHub review:`, err.message);
      }
    }

    const finalReview = {
      id: makeKey(owner, repo, pullNumber),
      owner,
      repo,
      number: pullNumber,
      status,
      createdAt: startedAt,
      updatedAt: new Date().toISOString(),
      files,
      issues: issuesWithAI,
      summary,
      errorMessage: null,
      githubReviewStatus,
      githubReviewUrl
    };

    const key = makeKey(owner, repo, pullNumber);
    inMemoryReviews.set(key, finalReview);
    await syncToBackend(finalReview);

    console.log(`[PR Processor] Review complete for PR #${pullNumber} (${status})`);
    return finalReview;
  } catch (err) {
    const errorReview = buildErrorReview({
      owner,
      repo,
      pullNumber,
      startedAt,
      files,
      issues: analysisResult.issues,
      summary: analysisResult.summary,
      errorMessage: formatErrorMessage(err)
    });

    const key = makeKey(owner, repo, pullNumber);
    inMemoryReviews.set(key, errorReview);
    await syncToBackend(errorReview);
    return errorReview;
  }
}

export async function startReviewForPullRequest({ owner, repo, pullNumber }) {
  const startedAt = new Date().toISOString();
  const key = makeKey(owner, repo, pullNumber);

  const pendingReview = {
    id: key,
    owner,
    repo,
    number: pullNumber,
    status: 'PENDING',
    createdAt: startedAt,
    updatedAt: startedAt,
    files: [],
    issues: [],
    summary: emptySummary(),
    errorMessage: null,
    githubReviewStatus: null,
    githubReviewUrl: null
  };

  inMemoryReviews.set(key, pendingReview);
  syncToBackend(pendingReview);

  // Run asynchronously without blocking initial response
  processReview({ owner, repo, pullNumber, startedAt }).catch(err => {
    console.error('[PR Review] Async execution error:', err.message);
  });

  return pendingReview;
}

export async function getReviewForPullRequest({ owner, repo, pullNumber }) {
  const key = makeKey(owner, repo, pullNumber);
  if (inMemoryReviews.has(key)) return inMemoryReviews.get(key);

  // Fallback: try fetching from Spring Boot API backend
  try {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8080';
    const res = await fetch(`${backendUrl}/api/pr-reviews/${owner}/${repo}/${pullNumber}`);
    if (res.ok) {
      const data = await res.json();
      inMemoryReviews.set(key, data);
      return data;
    }
  } catch (err) {
    console.warn(`[PR-Fetch] Could not fetch review from backend: ${err.message}`);
  }

  return null;
}

export async function getRecentReviews(limit = 20) {
  return Array.from(inMemoryReviews.values())
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit);
}
