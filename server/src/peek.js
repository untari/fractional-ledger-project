/**
 * Dev tool: print the contents of every table in the database.
 *
 * Usage, from the server/ folder:
 *     node src/peek.js
 *
 * Not used by the app itself — it's just a quick way to see what's in the
 * ledger without installing a database client.
 */

import db from './db.js';

// Ask the database for the list of tables it holds (skipping SQLite's own
// internal bookkeeping tables, whose names start with "sqlite_").
const tables = db
  .prepare(
    `SELECT name FROM sqlite_master
     WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
     ORDER BY name`,
  )
  .all();

for (const { name } of tables) {
  const rows = db.prepare(`SELECT * FROM ${name}`).all();
  console.log(`\n== ${name} (${rows.length} row${rows.length === 1 ? '' : 's'}) ==`);
  if (rows.length > 0) {
    console.table(rows);
  }
}

console.log('');
