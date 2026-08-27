/**
 * Write path for aircraft lease assignments (Challenge 2).
 *
 * The rule is "at most one active lease per aircraft". Reassigning therefore
 * means: end the current active lease and open a new one — done in a single
 * transaction so the aircraft is never briefly double-leased or lease-less.
 */

import db from './db.js';

const activeLeaseStmt = db.prepare(
  `SELECT id FROM lease WHERE aircraft_id = ? AND status = 'active'`,
);
const endLeaseStmt = db.prepare(`UPDATE lease SET status = 'ended' WHERE id = ?`);
const insertLeaseStmt = db.prepare(
  `INSERT INTO lease (aircraft_id, airline_id, start_date, end_date)
   VALUES (@aircraftId, @airlineId, @startDate, @endDate)`,
);
const airlineExistsStmt = db.prepare(`SELECT 1 FROM airline WHERE id = ?`);

/**
 * Assign (or reassign) an aircraft's lease.
 *
 * @param {number} aircraftId
 * @param {{ airlineId: number, startDate: string, endDate: string }} input
 * @returns {number} the new lease id
 * @throws {Error} `.code`: 'BAD_AIRLINE' | 'BAD_DATES'
 */
export function assignLease(aircraftId, { airlineId, startDate, endDate }) {
  if (!airlineExistsStmt.get(airlineId)) {
    const err = new Error(`no airline with id ${airlineId}`);
    err.code = 'BAD_AIRLINE';
    throw err;
  }
  if (endDate < startDate) {
    const err = new Error('endDate must be on or after startDate');
    err.code = 'BAD_DATES';
    throw err;
  }

  const write = db.transaction(() => {
    const current = activeLeaseStmt.get(aircraftId);
    if (current) endLeaseStmt.run(current.id);
    return insertLeaseStmt.run({ aircraftId, airlineId, startDate, endDate })
      .lastInsertRowid;
  });
  return write();
}

/**
 * End an aircraft's active lease (mark the aircraft available again).
 *
 * @param {number} aircraftId
 * @throws {Error} `.code === 'NO_LEASE'` if there is nothing active to end.
 */
export function endLease(aircraftId) {
  const current = activeLeaseStmt.get(aircraftId);
  if (!current) {
    const err = new Error(`aircraft ${aircraftId} has no active lease`);
    err.code = 'NO_LEASE';
    throw err;
  }
  endLeaseStmt.run(current.id);
}
