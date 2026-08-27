# Fractional Share & Dividend Ledger

Tracks fractional ownership of an aircraft and splits charter revenue between
its investors by ownership stake. Built as a technical assessment.

- **web** — React + Vite. Shows the asset, the shareholder table, and a
  "Log Flight Revenue" form.
- **server** — Node + Express. Calculates payouts, enforces the rules, owns all writes.
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
| `GET` | `/api/aircraft/:id` | — |
| `POST` | `/api/aircraft/:id/revenue` | `{ amountCents, memo? }` |

## Key decisions

- **Money as integer cents, ownership as basis points** — no floating point anywhere.
- **Largest-remainder rounding** — payouts always sum to the logged revenue exactly.
- **Append-only ledger** — balances are summed from payout rows, never overwritten.
  Each revenue entry and its payouts are written in one transaction.
- **SQLite** for zero-setup review; same schema moves to PostgreSQL for production.

## Status

Challenge 1 complete. Challenge 2 (Fleet Lease Tracker) not started.
