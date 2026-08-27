# Jet Centrum — Aviation Commerce Core

A technical-assessment prototype. Two features behind one UI, with a switcher at the top:

| # | Feature | What it does |
|---|---------|--------------|
| **1** | **Dividend Ledger** | Splits charter revenue between an aircraft's fractional owners, by ownership stake. Every payout is a permanent ledger entry. |
| **2** | **Fleet & Leases** | Shows which aircraft are leased to which airline and until when. Flags leases expiring within 90 days. |

Built for **clean logic and a clear architecture**, not visual polish.

---

## Architecture

Three parts, one direction of dependency. The browser never touches the database — every
rule lives on the server.

```
web  (React + Vite, :5173)  ──HTTP / JSON──▶  server  (Node + Express, :3001)  ──SQL──▶  SQLite file
  shows data, takes input          validates, calculates, owns all writes         stores the ledger
  no business logic                the single source of truth                     survives restart
```

**Why:** the browser can't be trusted with money math (dev-tools can change it), and
browser memory doesn't survive a refresh. So calculations and storage live on the server.

**The server has the same shape for both features:**

| Layer | Job |
|-------|-----|
| **Route** (`index.js`) | validate the request, call a module, return JSON |
| **Write path** (`revenue.js`, `lease.js`) | "action = calculate + save"; every multi-row write is one transaction |
| **Read model** (`aircraft.js`, `fleet.js`) | the SQL each screen needs, as a plain object |
| **Pure rule** (`distribution.js`, `leaseStatus.js`) | one calculation, no DB, no framework — easy to test |

**The frontend:** `App` only tracks which feature is showing. Each screen loads its own
data. Components take props and render — no fetching in them. After any change, the server
returns the fresh data and React re-renders.

---

## Stack — and why

| Choice | Why |
|--------|-----|
| **React + Vite** | React is the role's stated preference and the biggest ecosystem. Vite is the modern default for a plain React app. |
| **Node + Express** | Stated backend preference; one language across the stack; Express is minimal and universally known. |
| **SQLite** (`better-sqlite3`) | Zero setup — runs on `clone` + `install`. Still a real relational DB (foreign keys, transactions), so the integrity story matches PostgreSQL. |
| **Plain JavaScript** | Faster for a short build. The money math is protected by unit tests instead of types. |

**Not used:** Next.js (want a separate API), MongoDB (data is relational), Redux / a router
(two screens, simple state).

**Production path:** SQLite → PostgreSQL (same schema) · JS → TypeScript · Express → NestJS.

---

## Data conventions

No floating point anywhere:

- **Money** = integer **cents** (`1250000` = $12,500.00)
- **Ownership** = integer **basis points** (`5000` = 50%)
- **Dates** = ISO text `YYYY-MM-DD`

---

## Feature 1 — Dividend Ledger

**Flow:** admin picks an aircraft → sees owners and their total payouts → types a revenue
amount → server splits it by stake, saves it, returns the updated dashboard → screen updates.

**Tables**

```
aircraft ─┬─ holding (basis_points) ─┬─ investor
          │                          │
          └─ revenue_event ─── payout (amount_cents, basis_points_at_time)   ← the ledger
```

**`aircraft`** — one physical asset.

| Column | Type | Notes |
|--------|------|-------|
| `id` | int, PK | |
| `tail_number` | text, **unique** | registration, e.g. `N123JC` |
| `model` | text | e.g. `Global 7500` |
| `manufacturer` | text | e.g. `Bombardier` |
| `serial_number` | text, nullable | |

**`investor`** — a person/entity. One row even if they own stakes in several aircraft.

| Column | Type | Notes |
|--------|------|-------|
| `id` | int, PK | |
| `name` | text | |

**`holding`** — links an investor to an aircraft with an ownership stake.

| Column | Type | Notes |
|--------|------|-------|
| `id` | int, PK | |
| `aircraft_id` | int → `aircraft.id` | |
| `investor_id` | int → `investor.id` | |
| `basis_points` | int, `CHECK 0 < bp ≤ 10000` | the stake; `5000` = 50%. The app also checks the **sum** per aircraft ≤ 10000. |
| | **unique** `(aircraft_id, investor_id)` | no double-recording an owner on one aircraft |

**`revenue_event`** — one logged charter revenue amount.

| Column | Type | Notes |
|--------|------|-------|
| `id` | int, PK | |
| `aircraft_id` | int → `aircraft.id` | |
| `amount_cents` | int, `CHECK > 0` | whole cents; `$50,000` → `5000000` |
| `memo` | text, nullable | free-text note |
| `created_at` | text | ISO timestamp, defaults to `now` |

**`payout`** — the ledger. One row per investor per revenue event. **Append-only** — rows
are only ever inserted, never updated. An owner's balance is `SUM(amount_cents)` for their
rows, computed on read, so it can't drift or corrupt.

