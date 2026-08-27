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
//  The demo data — a small fleet, each aircraft with its own owners.
//
//  basis_points: 1/100th of a percent. 5000 = 50%, 3750 = 37.5%, 1250 = 12.5%.
//  Each aircraft's stakes deliberately add up to exactly 10000 (100%).
//  Note that some investors (Marcus, Sofia, Priya) own shares in more than one
//  aircraft — an investor is a person, not a per-aircraft row, so they are
//  inserted once and linked to each aircraft they hold a stake in.
// ---------------------------------------------------------------------------
const FLEET = [
  {
    tail_number: 'N123JC',
    model: 'Global 7500',
    manufacturer: 'Bombardier',
    serial_number: '70012',
    investors: [
      { name: 'Marcus Halvorsen', basis_points: 5000 },
      { name: 'Sofia Nakamura', basis_points: 3750 },
      { name: 'Aisha Okafor', basis_points: 1250 },
    ],
  },
  {
    tail_number: 'N88JC',
    model: 'Citation Longitude',
    manufacturer: 'Cessna',
    serial_number: '90114',
    investors: [
      { name: 'Marcus Halvorsen', basis_points: 6000 },
      { name: 'Priya Raman', basis_points: 4000 },
    ],
  },
  {
    tail_number: 'N550JC',
    model: 'G650ER',
    manufacturer: 'Gulfstream',
    serial_number: '65123',
    investors: [
      { name: 'Deborah Kwan', basis_points: 2500 },
      { name: 'Priya Raman', basis_points: 2500 },
      { name: 'Sofia Nakamura', basis_points: 2500 },
      { name: 'Tobias Al-Farsi', basis_points: 2500 },
    ],
  },
];

// ---------------------------------------------------------------------------
//  Safety check — never seed an aircraft whose stakes exceed 100%
// ---------------------------------------------------------------------------
for (const aircraft of FLEET) {
  const total = aircraft.investors.reduce((sum, i) => sum + i.basis_points, 0);
  if (total > 10_000) {
    throw new Error(
      `${aircraft.tail_number}: stakes add up to ${total} basis points — over 100%.`,
    );
  }
}

// ---------------------------------------------------------------------------
//  Write everything in a single transaction
//
//  db.transaction(fn) wraps fn so that either every statement inside succeeds,
//  or — if any one throws — the database is rolled back to how it was before.
// ---------------------------------------------------------------------------
const runSeed = db.transaction(() => {
  // 1. Clear existing rows. Order matters: delete the tables that point at
  //    others (children) before the tables they point to (parents).
  db.exec(`
    DELETE FROM payout;
    DELETE FROM revenue_event;
    DELETE FROM holding;
    DELETE FROM investor;
    DELETE FROM aircraft;
  `);

  // Prepare each statement once and reuse it in the loops below.
  const insertAircraft = db.prepare(
    `INSERT INTO aircraft (tail_number, model, manufacturer, serial_number)
     VALUES (@tail_number, @model, @manufacturer, @serial_number)`,
  );
  const findInvestor = db.prepare(`SELECT id FROM investor WHERE name = ?`);
  const insertInvestor = db.prepare(`INSERT INTO investor (name) VALUES (?)`);
  const insertHolding = db.prepare(
    `INSERT INTO holding (aircraft_id, investor_id, basis_points)
     VALUES (?, ?, ?)`,
  );

  for (const aircraft of FLEET) {
    // Pass only the four columns the INSERT expects (not the `investors` key).
    const aircraftId = insertAircraft.run({
      tail_number: aircraft.tail_number,
      model: aircraft.model,
      manufacturer: aircraft.manufacturer,
      serial_number: aircraft.serial_number,
    }).lastInsertRowid;

    for (const investor of aircraft.investors) {
      // Reuse this person's id if they already own a stake elsewhere,
      // otherwise create the investor row now.
      const investorId =
        findInvestor.get(investor.name)?.id ??
        insertInvestor.run(investor.name).lastInsertRowid;

      insertHolding.run(aircraftId, investorId, investor.basis_points);
    }
  }
});

// actually execute the transaction defined above
runSeed();

const investorCount = db.prepare(`SELECT COUNT(*) AS n FROM investor`).get().n;
console.log(`Seeded ${FLEET.length} aircraft and ${investorCount} investors.`);
console.log('Run `npm run peek` to see the data.');
