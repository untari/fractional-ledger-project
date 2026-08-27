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