| Column | Type | Notes |
|--------|------|-------|
| `id` | int, PK | |
| `revenue_event_id` | int → `revenue_event.id` | |
| `investor_id` | int → `investor.id` | |
| `amount_cents` | int, `CHECK ≥ 0` | this owner's cut of that revenue event |
| `basis_points_at_time` | int | the stake used for **this** calculation, snapshotted — so past payouts stay correct if ownership later changes |

*Indexes:* `holding(aircraft_id)`, `revenue_event(aircraft_id)`, `payout(investor_id)`,
`payout(revenue_event_id)`.

**The rule — `distribution.js`** (`distributeRevenue(revenueCents, holdings)`)

- Each owner's cut = `revenue × basisPoints / 10000`, in whole cents.
- Leftover cents from rounding go to the largest fractional shares first (largest-remainder
  method), with fixed tie-breakers — so payouts **always sum to the revenue exactly** and the
  result is deterministic.
- Covered by 9 unit tests, including a 500-run random check that nothing is ever lost.

**API**

| Method | Path | Body |
|--------|------|------|
| `GET` | `/api/aircraft` | — |
| `GET` | `/api/aircraft/:id` | — |
| `POST` | `/api/aircraft/:id/revenue` | `{ amountCents, memo? }` → returns the fresh dashboard |

---

## Feature 2 — Fleet Lease Tracker

**Flow:** the grid shows every aircraft, its lessee airline, and lease dates, with a status
badge. **Manage** on a row opens an inline editor to assign, reassign, or end a lease.

| Badge | Meaning |
|-------|---------|
| On lease | ends more than 90 days out |
| Expiring soon | ends within 90 days |
| Expired | end date passed |
| Available | no active lease |

**Tables** — reuses `aircraft` unchanged, adds two:

```
airline ─── lease (start_date, end_date, status) ─── aircraft
```

**`airline`** — a lessee client.

| Column | Type | Notes |
|--------|------|-------|
| `id` | int, PK | |
| `name` | text, **unique** | e.g. `Cathay Pacific` |
| `country` | text, nullable | e.g. `Hong Kong` |

**`lease`** — one leasing agreement. The **junction table** linking aircraft ↔ airline
(the "relational structure" the brief asks for). It's a table, not columns on `aircraft`,
so an aircraft keeps a **lease history** and can be re-leased.

| Column | Type | Notes |
|--------|------|-------|
| `id` | int, PK | |
| `aircraft_id` | int → `aircraft.id` | |
| `airline_id` | int → `airline.id` | |
| `start_date` | text | `YYYY-MM-DD` |
| `end_date` | text, `CHECK ≥ start_date` | `YYYY-MM-DD` |
| `status` | text, `CHECK IN ('active','ended')` | defaults to `active` |

The app enforces **one active lease per aircraft**: reassigning marks the current lease
`ended` and inserts the new one in **one transaction**. *Index:* `lease(aircraft_id)`.

**The rule — `leaseStatus.js`** (`classifyLease(endDate)`)

- Returns `expired` / `expiring-soon` (≤ 90 days) / `ok`.
- Computed on the **server**; the UI only picks a colour.
- Covered by 7 unit tests (the 90-day and 0-day boundaries, past dates, bad input).

**API**

| Method | Path | Body |
|--------|------|------|
| `GET` | `/api/fleet` | — (each row includes the computed status) |
| `GET` | `/api/airlines` | — |
| `PATCH` | `/api/aircraft/:id/lease` | `{ airlineId, startDate, endDate }` or `{ status: "ended" }` |

**How it fits:** Feature 2 was **added without changing a line of Feature 1.** Same four
layers (route → write path → read model → pure rule), same database connection and seed
script, same frontend `api.js` and styling. `App` just renders one screen or the other.
That's the payoff of the layering — the second feature was cheap to add.

---

## Running it

Requires Node.js 20+.

```bash
git clone https://github.com/untari/fractional-ledger.git
cd fractional-ledger

npm run setup    # install everything
npm run seed     # create + fill the database
npm run dev      # start API + web together
```

Open <http://localhost:5173>.

| Command | Does |
|---------|------|
| `npm run dev` | run API + web together |
| `npm test` | backend unit tests (16 — the two pure rules) |
| `npm run seed` | reset the database to the demo state |
| `npm --prefix server run peek` | print every database table |

**Demo data:** 4 aircraft, 6 investors, 3 airlines, 3 leases — arranged so Feature 2 shows
all four badge states.

If `/api/aircraft/1` 404s after pulling new code, the schema changed:
`rm -f server/ledger.db* && npm run seed`.

---

## What I'd do next

PostgreSQL + migrations · TypeScript · auth on the write endpoints · a revenue-history view ·
deploy to Render with CI running the tests.
