/**
 * Seed script — resets the database to a known demo state.
 *
 * Run it with:  npm run seed        (from the server/ folder)
 *
 * Safe to run any time. It DELETES everything and re-inserts the same demo
 * data, so you always get an identical clean starting point. Don't run it
 * against data you want to keep.
 */

// opening this also creates the file and applies the schema
import db from './db.js';

// ---------------------------------------------------------------------------
//  The demo data
// ---------------------------------------------------------------------------

// One aircraft — the asset shown on the dashboard.
const AIRCRAFT = {
  tail_number: 'N123JC',
  model: 'Global 7500',
  manufacturer: 'Bombardier',
  serial_number: '70012',
};

// Three fractional owners and the stake each holds in that aircraft.
// basis_points: 1/100th of a percent.  5000 = 50.00%, 3750 = 37.50%, 1250 = 12.50%.
// These deliberately add up to exactly 10000 (100%).
const INVESTORS = [
  { name: 'Marcus Halvorsen', basis_points: 5000 },
  { name: 'Sofia Nakamura', basis_points: 3750 },
  { name: 'Aisha Okafor', basis_points: 1250 },
];

// ---------------------------------------------------------------------------
//  Safety check — never seed stakes that exceed 100%
// ---------------------------------------------------------------------------
// 5000 + 3750 + 1250 = 10000
const totalBasisPoints = INVESTORS.reduce((sum, i) => sum + i.basis_points, 0);
// refuse to write demo data that's already invalid
if (totalBasisPoints > 10000) {
  throw new Error(
    `Ownership stakes add up to ${totalBasisPoints} basis points — over 100%.`,
  );
}

// ---------------------------------------------------------------------------
//  Write everything in a single transaction
//
//  db.transaction(fn) wraps fn so that either every statement inside succeeds,
//  or — if any one throws — the database is rolled back to how it was before.
//  The database is never left half-seeded.
// ---------------------------------------------------------------------------
const runSeed = db.transaction(() => {
  // 1. Clear existing rows. Order matters: delete the tables that point at
  //    others (children) before the tables they point to (parents), or the
  //    foreign-key rules will block the delete.
  db.exec(`
    DELETE FROM payout;
    DELETE FROM revenue_event;
    DELETE FROM holding;
    DELETE FROM investor;
    DELETE FROM aircraft;
  `);

  // 2. Insert the aircraft. .run() executes the statement; .lastInsertRowid is
  //    the id the database just auto-assigned to the new row.
  // @name in the SQL matches the keys of the AIRCRAFT object
  const aircraftId = db
    .prepare(
      `INSERT INTO aircraft (tail_number, model, manufacturer, serial_number)
       VALUES (@tail_number, @model, @manufacturer, @serial_number)`,
    )
    .run(AIRCRAFT).lastInsertRowid;

  // 3. Insert each investor, then link them to the aircraft with their stake.
  //    Preparing the statements once and reusing them in the loop is the
  //    standard efficient pattern with better-sqlite3.
  const insertInvestor = db.prepare(`INSERT INTO investor (name) VALUES (?)`);
  const insertHolding = db.prepare(
    `INSERT INTO holding (aircraft_id, investor_id, basis_points)
     VALUES (?, ?, ?)`,
  );

  for (const investor of INVESTORS) {
    // create the investor row and grab its new id
    const investorId = insertInvestor.run(investor.name).lastInsertRowid;
    // link them to the aircraft with their stake
    insertHolding.run(aircraftId, investorId, investor.basis_points);
  }
});

// actually execute the transaction defined above
runSeed();

console.log(
  `Seeded: ${AIRCRAFT.manufacturer} ${AIRCRAFT.model} (${AIRCRAFT.tail_number}) ` +
    `with ${INVESTORS.length} investors totalling ${totalBasisPoints / 100}% ownership.`,
);
console.log('Run `npm run peek` to see the data.');
