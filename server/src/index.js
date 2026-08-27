/**
 * The API server.
 *
 * Right now it does exactly one thing: answer a health check, so we can confirm
 * the server starts and is reachable from the browser. The ledger routes
 * (read the asset, log revenue, etc.) are added in later steps, one per commit.
 */

import express from 'express';
import cors from 'cors';

import { getAircraftSummary } from './aircraft.js';

// The port the API listens on.
// 3001 keeps it clear of Vite's dev server, which uses 5173 for the web app.
// `process.env.PORT` lets a hosting provider override this in production.
const PORT = process.env.PORT || 3001;

const app = express();

/* ------------------------------------------------------------------ *
 * Middleware — code that runs on every request before it hits a route
 * ------------------------------------------------------------------ */

// During development the web app (localhost:5173) and this API (localhost:3001)
// are different "origins", and browsers block cross-origin requests by default.
// CORS tells the browser it's allowed to call this API.
app.use(cors());

// Parse JSON request bodies so route handlers can read `req.body`.
app.use(express.json());

/* ------------------------------------------------------------------ *
 * Routes
 * ------------------------------------------------------------------ */

/**
 * GET /api/health
 * A trivial endpoint to verify the server is up.
 * Try it:  curl http://localhost:3001/api/health
 */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'fractional-ledger-api' });
});

/**
 * GET /api/aircraft/:id
 * The dashboard payload for one aircraft: the asset, its shareholders (with
 * ownership % and accumulated payout), and revenue totals.
 * Try it:  curl http://localhost:3001/api/aircraft/1
 */
app.get('/api/aircraft/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res
      .status(400)
      .json({ error: 'aircraft id must be a positive integer' });
  }

  const summary = getAircraftSummary(id);
  if (!summary) {
    return res.status(404).json({ error: `no aircraft with id ${id}` });
  }

  res.json(summary);
});

/* ------------------------------------------------------------------ *
 * Start listening
 * ------------------------------------------------------------------ */

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
