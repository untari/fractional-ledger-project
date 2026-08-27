/**
 * Lease status — the Challenge 2 domain rule.
 *
 * Given a lease end date, work out how many days remain and classify it:
 *   - 'expired'        the end date has already passed
 *   - 'expiring-soon'  ends within the next 90 days   (the brief's red flag)
 *   - 'ok'             ends more than 90 days out
 *
 * Pure function: a date string in, a small object out. No database. The clock
 * is the `today` argument — defaulted to now, but injectable so tests are
 * deterministic.
 */

const EXPIRING_SOON_DAYS = 90;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * @param {string} endDate  ISO date, 'YYYY-MM-DD'
 * @param {Date}  [today]    defaults to the current time
 * @returns {{ daysUntilExpiry: number, status: 'expired'|'expiring-soon'|'ok' }}
 */
export function classifyLease(endDate, today = new Date()) {
  if (typeof endDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    throw new Error(`endDate must be a 'YYYY-MM-DD' string, got: ${endDate}`);
  }

  // Compare both dates at UTC midnight, so the answer never depends on the
  // time of day the check runs.
  const end = Date.parse(`${endDate}T00:00:00Z`);
  const start = Date.parse(`${today.toISOString().slice(0, 10)}T00:00:00Z`);
  const daysUntilExpiry = Math.round((end - start) / MS_PER_DAY);

  let status;
  if (daysUntilExpiry < 0) status = 'expired';
  else if (daysUntilExpiry <= EXPIRING_SOON_DAYS) status = 'expiring-soon';
  else status = 'ok';

  return { daysUntilExpiry, status };
}
