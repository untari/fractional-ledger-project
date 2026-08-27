/**
 * Payout distribution — the core domain logic.
 *
 * Given an amount of flight revenue and the investors' ownership stakes, work
 * out how many cents each investor receives. Two hard guarantees:
 *
 *   1. Every value is an integer number of cents. No floating point anywhere —
 *      floats lose precision, and losing precision on money is unacceptable.
 *
 *   2. The cents handed out never exceed the revenue, and when the stakes add
 *      up to 100% they add up to the revenue EXACTLY. No cent is invented or
 *      lost to rounding.
 *
 * Rounding uses the "largest remainder method":
 *   - give every investor their whole-cent share (rounding down),
 *   - then hand the few leftover cents out one at a time, starting with the
 *     investor whose exact share was closest to the next whole cent.
 */

// 10,000 basis points = 100.00%. Ownership is stored in basis points so the
// math stays on whole integers (5000 = 50%, 1250 = 12.5%).
const FULL_OWNERSHIP_BP = 10_000;

/**
 * @param {number} revenueCents
 *   The revenue to distribute, in whole cents. $50,000.00 -> 5000000.
 * @param {Array<{investorId: number, basisPoints: number}>} holdings
 *   One entry per investor with a stake in this aircraft.
 * @returns {{
 *   revenueCents: number,
 *   distributedCents: number,
 *   retainedCents: number,
 *   allocations: Array<{investorId: number, basisPoints: number, amountCents: number}>
 * }}
 *   `distributedCents` is what reached investors; `retainedCents` is the part
 *   of the revenue matching any unallocated ownership (stakes summing below
 *   100%). `distributedCents + retainedCents === revenueCents` always.
 */
export function distributeRevenue(revenueCents, holdings) {
  // ---- validate input ----------------------------------------------------
  if (!Number.isInteger(revenueCents) || revenueCents < 0) {
    throw new Error('revenueCents must be a non-negative integer');
  }

  const totalBasisPoints = holdings.reduce((sum, h) => sum + h.basisPoints, 0);
  if (totalBasisPoints > FULL_OWNERSHIP_BP) {
    throw new Error(
      `ownership stakes total ${totalBasisPoints} basis points, over 100%`,
    );
  }

  // ---- step 1: whole-cent share for each investor ----------------------
  // Exact share = revenueCents * basisPoints / 10000.
  //   whole part  -> paid immediately
  //   `remainder` -> the fractional part, kept as an integer numerator
  //                  (numerator % 10000) so we never touch a float. Used only
  //                  to rank who is most "owed" a leftover cent.
  const rows = holdings.map((h) => {
    const numerator = revenueCents * h.basisPoints; // integer
    return {
      investorId: h.investorId,
      basisPoints: h.basisPoints,
      amountCents: Math.floor(numerator / FULL_OWNERSHIP_BP),
      remainder: numerator % FULL_OWNERSHIP_BP,
    };
  });

  // ---- step 2: how many cents should reach investors in total ---------
  const targetCents = Math.floor(
    (revenueCents * totalBasisPoints) / FULL_OWNERSHIP_BP,
  );
  const wholeCentsPaid = rows.reduce((sum, r) => sum + r.amountCents, 0);
  const leftover = targetCents - wholeCentsPaid; // always 0 .. rows.length-1

  // ---- step 3: distribute the leftover cents, largest remainder first --
  // Tie-breakers (bigger stake, then lower id) make the output deterministic:
  // the same inputs always produce the exact same allocation.
  const ranked = [...rows].sort(
    (a, b) =>
      b.remainder - a.remainder ||
      b.basisPoints - a.basisPoints ||
      a.investorId - b.investorId,
  );
  for (let i = 0; i < leftover; i += 1) {
    ranked[i].amountCents += 1;
  }

  // ---- result --------------------------------------------------------
  const distributedCents = rows.reduce((sum, r) => sum + r.amountCents, 0);
  return {
    revenueCents,
    distributedCents,
    retainedCents: revenueCents - distributedCents,
    allocations: rows.map(({ investorId, basisPoints, amountCents }) => ({
      investorId,
      basisPoints,
      amountCents,
    })),
  };
}
