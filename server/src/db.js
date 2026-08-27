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

// the SQLite driver; `Database` is a constructor
import Database from 'better-sqlite3';
// to read schema.sql off disk as a string
import { readFileSync } from 'node:fs';
// build file paths safely across operating systems
import { dirname, join } from 'node:path';
// convert this module's URL into a plain filesystem path
import { fileURLToPath } from 'node:url';

// Resolve paths relative to THIS file, so it works no matter which directory
// the `node` process was started from.
// absolute path of the folder this file lives in
const here = dirname(fileURLToPath(import.meta.url));

// Where the database lives: server/ledger.db (git-ignored via the *.db rule).
// The DB_FILE env var lets tests run against a throwaway database instead.
// use the env override if set, otherwise ../ledger.db next to this folder
const DB_FILE = process.env.DB_FILE || join(here, '..', 'ledger.db');

// open the file (creates it if it doesn't exist yet)
const db = new Database(DB_FILE);

// Sensible defaults for a small web service:
// "write-ahead logging": readers don't block while a write is happening
db.pragma('journal_mode = WAL');
// make SQLite actually enforce the REFERENCES constraints (off by default)
db.pragma('foreign_keys = ON');

// Apply the schema. It is written with "IF NOT EXISTS" everywhere, so doing this
// on every startup creates the tables the first time and is a harmless no-op
// afterwards — existing data is never touched.
// load schema.sql from the same folder as this file
const schema = readFileSync(join(here, 'schema.sql'), 'utf8');
// run every statement in it
db.exec(schema);

// one shared connection object; every other module imports this same instance
export default db;
