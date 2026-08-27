# Jet Centrum — Aviation Commerce Core

Two prototypes behind one switcher, built as a technical assessment:

1. **Dividend Ledger** — tracks fractional ownership of an aircraft and splits
   charter revenue between its investors by ownership stake.
2. **Fleet & Leases** — tracks which aircraft are leased to which airline and
   until when, flagging leases that expire within 90 days.

- **web** — React + Vite. The dashboard, forms, and the fleet grid.
- **server** — Node + Express. Calculates payouts and lease status, enforces the
  rules, owns all writes.
- **database** — SQLite (`server/ledger.db`). Survives refresh and restart.

```
web (:5173)  ──HTTP/JSON──▶  server (:3001)  ──SQL──▶  ledger.db
```

## Setup

Requires Node.js 20+ and npm.

```bash
git clone https://github.com/untari/fractional-ledger.git
cd fractional-ledger

npm run setup    # install root + server + web
npm run seed     # create the database, load the demo aircraft + investors
npm run dev      # start API and web app together
```

Open <http://localhost:5173>.

## Commands

| Command | Does |
|---------|------|
| `npm run dev` | Run API + web app together |
| `npm test` | Backend unit tests (the payout math) |
| `npm run seed` | Reset the database to the demo state |
| `npm --prefix server run peek` | Print every database table |

## API

| Method | Path | Body |
|--------|------|------|
| `GET` | `/api/aircraft` | — |
| `GET` | `/api/aircraft/:id` | — |
| `POST` | `/api/aircraft/:id/revenue` | `{ amountCents, memo? }` |
| `GET` | `/api/fleet` | — |
| `GET` | `/api/airlines` | — |
| `PATCH` | `/api/aircraft/:id/lease` | `{ airlineId, startDate, endDate }` or `{ status: "ended" }` |

## Key decisions

- **Money as integer cents, ownership as basis points** — no floating point anywhere.
- **Largest-remainder rounding** — payouts always sum to the logged revenue exactly.
- **Append-only ledger** — balances are summed from payout rows, never overwritten.
  Each revenue entry and its payouts are written in one transaction.
- **`lease` is a junction table** linking `aircraft` to `airline`, with history —
  reassigning ends the current lease and opens a new one in one transaction.
- **The 90-day rule is a pure, tested function** (`leaseStatus.js`); the server
  sends the computed status, the UI only picks a colour.
- **SQLite** for zero-setup review; same schema moves to PostgreSQL for production.

## Status

Both challenges implemented. 16 backend unit tests (payout math + lease status).
