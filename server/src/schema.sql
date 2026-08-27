-- ============================================================================
--  Database schema for the Fractional Share & Dividend Ledger
-- ============================================================================
--  Applied automatically every time the server starts (see db.js).
--  Every statement uses "IF NOT EXISTS", so running it repeatedly is safe and
--  never destroys existing data.
--
--  Two deliberate modelling choices, both to keep money math exact:
--    * Ownership is stored in BASIS POINTS  -> integer, 5000 = 50.00%
--    * Money is stored in CENTS             -> integer, 1250000 = $12,500.00
--  No column in this database is a floating-point number.
-- ============================================================================


-- ----------------------------------------------------------------------------
--  aircraft — one physical asset. The prototype displays one; schema allows many.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS aircraft (
  -- auto-incrementing row id (SQLite fills it in)
  id            INTEGER PRIMARY KEY,
  -- registration, e.g. "N123JC"; UNIQUE = no two aircraft can share one
  tail_number   TEXT    NOT NULL UNIQUE,
  -- e.g. "Global 7500"
  model         TEXT    NOT NULL,
  -- e.g. "Bombardier"
  manufacturer  TEXT    NOT NULL,
  -- optional (no NOT NULL), so it may be missing
  serial_number TEXT
);


-- ----------------------------------------------------------------------------
--  investor — a person or entity that can hold shares in an aircraft.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS investor (
  -- auto-assigned id
  id   INTEGER PRIMARY KEY,
  -- display name, always required
  name TEXT    NOT NULL
);


-- ----------------------------------------------------------------------------
--  holding — links an investor to an aircraft with an ownership stake.
--
--  basis_points: 1/100th of one percent. 5000 = 50.00%, 1250 = 12.50%.
--  CHECK keeps a single stake sane (0 < bp <= 10000). The application layer
--  additionally checks that the SUM of an aircraft's stakes never exceeds 10000.
--  UNIQUE stops the same investor being recorded twice for one aircraft.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS holding (
  -- auto-assigned id
  id           INTEGER PRIMARY KEY,
  -- which aircraft this stake is in (the id must exist in aircraft)
  aircraft_id  INTEGER NOT NULL REFERENCES aircraft(id),
  -- which investor owns the stake (the id must exist in investor)
  investor_id  INTEGER NOT NULL REFERENCES investor(id),
  -- the stake size; the database itself rejects <= 0 or > 100%
  basis_points INTEGER NOT NULL CHECK (basis_points > 0 AND basis_points <= 10000),
  -- one row per (aircraft, investor) pair
  UNIQUE (aircraft_id, investor_id)
);


-- ----------------------------------------------------------------------------
--  revenue_event — one logged amount of flight revenue for an aircraft.
--
--  amount_cents: integer cents. "$50,000.00" is stored as 5000000.
--  created_at: ISO-ish timestamp, filled in by the database.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS revenue_event (
  -- auto-assigned id
  id           INTEGER PRIMARY KEY,
  -- which aircraft earned this revenue
  aircraft_id  INTEGER NOT NULL REFERENCES aircraft(id),
  -- the amount, in whole cents; the database rejects zero/negative
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  -- optional free-text note ("NYC-London charter")
  memo         TEXT,
  -- timestamp; if not supplied on insert, the database writes "now"
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);


-- ----------------------------------------------------------------------------
--  payout — THE LEDGER. One row per investor per revenue event.
--
--  This table is APPEND-ONLY. An investor's accumulated payout is calculated by
--  summing amount_cents here; it is never stored as its own column and mutated.
--  That is what makes the balance impossible to corrupt and fully auditable.
--
--  basis_points_at_time: the ownership stake used for THIS calculation, copied
--  in when the row is written. If ownership changes later, past payouts stay
--  correct and explainable.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payout (
  -- auto-assigned id
  id                   INTEGER PRIMARY KEY,
  -- which revenue event this payout came from
  revenue_event_id     INTEGER NOT NULL REFERENCES revenue_event(id),
  -- who was paid
  investor_id          INTEGER NOT NULL REFERENCES investor(id),
  -- how much, in whole cents (0 is allowed, negative is not)
  amount_cents         INTEGER NOT NULL CHECK (amount_cents >= 0),
  -- the stake used for this specific calculation (a snapshot, never updated)
  basis_points_at_time INTEGER NOT NULL
);


-- ----------------------------------------------------------------------------
--  Indexes for the queries the API runs most often.
--  An index is a lookup structure so "find all rows where column = X" is fast
--  instead of scanning the whole table.
-- ----------------------------------------------------------------------------
-- speeds up "all holdings for aircraft N"
CREATE INDEX IF NOT EXISTS idx_holding_aircraft ON holding(aircraft_id);
-- speeds up "all revenue events for aircraft N"
CREATE INDEX IF NOT EXISTS idx_revenue_aircraft ON revenue_event(aircraft_id);
-- speeds up "all payouts to investor N"
CREATE INDEX IF NOT EXISTS idx_payout_investor  ON payout(investor_id);
-- speeds up "all payouts from revenue event N"
CREATE INDEX IF NOT EXISTS idx_payout_revenue   ON payout(revenue_event_id);
