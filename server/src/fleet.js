/**
 * Data access for the fleet lease tracker (Challenge 2).
 *
 * Reads the aircraft list joined to their *active* lease and lessee airline,
 * and runs each row through classifyLease() so the API returns the status the
 * UI needs (ok / expiring-soon / expired) already computed on the server.
 */

import db from './db.js';
import { classifyLease } from './leaseStatus.js';

// Every aircraft, LEFT JOINed to its active lease (so unleased aircraft still
// appear) and the lessee airline.
const fleetStmt = db.prepare(`
  SELECT
    a.id,
    a.tail_number AS tailNumber,
    a.model,
    a.manufacturer,
    l.id          AS leaseId,
    al.id         AS airlineId,
    al.name       AS lessee,
    l.start_date  AS startDate,
    l.end_date    AS endDate
  FROM aircraft a
  LEFT JOIN lease   l  ON l.aircraft_id = a.id AND l.status = 'active'
  LEFT JOIN airline al ON al.id = l.airline_id
  ORDER BY a.tail_number
`);

const airlinesStmt = db.prepare(
  `SELECT id, name, country FROM airline ORDER BY name`,
);

/**
 * @returns {Array<{
 *   id, tailNumber, model, manufacturer,
 *   lease: null | { leaseId, lessee, startDate, endDate,
 *                   daysUntilExpiry, status }
 * }>}
 */
export function listFleet() {
  return fleetStmt.all().map((row) => ({
    id: row.id,
    tailNumber: row.tailNumber,
    model: row.model,
    manufacturer: row.manufacturer,
    lease:
      row.leaseId == null
        ? null
        : {
            leaseId: row.leaseId,
            airlineId: row.airlineId,
            lessee: row.lessee,
            startDate: row.startDate,
            endDate: row.endDate,
            ...classifyLease(row.endDate), // -> { daysUntilExpiry, status }
          },
  }));
}

/** Every airline, for the reassign dropdown. */
export function listAirlines() {
  return airlinesStmt.all();
}
