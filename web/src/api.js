/**
 * Thin wrapper around fetch for talking to the backend.
 *
 * URLs are relative ("/api/..."). In development Vite forwards anything under
 * /api to the Express server on port 3001 (see vite.config.js), so there's no
 * host or port to configure here.
 */

// every request path is prefixed with this
const BASE = '/api';

async function request(path, options) {
  // e.g. fetch('/api/aircraft/1', { ...options })
  const response = await fetch(BASE + path, {
    // tell the server we're sending / expecting JSON
    headers: { 'Content-Type': 'application/json' },
    // merge in method/body from the caller (overrides the header above if given)
    ...options,
  });

  // The API always responds with JSON, including on errors ({ error: "..." }).
  // parse the JSON body; if it isn't JSON, fall back to null instead of throwing
  const body = await response.json().catch(() => null);

  // response.ok is false for any 4xx / 5xx status code
  if (!response.ok) {
    // prefer the server's error message, else a generic one with the status code
    throw new Error(body?.error || `Request failed (${response.status})`);
  }
  // success -> hand the parsed object back to the caller
  return body;
}

/** Fetch the list of all aircraft (id, tailNumber, model, ...). */
export function listAircraft() {
  return request('/aircraft');
}

/** Fetch the dashboard payload for one aircraft. */
export function getAircraft(id) {
  // GET is fetch's default method, so no options object is needed
  return request(`/aircraft/${id}`);
}

/**
 * Log a revenue amount (in WHOLE CENTS) for one aircraft.
 * Returns { revenueEventId, distribution, summary }.
 */
export function logRevenue(id, amountCents, memo) {
  return request(`/aircraft/${id}/revenue`, {
    method: 'POST',
    // serialize the payload object to a JSON string for the request body
    body: JSON.stringify({ amountCents, memo }),
  });
}

/* --- Challenge 2: Fleet Lease Tracker ------------------------------- */

/** Fetch the fleet: each aircraft + its active lease + computed status. */
export function getFleet() {
  return request('/fleet');
}

/** Fetch the lessee airlines (for the reassign dropdown). */
export function getAirlines() {
  return request('/airlines');
}

/**
 * Assign or reassign an aircraft's lease. Returns { fleet } (the fresh list).
 * `lease` is { airlineId, startDate, endDate } — dates as 'YYYY-MM-DD'.
 */
export function assignLease(id, lease) {
  return request(`/aircraft/${id}/lease`, {
    method: 'PATCH',
    body: JSON.stringify(lease),
  });
}

/** End an aircraft's active lease (mark it available). Returns { fleet }. */
export function endLease(id) {
  return request(`/aircraft/${id}/lease`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'ended' }),
  });
}
