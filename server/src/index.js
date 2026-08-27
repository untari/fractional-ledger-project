/**
 * The API server.
 *
 * Routes:
 *   Challenge 1 — Fractional Share & Dividend Ledger
 *     GET  /api/health                  liveness check
 *     GET  /api/aircraft                 fleet list (picker)
 *     GET  /api/aircraft/:id             dashboard payload for one aircraft
 *     POST /api/aircraft/:id/revenue     log revenue and distribute it
 *   Challenge 2 — Fleet Lease Tracker
 *     GET   /api/fleet                   aircraft + active lease + status
 *     GET   /api/airlines                lessee airlines (dropdown)
 *     PATCH /api/aircraft/:id/lease      assign / reassign / end a lease
 */

// the web framework (routing + middleware)
import express from 'express';
// middleware that adds the headers browsers need for cross-origin calls
import cors from 'cors';

// Challenge 1: read path (fleet list + dashboard payload) and write path
import { getAircraftSummary, listAircraft } from './aircraft.js';
import { recordRevenue } from './revenue.js';
// Challenge 2: fleet lease tracker
import { listFleet, listAirlines } from './fleet.js';
import { assignLease, endLease } from './lease.js';

// The port the API listens on.
// 3001 keeps it clear of Vite's dev server, which uses 5173 for the web app.
// `process.env.PORT` lets a hosting provider override this in production.
const PORT = process.env.PORT || 3001;

// the application object; routes and middleware attach to it
const app = express();

/* ------------------------------------------------------------------ *
 * Middleware — code that runs on every request before it hits a route
 * ------------------------------------------------------------------ */

// During development the web app (localhost:5173) and this API (localhost:3001)
// are different "origins", and browsers block cross-origin requests by default.
// CORS tells the browser it's allowed to call this API.
app.use(cors());

// Parse JSON request bodies so route handlers can read `req.body`.
// turns the raw request body into a JS object on req.body
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
  // send back a small JSON object
  res.json({ status: 'ok', service: 'fractional-ledger-api' });
});

/**
 * GET /api/aircraft
 * Every aircraft with a short summary. Used to populate the aircraft picker.
 * Try it:  curl http://localhost:3001/api/aircraft
 */
app.get('/api/aircraft', (req, res) => {
  res.json({ aircraft: listAircraft() });
});

/**
 * GET /api/aircraft/:id
 * The dashboard payload for one aircraft: the asset, its shareholders (with
 * ownership % and accumulated payout), and revenue totals.
 * Try it:  curl http://localhost:3001/api/aircraft/1
 */
app.get('/api/aircraft/:id', (req, res) => {
  // :id arrives as a string; convert it to a number
  const id = Number(req.params.id);
  // reject "abc", "1.5", "0", "-3" etc. before touching the database
  if (!Number.isInteger(id) || id <= 0) {
    return res
      // 400 = Bad Request
      .status(400)
      .json({ error: 'aircraft id must be a positive integer' });
  }

  // ask the data layer for the payload
  const summary = getAircraftSummary(id);
  // 404 = Not Found
  if (!summary) {
    return res.status(404).json({ error: `no aircraft with id ${id}` });
  }

  // 200 OK + the dashboard payload
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
  // same id parsing as the GET route
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res
      .status(400)
      .json({ error: 'aircraft id must be a positive integer' });
  }

  // pull the two fields out; default to {} if the body is missing entirely
  const { amountCents, memo } = req.body ?? {};

  // the amount must be whole positive cents — reject decimals, zero, negatives, non-numbers
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    return res.status(400).json({
      error: 'amountCents must be a positive integer (whole cents)',
    });
  }
  // memo is optional, but if present it must be text
  if (memo != null && typeof memo !== 'string') {
    return res.status(400).json({ error: 'memo must be a string' });
  }

  // make sure the aircraft exists before we try to record revenue for it
  if (!getAircraftSummary(id)) {
    return res.status(404).json({ error: `no aircraft with id ${id}` });
  }

  // do the work: calculate the split and write it to the ledger
  const { revenueEventId, distribution } = recordRevenue(id, {
    amountCents,
    // trim whitespace; an empty string becomes null
    memo: memo?.trim() || null,
  });

  // 201 = Created
  res.status(201).json({
    // id of the new revenue_event row
    revenueEventId,
    // the calculated split (allocations, distributed/retained)
    distribution,
    // refreshed dashboard state, so the client can replace its own wholesale
    summary: getAircraftSummary(id),
  });
});

/* ------------------------------------------------------------------ *
 * Challenge 2 — Fleet Lease Tracker
 * ------------------------------------------------------------------ */

/**
 * GET /api/fleet
 * Every aircraft, its active lease (lessee + dates), and the lease status
 * (ok / expiring-soon / expired) computed on the server.
 */
app.get('/api/fleet', (req, res) => {
  res.json({ fleet: listFleet() });
});

/**
 * GET /api/airlines
 * The list of lessee airlines — used to populate the reassign dropdown.
 */
app.get('/api/airlines', (req, res) => {
  res.json({ airlines: listAirlines() });
});

/**
 * PATCH /api/aircraft/:id/lease
 * Body, one of:
 *   { "airlineId": 2, "startDate": "2026-09-01", "endDate": "2027-03-01" }
 *       -> assign or reassign (ends any current active lease, opens a new one)
 *   { "status": "ended" }
 *       -> return the aircraft (end its active lease, no replacement)
 *
 * Responds with the refreshed fleet list.
 */
app.patch('/api/aircraft/:id/lease', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res
      .status(400)
      .json({ error: 'aircraft id must be a positive integer' });
  }
  if (!getAircraftSummary(id)) {
    return res.status(404).json({ error: `no aircraft with id ${id}` });
  }

  const body = req.body ?? {};

  // { status: 'ended' } — return the aircraft
  if (body.status === 'ended') {
    endLease(id);
    return res.json({ fleet: listFleet() });
  }

  // otherwise assign / reassign
  const { airlineId, startDate, endDate } = body;
  const isIsoDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
  if (!Number.isInteger(airlineId) || !isIsoDate(startDate) || !isIsoDate(endDate)) {
    return res.status(400).json({
      error:
        'expected { airlineId:int, startDate:"YYYY-MM-DD", endDate:"YYYY-MM-DD" } or { status:"ended" }',
    });
  }

  assignLease(id, { airlineId, startDate, endDate });
  res.json({ fleet: listFleet() });
});

/* ------------------------------------------------------------------ *
 * Error handling
 * ------------------------------------------------------------------ */

// Any request that matched no route above.
app.use((req, res) => {
  // catch-all 404 in JSON form
  res.status(404).json({ error: 'not found' });
});

// Any error thrown inside a route handler lands here. Without this, Express
// would return an HTML error page; we want JSON.
// eslint-disable-next-line no-unused-vars -- Express needs the 4-arg signature
app.use((err, req, res, next) => {
  // tagged errors from the domain modules -> friendly status codes
  if (err.code === 'NO_HOLDINGS' || err.code === 'NO_LEASE') {
    return res.status(409).json({ error: err.message }); // Conflict
  }
  if (err.code === 'BAD_AIRLINE' || err.code === 'BAD_DATES') {
    return res.status(400).json({ error: err.message }); // Bad Request
  }
  // log anything unexpected for the developer
  console.error(err);
  // 500 = generic server failure
  res.status(500).json({ error: 'internal server error' });
});

/* ------------------------------------------------------------------ *
 * Start listening
 * ------------------------------------------------------------------ */

// runs once, when the server is ready to accept requests
app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
