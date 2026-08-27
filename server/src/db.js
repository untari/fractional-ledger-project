/**
 * The database connection.
 *
 * Opens (or creates) the SQLite file, applies the schema, and exports one
 * shared connection that the rest of the server imports:
 *
 *     import db from './db.js';
 *     const rows = db.prepare('SELECT * FROM aircraft').all();
 *
 * better-sqlite3 is synchronous by design — queries return results directly,
 * no callbacks or promises. That keeps the ledger code simple and easy to read.
 */

import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolve paths relative to THIS file, so it works no matter which directory
// the `node` process was started from.
const here = dirname(fileURLToPath(import.meta.url));

// Where the database lives: server/ledger.db (git-ignored via the *.db rule).
// The DB_FILE env var lets tests run against a throwaway database instead.
const DB_FILE = process.env.DB_FILE || join(here, '..', 'ledger.db');

const db = new Database(DB_FILE);

// Sensible defaults for a small web service:
db.pragma('journal_mode = WAL'); // allow reads while a write is in progress
db.pragma('foreign_keys = ON');  // actually enforce the REFERENCES constraints

// Apply the schema. It is written with "IF NOT EXISTS" everywhere, so doing this
// on every startup creates the tables the first time and is a harmless no-op
// afterwards — existing data is never touched.
const schema = readFileSync(join(here, 'schema.sql'), 'utf8');
db.exec(schema);

export default db;
