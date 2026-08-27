/**
 * Dev tool: print the contents of every table in the database.
 *
 * Usage, from the server/ folder:
 *     node src/peek.js
 *
 * Not used by the app itself — it's just a quick way to see what's in the
 * ledger without installing a database client.
 */

// the shared connection
import db from './db.js';

// Ask the database for the list of tables it holds (skipping SQLite's own
// internal bookkeeping tables, whose names start with "sqlite_").
// -> [{ name: 'aircraft' }, { name: 'holding' }, ...]
const tables = db
  .prepare(
    `SELECT name FROM sqlite_master
     WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
     ORDER BY name`,
  )
  .all();

for (const { name } of tables) {
  // every row of this table (safe: the name came from SQLite itself, not user input)
  const rows = db.prepare(`SELECT * FROM ${name}`).all();
  // header line, e.g. "== payout (3 rows) =="
  console.log(`\n== ${name} (${rows.length} row${rows.length === 1 ? '' : 's'}) ==`);
  // pretty grid output in the terminal
  if (rows.length > 0) {
    console.table(rows);
  }
}

// trailing blank line
console.log('');
