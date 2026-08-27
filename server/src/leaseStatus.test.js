/**
 * Unit tests for the lease-status rule.
 *
 * Run with:  npm test        (from the server/ folder)
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { classifyLease } from './leaseStatus.js';

// A fixed "now" so every case is deterministic.
const TODAY = new Date('2026-08-28T12:00:00Z');

test('a lease ending well in the future is ok', () => {
  const r = classifyLease('2027-06-01', TODAY);
  assert.equal(r.status, 'ok');
  assert.ok(r.daysUntilExpiry > 90);
});

test('a lease ending within 90 days is expiring-soon', () => {
  const r = classifyLease('2026-10-15', TODAY); // ~48 days out
  assert.equal(r.status, 'expiring-soon');
});

test('exactly 90 days out is still expiring-soon (inclusive boundary)', () => {
  const r = classifyLease('2026-11-26', TODAY);
  assert.equal(r.daysUntilExpiry, 90);
  assert.equal(r.status, 'expiring-soon');
});

test('91 days out is ok', () => {
  const r = classifyLease('2026-11-27', TODAY);
  assert.equal(r.daysUntilExpiry, 91);
  assert.equal(r.status, 'ok');
});

test('today counts as expiring-soon, not expired', () => {
  const r = classifyLease('2026-08-28', TODAY);
  assert.equal(r.daysUntilExpiry, 0);
  assert.equal(r.status, 'expiring-soon');
});

test('a past end date is expired', () => {
  const r = classifyLease('2026-08-01', TODAY);
  assert.ok(r.daysUntilExpiry < 0);
  assert.equal(r.status, 'expired');
});

test('rejects a malformed date', () => {
  assert.throws(() => classifyLease('not-a-date', TODAY));
  assert.throws(() => classifyLease('2026-8-1', TODAY));
  assert.throws(() => classifyLease(null, TODAY));
});
