/**
 * Display formatting for values that come from the API.
 *
 * The API speaks in integers: money as whole cents, ownership as basis points.
 * These helpers turn those into human strings for the screen only. The raw
 * numbers are what we keep and send back.
 */

/** 2500000  ->  "$25,000.00" */
export function formatCents(cents) {
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  });
}

/** 3750  ->  "37.5%"   (basis points are hundredths of a percent) */
export function formatBasisPoints(basisPoints) {
  return `${basisPoints / 100}%`;
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
  const cleaned = String(input).replace(/[$,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null; // digits, up to 2 decimals

  const dollars = Number(cleaned);
  if (!Number.isFinite(dollars) || dollars <= 0) return null;

  return Math.round(dollars * 100);
}
