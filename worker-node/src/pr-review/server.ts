import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import triggerRouter from './trigger.js';
import applyRouter from './apply.js';
import chatRouter from './chat.js';
import { getRecentReviews, getReviewForPullRequest } from './review-service.js';

export function createPrReviewApp() {
  const app = express();

  app.use(cors());
  app.use(bodyParser.json({ limit: '10mb' }));

  // Routes directly matching the PR analysis capabilities
  app.use('/github/trigger', triggerRouter);
  app.use('/github/apply-fix', applyRouter);
  app.use('/github/chat', chatRouter);

  app.get('/reviews', async (req, res) => {
    try {
      const reviews = await getRecentReviews(20);
      res.json(reviews);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/reviews/:owner/:repo/:number', async (req, res) => {
    try {
      const { owner, repo, number } = req.params;
      const review = await getReviewForPullRequest({ owner, repo, pullNumber: Number(number) });
      if (!review) return res.status(404).json({ error: 'Review not found' });
      res.json(review);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'forgeflow-pr-review-engine' });
  });

  return app;
}

export function startPrReviewServer(port = 4005) {
  const app = createPrReviewApp();
  return app.listen(port, () => {
    console.log(`🛡️  [PR Review Engine] Running at http://localhost:${port}`);
  });
}
