/**
 * Logging revenue and distributing it to shareholders.
 *
 * This module owns the WRITE path for the ledger:
 *   1. load the aircraft's ownership stakes,
 *   2. run the pure payout calculation (distribution.js),
 *   3. write one revenue_event row + one payout row per shareholder,
 *      all inside a single transaction.
 */

// the shared SQLite connection
import db from './db.js';
// the pure payout math
import { distributeRevenue } from './distribution.js';

// Prepared statements: SQL compiled once here, then executed many times with
// different values. Faster, and it separates the query from the data.

// load every ownership stake for one aircraft
const holdingsStmt = db.prepare(`
  SELECT investor_id AS investorId, basis_points AS basisPoints
  FROM holding
  WHERE aircraft_id = ?
  ORDER BY basis_points DESC, investor_id
`);

// insert one revenue event (@name = named parameters, passed as an object)
const insertRevenueStmt = db.prepare(`
  INSERT INTO revenue_event (aircraft_id, amount_cents, memo)
  VALUES (@aircraftId, @amountCents, @memo)
`);

// insert one payout row for one investor
const insertPayoutStmt = db.prepare(`
  INSERT INTO payout (revenue_event_id, investor_id, amount_cents, basis_points_at_time)
  VALUES (@revenueEventId, @investorId, @amountCents, @basisPoints)
`);

/**
 * Record a revenue amount for an aircraft and pay it out to its shareholders.
 *
 * @param {number} aircraftId
 * @param {{ amountCents: number, memo?: string|null }} input
 * @returns {{ revenueEventId: number, distribution: object }}
 * @throws {Error} with `.code === 'NO_HOLDINGS'` if the aircraft has no owners.
 */
export function recordRevenue(aircraftId, { amountCents, memo }) {
  // fetch every ownership stake for this aircraft (array of rows)
  const holdings = holdingsStmt.all(aircraftId);
  // no owners -> nobody to pay; build a tagged error the route layer maps to HTTP 409
  if (holdings.length === 0) {
    const err = new Error(`aircraft ${aircraftId} has no shareholders to pay`);
    // custom marker checked in index.js's error handler
    err.code = 'NO_HOLDINGS';
    throw err;
  }

  // Step 6: pure calculation, no database involved.
  // -> { revenueCents, distributedCents, retainedCents, allocations }
  const distribution = distributeRevenue(amountCents, holdings);

  // db.transaction(fn) makes every write inside fn succeed together or not at
  // all — you can never end up with a revenue_event that has missing payouts.
  const write = db.transaction(() => {
    // insert the event, then read back the id SQLite auto-assigned to it
    const revenueEventId = insertRevenueStmt.run({
      // -> @aircraftId
      aircraftId,
      // -> @amountCents
      amountCents,
      // -> @memo; use null when memo is null/undefined
      memo: memo ?? null,
    }).lastInsertRowid;

    // one payout row per investor in the split
    for (const alloc of distribution.allocations) {
      insertPayoutStmt.run({
        // link the payout back to the event above
        revenueEventId,
        // who is being paid
        investorId: alloc.investorId,
        // how much (already whole cents)
        amountCents: alloc.amountCents,
        // Snapshot the stake used for THIS payout, so history stays correct
        // even if ownership changes later.
        basisPoints: alloc.basisPoints,
      });
    }

    // value returned out of the transaction
    return revenueEventId;
  });

  // write() runs the transaction and returns the new event id
  return { revenueEventId: write(), distribution };
}
