/**
 * The API server.
 *
 * Routes:
 *   GET  /api/health                  liveness check
 *   GET  /api/aircraft/:id            dashboard payload for one aircraft
 *   POST /api/aircraft/:id/revenue    log revenue and distribute it
 */

import express from 'express';
import cors from 'cors';

import { getAircraftSummary } from './aircraft.js';
import { recordRevenue } from './revenue.js';

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

/**
 * POST /api/aircraft/:id/revenue
 * Body: { "amountCents": 5000000, "memo": "NYC-London charter" }
 *
 * Money crosses this boundary as whole cents — never a decimal — so no
 * precision is lost in transit. The frontend converts the typed dollar amount.
 *
 * On success (201): the new revenue event id, the calculated split, and the
 * refreshed dashboard payload so the client can replace its state wholesale.
 *
 * Try it:
 *   curl -X POST http://localhost:3001/api/aircraft/1/revenue \
 *     -H 'Content-Type: application/json' \
 *     -d '{"amountCents":5000000,"memo":"NYC-London charter"}'
 */
app.post('/api/aircraft/:id/revenue', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res
      .status(400)
      .json({ error: 'aircraft id must be a positive integer' });
  }

  const { amountCents, memo } = req.body ?? {};

  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    return res.status(400).json({
      error: 'amountCents must be a positive integer (whole cents)',
    });
  }
  if (memo != null && typeof memo !== 'string') {
    return res.status(400).json({ error: 'memo must be a string' });
  }

  if (!getAircraftSummary(id)) {
    return res.status(404).json({ error: `no aircraft with id ${id}` });
  }

  const { revenueEventId, distribution } = recordRevenue(id, {
    amountCents,
    memo: memo?.trim() || null,
  });

  res.status(201).json({
    revenueEventId,
    distribution,
    summary: getAircraftSummary(id), // refreshed dashboard state
  });
});

/* ------------------------------------------------------------------ *
 * Error handling
 * ------------------------------------------------------------------ */

// Any request that matched no route above.
app.use((req, res) => {
  res.status(404).json({ error: 'not found' });
});

// Any error thrown inside a route handler lands here. Without this, Express
// would return an HTML error page; we want JSON.
// eslint-disable-next-line no-unused-vars -- Express needs the 4-arg signature
app.use((err, req, res, next) => {
  if (err.code === 'NO_HOLDINGS') {
    return res.status(409).json({ error: err.message });
  }
  console.error(err);
  res.status(500).json({ error: 'internal server error' });
});

/* ------------------------------------------------------------------ *
 * Start listening
 * ------------------------------------------------------------------ */

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
