/**
 * Data access for a single aircraft.
 *
 * These functions are the only place that knows the SQL for reading an
 * aircraft's dashboard state. Route handlers call them and deal purely with
 * plain objects — they never touch the database directly.
 */

import db from './db.js';

// Prepared statements are compiled once here and reused on every call — the
// standard efficient pattern with better-sqlite3.

const aircraftRowStmt = db.prepare(`
  SELECT id, tail_number, model, manufacturer, serial_number
  FROM aircraft
  WHERE id = ?
`);

// Each shareholder, their stake, and the sum of every payout they've received
// FROM THIS AIRCRAFT's revenue events. The correlated subquery keeps the total
// scoped to this aircraft (an investor could hold shares in several).
const shareholdersStmt = db.prepare(`
  SELECT
    i.id           AS investorId,
    i.name         AS name,
    h.basis_points AS basisPoints,
    COALESCE((
      SELECT SUM(p.amount_cents)
      FROM payout p
      JOIN revenue_event re ON re.id = p.revenue_event_id
      WHERE p.investor_id = i.id
        AND re.aircraft_id = h.aircraft_id
    ), 0) AS totalPaidCents
  FROM holding h
  JOIN investor i ON i.id = h.investor_id
  WHERE h.aircraft_id = ?
  ORDER BY h.basis_points DESC, i.name
`);

const revenueTotalsStmt = db.prepare(`
  SELECT
    COALESCE(SUM(amount_cents), 0) AS revenueLoggedCents,
    COUNT(*)                       AS revenueEventCount
  FROM revenue_event
  WHERE aircraft_id = ?
`);

/**
 * Build the full dashboard payload for one aircraft.
 *
 * @param {number} aircraftId
 * @returns {object | null}  null if no aircraft has that id.
 */
export function getAircraftSummary(aircraftId) {
  const row = aircraftRowStmt.get(aircraftId);
  if (!row) return null;

  const shareholders = shareholdersStmt.all(aircraftId).map((s) => ({
    investorId: s.investorId,
    name: s.name,
    basisPoints: s.basisPoints,
    ownershipPercent: s.basisPoints / 100, // 5000 -> 50
    totalPaidCents: s.totalPaidCents,
  }));

  const revenue = revenueTotalsStmt.get(aircraftId);
  const ownedBasisPoints = shareholders.reduce((sum, s) => sum + s.basisPoints, 0);
  const distributedCents = shareholders.reduce((sum, s) => sum + s.totalPaidCents, 0);

  return {
    aircraft: {
      id: row.id,
      tailNumber: row.tail_number,
      model: row.model,
      manufacturer: row.manufacturer,
      serialNumber: row.serial_number,
    },
    shareholders,
    totals: {
      ownedBasisPoints,
      ownedPercent: ownedBasisPoints / 100,
      revenueLoggedCents: revenue.revenueLoggedCents,
      revenueEventCount: revenue.revenueEventCount,
      distributedCents,
    },
  };
}
