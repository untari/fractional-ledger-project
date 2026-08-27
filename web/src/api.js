/**
 * Thin wrapper around fetch for talking to the backend.
 *
 * URLs are relative ("/api/..."). In development Vite forwards anything under
 * /api to the Express server on port 3001 (see vite.config.js), so there's no
 * host or port to configure here.
 */

const BASE = '/api';

async function request(path, options) {
  const response = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  // The API always responds with JSON, including on errors ({ error: "..." }).
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(body?.error || `Request failed (${response.status})`);
  }
  return body;
}

/** Fetch the dashboard payload for one aircraft. */
export function getAircraft(id) {
  return request(`/aircraft/${id}`);
}

/**
 * Log a revenue amount (in WHOLE CENTS) for one aircraft.
 * Returns { revenueEventId, distribution, summary }.
 */
export function logRevenue(id, amountCents, memo) {
  return request(`/aircraft/${id}/revenue`, {
    method: 'POST',
    body: JSON.stringify({ amountCents, memo }),
  });
}
