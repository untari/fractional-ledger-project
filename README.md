# Jet Centrum — Aviation Commerce Core

A technical-assessment prototype covering two challenges behind one UI:

| # | Name | What it does |
|---|------|--------------|
| **1** | **Dividend Ledger** | Tracks fractional ownership of an aircraft and distributes charter revenue to investors proportionally to their stake. Every payout is an immutable ledger entry. |
| **2** | **Fleet & Leases** | Tracks which aircraft are leased to which airline and until when. Flags any lease expiring within 90 days (or already expired). Leases can be assigned, reassigned, or ended. |

A switcher at the top of the page toggles between the two.

> Focus of the build: **clean domain logic** and a **reviewable architecture**, not visual polish.

**Contents**

- [Part A — Shared foundation](#part-a--shared-foundation) · [1. Architecture](#1-architecture) · [2. Technology choices](#2-technology-choices) · [3. Repository layout](#3-repository-layout) · [4. Data model conventions](#4-data-model-conventions)
- [Part B — Challenge 1: Dividend Ledger](#part-b--challenge-1-dividend-ledger)
- [Part C — Challenge 2: Fleet Lease Tracker](#part-c--challenge-2-fleet-lease-tracker)
- [Part D — Running it](#part-d--running-it) · [Testing](#8-testing) · [Setup](#9-setup) · [What I'd do next](#10-what-id-do-next)

---
---

# Part A — Shared foundation

*Everything in Part A is common to both challenges. Parts B and C are each self-contained.*

## 1. Architecture

Three parts, each with one responsibility, and **one direction of dependency** — the
browser never reaches the database; every rule lives on the server.

```
┌─────────────────────────────────────────────────────────┐
│  web/   React + Vite            (browser, dev port 5173) │
│  • renders data, collects input                          │
│  • NO calculations, NO business rules                    │
└───────────────────────┬─────────────────────────────────┘
                        │  HTTP + JSON   (relative /api/*, Vite proxies to :3001)
                        ▼
┌─────────────────────────────────────────────────────────┐
│  server/   Node + Express            (API, port 3001)    │
│  • validates every request                               │
│  • calculates payouts & lease status                     │
│  • wraps multi-row writes in transactions                │
│  • the single source of truth for "what happened"        │
└───────────────────────┬─────────────────────────────────┘
                        │  SQL + transactions (better-sqlite3, synchronous)
                        ▼
┌─────────────────────────────────────────────────────────┐
│  SQLite file   server/ledger.db                          │
│  • append-only payout ledger; balances are derived       │
│  • survives browser refresh and server restart           │
└─────────────────────────────────────────────────────────┘
```

### Why this split

| Concern | How the architecture answers it |
|---------|--------------------------------|
| **Trust** | Calculations run server-side, where a browser dev-tools user can't alter them. The UI only displays what the API returns. |
| **Durability** | State lives in a file, not in browser memory — refresh/restart safe (an explicit requirement). |
| **Auditability** | The ledger is append-only; you can trace every cent back to a specific flight. |
| **Replaceability** | A fixed HTTP/JSON contract between the parts; each can change independently. |

### The pattern both challenges follow

Each challenge is the same **four-layer slice** through the server. Learn it once and
both features read the same way:

| Layer | Responsibility | Knows about | Does *not* know about |
|-------|----------------|-------------|-----------------------|
| **HTTP** (`index.js`) | routes, request validation, status codes, JSON | — | SQL |
| **Write orchestration** | "this action = compute + persist"; wraps writes in a transaction | the domain rule + the read model | HTTP |
| **Read model** | the SQL each screen needs, shaped into a plain object | SQL | HTTP |
| **Pure domain rule** | one calculation, deterministic, testable in isolation | arithmetic only | DB, HTTP, framework |
| **Connection** (`db.js`) | opens SQLite, sets pragmas, applies the schema | — | business logic |

### Frontend principles

- **`App` owns one thing:** which challenge view is active. Each view (`LedgerView`,
  `FleetView`) loads its own data on mount, so switching is just conditional rendering.
- **Presentational components take props and render** — no fetching, no business state.
- **Data flows down, events flow up.** A form doesn't own the screen's data; it calls a
  callback the parent passed. **The server's numbers are what render — never a local guess.**
- **`api.js` is the only module that touches `fetch`.** URLs are relative; Vite's dev proxy
  forwards `/api/*` to `:3001`. (The API also sends permissive CORS headers, so it works
  without the proxy too.)
- **"Update immediately":** every mutating response carries a freshly-computed payload; the
  parent drops it into state and React re-renders. No polling, no second request.

---

## 2. Technology choices

Selection criteria, in priority order: **(1)** match the role's stated stack,
**(2)** favour the largest ecosystem for long-term support and hiring,
**(3)** minimise time-to-working-prototype, **(4)** keep a clear upgrade path.

| Choice | Rationale | "Why not …?" |
|--------|-----------|--------------|
| **React 19 + Vite** | React is the role's stated preference and has the deepest ecosystem. Vite is the current default for a plain React SPA (Create React App is deprecated) — instant dev server, near-zero config. | *Next.js:* it's a full-stack framework; the brief asks for a **separate** API with server-side calculations, so a dedicated Express service keeps the boundary explicit. |
| **Node + Express 4** | Node matches the stated backend preference and keeps the whole stack one language. Express is the most widely deployed Node framework — minimal for a prototype, with a clear path to a structured framework (NestJS) later. | *FastAPI / Django:* both fine; chose Node to stay single-language. |
| **SQLite via `better-sqlite3`** | Allowed by the brief. Zero setup — `clone` + `install` runs it, no DB server. It's a **real relational database**: foreign keys, `CHECK` constraints, and true transactions, so the ledger-integrity story is identical to PostgreSQL. `better-sqlite3` is synchronous, which keeps the data code simple and linear. | *MongoDB:* the data is inherently relational (aircraft → owners → payouts; aircraft ↔ airline). Foreign keys and transactions protect the ledger; a document store pushes that work into application code. |
| **Plain JavaScript (not TypeScript)** | Faster for a short prototype, fewer ways `npm install` can fail on a reviewer's machine. The money math is guarded by **unit tests** instead of types. JS→TS is an incremental migration (add `tsconfig`, rename files one at a time). | — |
| **`node:test` (built-in runner)** | No extra dependency for the test suite. | *Vitest / Jest:* would add dependencies for no gain at this size. |
| **TanStack Query, Redux, a router** | *Not used.* The app has two views and simple per-view state; `useState` + `useEffect` + a fetch wrapper is enough. Adding them now would be premature. | — |

**Production upgrade path:** React stays · Express → NestJS if the service grows ·
SQLite → PostgreSQL (same schema, add a migration tool + pooling) · JS → TS incrementally.

---

## 3. Repository layout

```
fractional-ledger/
├── package.json              root scripts only (dev / setup / seed / test) via `concurrently`
├── server/
│   └── src/
│       ├── index.js              Express app: middleware, ALL routes, error handler   [shared]
│       ├── db.js                 opens SQLite, sets pragmas, applies schema.sql        [shared]
│       ├── schema.sql            every table + index (CREATE TABLE IF NOT EXISTS)      [shared]
│       ├── seed.js               wipes + reloads all demo data in one transaction     [shared]
│       ├── peek.js               dev tool: prints every table                          [shared]
│       │
│       ├── distribution.js       pure: payout split (largest remainder)          ── Challenge 1
│       ├── distribution.test.js    9 tests                                        ── Challenge 1
│       ├── aircraft.js           read model: getAircraftSummary, listAircraft     ── Challenge 1
│       ├── revenue.js            write path: recordRevenue (calc + transaction)   ── Challenge 1
│       │
│       ├── leaseStatus.js        pure: the 90-day rule                            ── Challenge 2
│       ├── leaseStatus.test.js     7 tests                                        ── Challenge 2
│       ├── fleet.js              read model: listFleet, listAirlines              ── Challenge 2
│       └── lease.js              write path: assignLease, endLease                ── Challenge 2
└── web/
    ├── vite.config.js            dev proxy: /api/* → http://localhost:3001              [shared]
    └── src/
        ├── App.jsx              app shell: brand header + switcher + view routing       [shared]
        ├── api.js               the only module that knows `fetch` and the /api URLs    [shared]
        ├── format.js            cents / basis-points / date formatters, input parser    [shared]
        ├── index.css            token-based dark theme (Jet Centrum palette)            [shared]
        └── components/
            ├── LedgerView.jsx        the whole Challenge 1 screen               ── Challenge 1
            ├── AircraftPicker.jsx    aircraft dropdown                          ── Challenge 1
            ├── AssetCard.jsx         asset + revenue/distribution totals        ── Challenge 1
            ├── RevenueForm.jsx       "Log Flight Revenue" form                  ── Challenge 1
            ├── ShareholderTable.jsx  owners, ownership bars, payouts            ── Challenge 1
            ├── AnimatedCents.jsx     value that flashes when it increases       ── Challenge 1
            └── FleetView.jsx         the whole Challenge 2 screen               ── Challenge 2
```

---

## 4. Data model conventions

Applied automatically on server start (`db.js` runs `schema.sql`; every statement is
`IF NOT EXISTS`, so it is safe to run on every boot and never wipes data).

**No floating point anywhere:**

| Quantity | Stored as | Example |
|----------|-----------|---------|
| Money | **integer cents** | `1250000` = $12,500.00 |
| Ownership | **integer basis points** (1 bp = 0.01%) | `5000` = 50.00%, `1250` = 12.5% |
| Dates | **ISO text `YYYY-MM-DD`** | sorts and compares correctly as text |

**Pragmas** (`db.js`): `journal_mode = WAL` (reads don't block writes),
`foreign_keys = ON` (SQLite does not enforce FKs by default).

---
---

# Part B — Challenge 1: Dividend Ledger

## B1. How it works

At Jet Centrum, high-net-worth individuals own **fractional shares** of an aircraft
(e.g. 50%, 37.5%, 12.5%). Charter flights earn revenue, which must be split **by
ownership stake** and credited to each owner.

The admin opens the dashboard, picks an aircraft, and sees the asset, its owners, and
each owner's total accumulated payout. They type an amount into **"Log Flight Revenue"**
and submit. The backend:

1. loads the aircraft's ownership stakes,
2. computes each owner's cut (server-side, integer-exact),
3. writes one `revenue_event` row + one `payout` row per owner **in a single transaction**,
4. returns the refreshed dashboard.

The screen updates instantly — because the response already contains the new totals.

## B2. Schema

```
aircraft ─┐                 ┌─ investor
          │                 │
        holding (aircraft_id, investor_id, basis_points)     who owns what % of which aircraft
          │
revenue_event (aircraft_id, amount_cents, memo, created_at)  one logged charter revenue amount
          │
        payout (revenue_event_id, investor_id,               THE LEDGER — one row per investor
                amount_cents, basis_points_at_time)           per revenue event, append-only
```

| Table | Key columns | Notes |
|-------|-------------|-------|
| `aircraft` | `tail_number` UNIQUE, `model`, `manufacturer`, `serial_number` | the asset |
| `investor` | `name` | a person/entity; **one row** even if they hold stakes in several aircraft |
| `holding` | `basis_points` `CHECK (>0 AND <=10000)`, `UNIQUE(aircraft_id, investor_id)` | the app also checks the **sum** per aircraft ≤ 10000 |
| `revenue_event` | `amount_cents` `CHECK (>0)`, `created_at DEFAULT datetime('now')` | one logged amount |
| `payout` | `amount_cents` `CHECK (>=0)`, `basis_points_at_time` | **append-only.** `basis_points_at_time` snapshots the stake used for *this* calculation, so history stays correct if ownership later changes |

**Why the ledger is append-only:** an investor's accumulated payout is
`SUM(payout.amount_cents)` — **derived on read, never stored and overwritten.** There is
no balance field to drift or corrupt; the truth is always the sum of the history, and
every payout is traceable to one flight.

## B3. Domain logic — `distribution.js` (pure)

```js
distributeRevenue(revenueCents, holdings)
  → { revenueCents, distributedCents, retainedCents,
      allocations: [ { investorId, basisPoints, amountCents } ] }
```

**Guarantees**

1. Every value is an integer number of cents.
2. When stakes cover 100%, the payouts sum **exactly** to the revenue — no cent invented or lost.

**Method — largest remainder**

```
1. Each investor's exact share = revenueCents × basisPoints / 10000
   pay the whole part (floor); keep the fractional part as an integer (numerator % 10000)
2. targetCents = floor(revenueCents × Σ basisPoints / 10000)
   leftover = targetCents − Σ (whole parts paid)          // a handful of cents
3. Hand the leftover cents out one each, largest fractional remainder first.
   Tie-break: larger stake, then lower investor id → deterministic output.
```

`retainedCents` covers stakes summing to **under** 100% (the brief's formula
`payout = revenue × ownership%` implies the remainder is retained by the asset).
`distributedCents + retainedCents === revenueCents` always.

**Tests (9):** even split · the demo split · `$1.00` across imperfect thirds → `33/33/34` ·
one indivisible cent → single deterministic winner · partial ownership → retained ·
zero revenue · rejects decimals / negatives · rejects stakes > 100% ·
**500-run randomised property check** that payouts always sum back to the revenue.

## B4. API

Base `/api`. Responses are JSON; errors are `{ "error": "..." }`. Money is **whole cents**.

| Method | Path | Body | Success | Notes |
|--------|------|------|---------|-------|
| `GET` | `/api/health` | — | `200 { status, service }` | liveness |
| `GET` | `/api/aircraft` | — | `200 { aircraft: [ { id, tailNumber, model, manufacturer, revenueLoggedCents } ] }` | list for the picker |
| `GET` | `/api/aircraft/:id` | — | `200 { aircraft, shareholders, totals }` | `shareholders[]` includes `ownershipPercent` and `totalPaidCents` (summed live from payout rows) |
| `POST` | `/api/aircraft/:id/revenue` | `{ amountCents, memo? }` | `201 { revenueEventId, distribution, summary }` | validates → `recordRevenue()` → returns the fresh dashboard |

**Errors:** `400` bad id / bad amount · `404` no such aircraft · `409` aircraft has no
shareholders (`NO_HOLDINGS`) · `500` unexpected.

## B5. Frontend — `LedgerView.jsx`

```
LedgerView            holds: aircraft list, selectedId, summary, error
├── AircraftPicker      props only  → onSelect(id)
├── AssetCard           props only
├── RevenueForm         local form state → onLogged(freshSummary) === setSummary
└── ShareholderTable
    └── AnimatedCents    local flash state (gold flash when a payout increases)
```

`LedgerView` fetches the aircraft list on mount and the selected aircraft's dashboard
whenever the selection changes. `RevenueForm` converts the typed dollar amount to cents
(`format.js` → `dollarsToCents`), POSTs, and hands the server's fresh `summary` back up.

## B6. Request lifecycle — logging revenue

```
POST /api/aircraft/1/revenue  { amountCents: 5000000 }
  │  index.js:  id a positive int? amount a positive int? aircraft exists?   → else 400/404
  ▼
revenue.js  recordRevenue(1, { amountCents: 5000000 })
  │  read holdings → [5000bp, 3750bp, 1250bp]
  │  distributeRevenue(5000000, holdings)                 ← pure, §B3
  │      → 2,500,000 / 1,875,000 / 625,000   (Σ = 5,000,000)
  │  db.transaction:  INSERT revenue_event;  INSERT payout ×3  (with basis_points_at_time)
  ▼
201 { revenueEventId, distribution, summary: getAircraftSummary(1) }
  │
  ▼  web:  setSummary(response.summary)  → React re-renders card + table with new totals
```

---
---

# Part C — Challenge 2: Fleet Lease Tracker

## C1. How it works

Jet Centrum also leases whole aircraft to airline clients. Operations needs to see, at a
glance, **which aircraft are out, to whom, and until when** — and be warned about leases
**expiring within 90 days**.

The "Fleet & Leases" view shows a grid of every aircraft with its lessee airline and
lease dates. Each row carries a status badge:

| Badge | Meaning |
|-------|---------|
| 🟢 On lease | ends more than 90 days out |
| 🔴 Expiring soon · Nd | ends within 90 days |
| 🔴 Expired · Nd ago | end date already passed |
| ⚪ Available | no active lease |

Each row has a **Manage** action that opens an inline editor: pick an airline, set
start/end dates, and **Assign / Reassign**, or **End lease** to return the aircraft.
Reassigning ends the current lease and opens the new one **in one transaction**.

## C2. Schema

Challenge 2 **reuses the `aircraft` table unchanged** and adds two tables:

```
airline (name UNIQUE, country)
          │
        lease (aircraft_id → aircraft, airline_id → airline,     the Aircraft ↔ Airline link
               start_date, end_date, status)                     one row per leasing agreement
```

| Table | Key columns | Notes |
|-------|-------------|-------|
| `airline` | `name` UNIQUE, `country` | the lessee client |
| `lease` | `start_date`, `end_date`, `status CHECK IN ('active','ended')`, `CHECK (end_date >= start_date)` | its **own table** (not columns on `aircraft`) so an aircraft keeps a **lease history** and can be re-leased. The app enforces **"at most one active lease per aircraft"** |

`lease` is the **junction table** — it is the *"relational database structure linking an
Aircraft table to a Client/Airline table"* the brief asks for. Index: `lease(aircraft_id)`.

## C3. Domain logic — `leaseStatus.js` (pure)

```js
classifyLease(endDate, today = new Date())
  → { daysUntilExpiry, status: 'expired' | 'expiring-soon' | 'ok' }
```

- `expired` — end date has passed
- `expiring-soon` — ends within the next **90 days** (the brief's red flag; boundary inclusive)
- `ok` — more than 90 days out

Both dates are compared at UTC midnight, so the result never depends on the time of day.
The **server computes this and sends the status; the UI only picks a colour** — the same
"logic lives on the server" principle as Challenge 1.

**Tests (7):** far future = ok · within 90 = expiring-soon · exactly 90 = expiring-soon ·
91 = ok · today = expiring-soon (not expired) · past = expired · rejects malformed dates.

## C4. API

| Method | Path | Body | Success | Notes |
|--------|------|------|---------|-------|
| `GET` | `/api/fleet` | — | `200 { fleet: [ { id, tailNumber, model, manufacturer, lease } ] }` | `lease` is `null` or `{ leaseId, airlineId, lessee, startDate, endDate, daysUntilExpiry, status }` — status computed server-side |
| `GET` | `/api/airlines` | — | `200 { airlines: [ { id, name, country } ] }` | for the reassign dropdown |
| `PATCH` | `/api/aircraft/:id/lease` | `{ airlineId, startDate, endDate }` **or** `{ status: "ended" }` | `200 { fleet }` | assign/reassign ends any active lease and opens a new one **in one transaction**; `{status:"ended"}` just returns the aircraft |

**Errors:** `400` malformed dates / unknown airline (`BAD_AIRLINE`) / end-before-start
(`BAD_DATES`) · `404` no such aircraft · `409` no active lease to end (`NO_LEASE`).

## C5. Frontend — `FleetView.jsx`

```
FleetView            holds: fleet, airlines, editingId, draft, busy, error
└── (inline lease editor per row — airline <select> + two <input type=date> + buttons)
```

`FleetView` loads the fleet and the airline list on mount. Opening **Manage** seeds a
`draft` from the row's current lease. Saving calls `assignLease` / `endLease`, drops the
returned fresh `fleet` array into state, and closes the editor. `format.js` → `formatDate`
turns `2026-09-18` into `18 Sep 2026`.

## C6. Request lifecycle — reassigning a lease

```
PATCH /api/aircraft/3/lease  { airlineId: 1, startDate: "2026-09-01", endDate: "2027-09-01" }
  │  index.js:  id valid? aircraft exists? airlineId an int? dates ISO?   → else 400/404
  ▼
lease.js  assignLease(3, { airlineId: 1, startDate, endDate })
  │  airline 1 exists?  endDate >= startDate?                            → else BAD_AIRLINE / BAD_DATES (400)
  │  db.transaction:
  │     UPDATE lease SET status='ended' WHERE aircraft_id=3 AND status='active'   (if any)
  │     INSERT lease (aircraft_id=3, airline_id=1, ...) status='active'
  ▼
200 { fleet: listFleet() }        ← each row re-run through classifyLease() (§C3)
  │
  ▼  web:  setFleet(response.fleet)  → the grid re-renders with the new lessee + badge
```

## C7. How Challenge 2 fits into the whole system

Challenge 2 was built **additively** — **no file in Challenge 1 was modified**.

**It reuses the exact four-layer pattern from §1:**

| Layer | Challenge 1 | Challenge 2 |
|-------|-------------|-------------|
| Route + validation | `index.js` | `index.js` (same file, new routes) |
| Write orchestration | `revenue.js` · `recordRevenue()` | `lease.js` · `assignLease()` / `endLease()` |
| Read model | `aircraft.js` · `getAircraftSummary()` | `fleet.js` · `listFleet()` |
| Pure domain rule | `distribution.js` · `distributeRevenue()` | `leaseStatus.js` · `classifyLease()` |
| Frontend screen | `LedgerView.jsx` | `FleetView.jsx` |

Both columns behave identically: a thin route validates and delegates; a **pure function**
computes the rule; a **transaction** persists any multi-row write; the response carries a
freshly-computed payload the UI drops straight into state.

**Shared infrastructure, reused unchanged:**

- **`aircraft` table** — untouched; `airline` and `lease` are purely new.
- **`db.js`** — same connection and schema-on-boot; `schema.sql` gained two `CREATE TABLE` blocks.
- **`seed.js`** — the same single transaction now also loads airlines and leases.
- **`index.js`** — same middleware and error handler; the handler gained two more error-code cases.
- **Frontend** — same `api.js` wrapper (4 new functions), `format.js` (+ `formatDate`),
  `index.css` tokens, and brand header.

**How the two connect in the UI:** `App.jsx` holds a single piece of state — the active
view — and renders `LedgerView` or `FleetView`. The two screens **never share React
state**; their only common ground is the API and the stylesheet. The switcher is a
two-button toggle.

**Net cost of Challenge 2:** 4 server files + 2 tables + 3 routes + 1 screen, and **zero
edits to Challenge 1's logic**. The layering that made Challenge 1 reviewable is what made
Challenge 2 cheap to add.

---
---

# Part D — Running it

## 8. Testing

```bash
npm test        # from the repo root — runs the server suite
```

`node:test` (built-in, no dependency). **16 tests total:**

| Suite | Count | Covers |
|-------|-------|--------|
| `distribution.test.js` | 9 | the payout split, incl. a 500-run randomised property check |
| `leaseStatus.test.js` | 7 | the 90-day rule and its boundaries |

Everything genuinely worth unit-testing here is pure logic. The read models and routes are
thin and were exercised by hand with `curl` during the build.

## 9. Setup

Requires **Node.js 20+** (built on 22) and npm. No database server to install.

```bash
git clone https://github.com/untari/fractional-ledger.git
cd fractional-ledger

npm run setup    # install root + server + web
npm run seed     # create server/ledger.db and load the demo data
npm run dev      # start API (:3001) and web app (:5173), labelled in the terminal
```

Open **<http://localhost:5173>**.

| Command | Does |
|---------|------|
| `npm run dev` | run API + web together |
| `npm test` | run the backend unit tests |
| `npm run seed` | reset the database to the demo state (safe to re-run) |
| `npm --prefix server run peek` | print every database table |
| `npm run dev:server` / `dev:web` | run just one side |

**Demo data:** 4 aircraft (Bombardier Global 7500, Cessna Citation Longitude, Gulfstream
G650ER, Airbus A320neo), 6 investors, 3 airlines, 3 leases — chosen so Challenge 2 shows
all four states at once (on-lease, expiring-soon, expired, available).

**Troubleshooting**

- `EADDRINUSE :::3001` — an old API process is running: `lsof -ti:3001 | xargs kill`.
- `404` from `/api/aircraft/1` after pulling — the schema changed:
  `rm -f server/ledger.db* && npm run seed`.
- Blank page / "Could not load" — the API isn't running; use `npm run dev` (both).

## 10. What I'd do next

| Area | Now | Next |
|------|-----|------|
| Types | plain JS + tests | TypeScript with branded `Cents` / `BasisPoints` types — makes unit mix-ups impossible, not just tested |
| Database | local SQLite file | PostgreSQL + a migration tool (Prisma/Knex); `schema.sql`-on-boot handles creation, not *changes* |
| Money size | JS `Number` cents (safe to ~$90 trillion) | `BigInt` or a decimal library to remove the ceiling |
| Revenue history | totals only | `GET /api/aircraft/:id/ledger` + a history table (the brief mentions "payout history") |
| Ownership changes | fixed at seed time | an endpoint to adjust stakes, validating the sum stays ≤ 100% (`basis_points_at_time` already protects past payouts) |
| Auth | none | an admin token — "Log Revenue" and "Reassign Lease" are privileged actions |
| Concurrency | single-process SQLite is fine | under PostgreSQL, `SERIALIZABLE` (or row-lock the aircraft) around read-holdings + insert-payouts |
| Frontend data | `fetch` + `useState` | TanStack Query for cache invalidation, retries, and loading states as the app grows |
| Delivery | local | Render/Fly with a Postgres addon + CI running `npm test` |
