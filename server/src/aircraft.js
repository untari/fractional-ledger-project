/**
 * Data access for a single aircraft.
 *
 * These functions are the only place that knows the SQL for reading an
 * aircraft's dashboard state. Route handlers call them and deal purely with
 * plain objects — they never touch the database directly.
 */

// the shared SQLite connection
import db from './db.js';

// Prepared statements are compiled once here and reused on every call — the
// standard efficient pattern with better-sqlite3.

// one aircraft, looked up by id
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
    -- investor id
    i.id           AS investorId,
    -- investor display name
    i.name         AS name,
    -- their stake in THIS aircraft
    h.basis_points AS basisPoints,
    -- COALESCE: if the subquery returns NULL (no payouts yet), use 0 instead
    COALESCE((
      -- total cents this investor has been paid...
      SELECT SUM(p.amount_cents)
      FROM payout p
      -- ...link each payout to its revenue event...
      JOIN revenue_event re ON re.id = p.revenue_event_id
      -- ...for this investor...
      WHERE p.investor_id = i.id
        -- ...but only events from THIS aircraft
        AND re.aircraft_id = h.aircraft_id
    ), 0) AS totalPaidCents
  FROM holding h
  -- pull the investor's name/id alongside the holding
  JOIN investor i ON i.id = h.investor_id
  -- only holdings in the requested aircraft
  WHERE h.aircraft_id = ?
  -- biggest owner first, then alphabetical by name
  ORDER BY h.basis_points DESC, i.name
`);

// revenue totals for one aircraft
const revenueTotalsStmt = db.prepare(`
  SELECT
    -- total revenue ever logged (0 if none)
    COALESCE(SUM(amount_cents), 0) AS revenueLoggedCents,
    -- how many revenue events
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
  // .get() -> the single matching row, or undefined
  const row = aircraftRowStmt.get(aircraftId);
  // no such aircraft -> signal "not found" to the caller
  if (!row) return null;

  // .all() -> array of rows; reshape each one for the frontend
  const shareholders = shareholdersStmt.all(aircraftId).map((s) => ({
    investorId: s.investorId,
    name: s.name,
    basisPoints: s.basisPoints,
    // 5000 -> 50 (display-friendly number)
    ownershipPercent: s.basisPoints / 100,
    totalPaidCents: s.totalPaidCents,
  }));

  // { revenueLoggedCents, revenueEventCount }
  const revenue = revenueTotalsStmt.get(aircraftId);
  // total stake allocated across all shareholders
  const ownedBasisPoints = shareholders.reduce((sum, s) => sum + s.basisPoints, 0);
  // total ever paid out across all shareholders
  const distributedCents = shareholders.reduce((sum, s) => sum + s.totalPaidCents, 0);

  return {
    // reshape snake_case DB columns into camelCase for the frontend
    aircraft: {
      id: row.id,
      tailNumber: row.tail_number,
      model: row.model,
      manufacturer: row.manufacturer,
      serialNumber: row.serial_number,
    },
    // the array built above
    shareholders,
    totals: {
      // e.g. 10000 when fully allocated
      ownedBasisPoints,
      // e.g. 100
      ownedPercent: ownedBasisPoints / 100,
      revenueLoggedCents: revenue.revenueLoggedCents,
      revenueEventCount: revenue.revenueEventCount,
      distributedCents,
    },
  };
}
