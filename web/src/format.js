/**
 * Display formatting for values that come from the API.
 *
 * The API speaks in integers: money as whole cents, ownership as basis points.
 * These helpers turn those into human strings for the screen only. The raw
 * numbers are what we keep and send back.
 */

/** 2500000  ->  "$25,000.00" */
export function formatCents(cents) {
  // cents -> dollars, then format with US locale rules
  return (cents / 100).toLocaleString('en-US', {
    // adds the "$" and groups thousands with commas
    style: 'currency',
    // forces exactly 2 decimal places
    currency: 'USD',
  });
}

/** 3750  ->  "37.5%"   (basis points are hundredths of a percent) */
export function formatBasisPoints(basisPoints) {
  // 3750 / 100 = 37.5, then append "%"
  return `${basisPoints / 100}%`;
}

/** "2026-09-18"  ->  "18 Sep 2026"  (parsed as a plain calendar date, no TZ) */
export function formatDate(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Parse a typed dollar amount into whole cents.
 *   "50,000"    -> 5000000
 *   "$1,234.5"  -> 123450
 *   "" / "abc" / "0" / "-5"  -> null   (caller shows a validation message)
 *
 * We convert to cents here, on the way in, so the rest of the app only ever
 * handles integers — same rule as the backend.
 */
export function dollarsToCents(input) {
  // strip "$", commas and whitespace
  const cleaned = String(input).replace(/[$,\s]/g, '');
  // must be digits, optionally a "." followed by 1-2 more digits
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;

  // now safe to turn into a number
  const dollars = Number(cleaned);
  // reject NaN / Infinity and non-positive amounts
  if (!Number.isFinite(dollars) || dollars <= 0) return null;

  // dollars -> cents; round guards against float wobble (e.g. 1.1 * 100)
  return Math.round(dollars * 100);
}
