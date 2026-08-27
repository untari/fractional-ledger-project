/**
 * Unit tests for the payout calculation.
 *
 * Run with:  npm test        (from the server/ folder)
 *
 * Uses Node's built-in test runner and assert library — no extra dependency.
 */

// defines a test case
import { test } from 'node:test';
// strict assertions (=== comparisons, no type coercion)
import assert from 'node:assert/strict';

// the function under test
import { distributeRevenue } from './distribution.js';

// Convenience: pull just the cent amounts out, in investor order.
const amounts = (result) => result.allocations.map((a) => a.amountCents);

test('splits an even amount exactly', () => {
  // $1,000.00 of revenue, split 50/50
  const result = distributeRevenue(100_000, [
    { investorId: 1, basisPoints: 5000 },
    { investorId: 2, basisPoints: 5000 },
  ]);
  // each gets exactly half
  assert.deepEqual(amounts(result), [50_000, 50_000]);
  // all of it went out
  assert.equal(result.distributedCents, 100_000);
  // nothing retained
  assert.equal(result.retainedCents, 0);
});

test('splits the demo stakes (50% / 37.5% / 12.5%)', () => {
  const result = distributeRevenue(100_000, [
    { investorId: 1, basisPoints: 5000 },
    { investorId: 2, basisPoints: 3750 },
    { investorId: 3, basisPoints: 1250 },
  ]);
  // clean split, no rounding needed
  assert.deepEqual(amounts(result), [50_000, 37_500, 12_500]);
});

test('never loses a cent when the split is not exact', () => {
  // $1.00 across three equal-ish thirds. Exact shares are 33.33 / 33.33 / 33.34.
  const result = distributeRevenue(100, [
    { investorId: 1, basisPoints: 3333 },
    { investorId: 2, basisPoints: 3333 },
    { investorId: 3, basisPoints: 3334 },
  ]);
  // total is still exactly 100 cents
  assert.equal(sum(amounts(result)), 100);
  // the leftover cent went to the largest remainder
  assert.deepEqual(amounts(result), [33, 33, 34]);
});

test('one indivisible cent goes to a single investor, deterministically', () => {
  // 1 cent, 50/50. Someone has to get it; the tie-break gives it to the
  // lower investor id, and the same call always returns the same result.
  const a = distributeRevenue(1, [
    { investorId: 1, basisPoints: 5000 },
    { investorId: 2, basisPoints: 5000 },
  ]);
  // identical inputs, called a second time
  const b = distributeRevenue(1, [
    { investorId: 1, basisPoints: 5000 },
    { investorId: 2, basisPoints: 5000 },
  ]);
  // investor 1 wins the tie (lower id)
  assert.deepEqual(amounts(a), [1, 0]);
  // and it's repeatable
  assert.deepEqual(amounts(a), amounts(b));
});

test('retains the share matching unallocated ownership', () => {
  // Only 75% of the aircraft is owned; 25% of the revenue is retained.
  const result = distributeRevenue(1000, [
    { investorId: 1, basisPoints: 7500 },
  ]);
  // 75% of 1000
  assert.equal(result.distributedCents, 750);
  // the other 25%
  assert.equal(result.retainedCents, 250);
  // the two parts always add back to the input
  assert.equal(
    result.distributedCents + result.retainedCents,
    result.revenueCents,
  );
});

test('zero revenue produces zero payouts', () => {
  const result = distributeRevenue(0, [
    { investorId: 1, basisPoints: 6000 },
    { investorId: 2, basisPoints: 4000 },
  ]);
  // nothing in, nothing out
  assert.deepEqual(amounts(result), [0, 0]);
});

test('rejects invalid revenue', () => {
  // negative -> throws
  assert.throws(() => distributeRevenue(-1, []));
  // decimal -> throws
  assert.throws(() => distributeRevenue(10.5, []));
});

test('rejects ownership stakes over 100%', () => {
  // 60% + 50% = 110% -> throws
  assert.throws(() =>
    distributeRevenue(1000, [
      { investorId: 1, basisPoints: 6000 },
      { investorId: 2, basisPoints: 5000 },
    ]),
  );
});

test('property check: full ownership always sums back to the revenue', () => {
  // Try many random revenue amounts and random 100%-covering stake splits.
  for (let run = 0; run < 500; run += 1) {
    // a random amount
    const revenueCents = randomInt(1, 5_000_000);
    // random stakes that total exactly 100%
    const holdings = randomStakesSummingTo10000();

    const result = distributeRevenue(revenueCents, holdings);

    // no cent gained or lost
    assert.equal(sum(amounts(result)), revenueCents, 'payouts must sum exactly');
    // every payout is a whole, non-negative number
    assert.ok(
      amounts(result).every((c) => Number.isInteger(c) && c >= 0),
      'every payout is a non-negative integer',
    );
  }
});

// --- helpers ---------------------------------------------------------------

// add up an array of numbers
function sum(numbers) {
  return numbers.reduce((total, n) => total + n, 0);
}

// random integer in [min, max] inclusive
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Build 2–5 stakes that add up to exactly 10000 basis points.
function randomStakesSummingTo10000() {
  // how many investors this run
  const count = randomInt(2, 5);
  const stakes = [];
  // basis points still to hand out
  let remaining = 10_000;
  for (let i = 0; i < count - 1; i += 1) {
    // cap this stake so every later investor can still get at least 1 bp
    const max = remaining - (count - 1 - i);
    // this investor's random stake
    const bp = randomInt(1, max);
    stakes.push({ investorId: i + 1, basisPoints: bp });
    // subtract what we just allocated
    remaining -= bp;
  }
  // last investor takes whatever is left
  stakes.push({ investorId: count, basisPoints: remaining });
  return stakes;
}
