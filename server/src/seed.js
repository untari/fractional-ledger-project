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
//  Airlines (Challenge 2 lessees)
// ---------------------------------------------------------------------------
const AIRLINES = [
  { name: 'Cathay Pacific', country: 'Hong Kong' },
  { name: 'Lufthansa', country: 'Germany' },
  { name: 'Singapore Airlines', country: 'Singapore' },
];

// ---------------------------------------------------------------------------
//  The demo fleet.
//
//  investors[].basis_points: 1/100th of a percent. 5000 = 50%, 1250 = 12.5%.
//  Each aircraft's stakes deliberately add up to exactly 10000 (100%).
//  Some investors own shares in more than one aircraft — an investor is a
//  person, not a per-aircraft row, so they are inserted once and linked
//  to each aircraft they hold a stake in.
//
//  lease (optional): the current lease. Dates are 'YYYY-MM-DD'. Chosen so the
//  demo shows all three states relative to "today" (2026-08-28):
//    N123JC -> ends in ~3 weeks  -> "expiring soon" (red)
//    N88JC  -> ends in 2027      -> "ok"
//    N550JC -> no lease          -> "available"
//    N777JC -> ended weeks ago   -> "expired" (red, overdue return)
// ---------------------------------------------------------------------------
const FLEET = [
  {
    tail_number: 'N123JC',
    model: 'Global 7500',
    manufacturer: 'Bombardier',
    serial_number: '70012',
    lease: { airline: 'Cathay Pacific', start_date: '2026-06-01', end_date: '2026-09-18' },
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
    lease: { airline: 'Lufthansa', start_date: '2026-02-01', end_date: '2027-08-01' },
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
    // no lease — currently available
    investors: [
      { name: 'Deborah Kwan', basis_points: 2500 },
      { name: 'Priya Raman', basis_points: 2500 },
      { name: 'Sofia Nakamura', basis_points: 2500 },
      { name: 'Tobias Al-Farsi', basis_points: 2500 },
    ],
  },
  {
    tail_number: 'N777JC',
    model: 'A320neo',
    manufacturer: 'Airbus',
    serial_number: 'A32-8841',
    lease: { airline: 'Singapore Airlines', start_date: '2023-08-01', end_date: '2026-08-05' },
    investors: [
      { name: 'Deborah Kwan', basis_points: 7000 },
      { name: 'Marcus Halvorsen', basis_points: 3000 },
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
    DELETE FROM lease;
    DELETE FROM holding;
    DELETE FROM investor;
    DELETE FROM airline;
    DELETE FROM aircraft;
  `);

  // Prepare each statement once and reuse it in the loops below.
  const insertAirline = db.prepare(
    `INSERT INTO airline (name, country) VALUES (@name, @country)`,
  );
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
  const insertLease = db.prepare(
    `INSERT INTO lease (aircraft_id, airline_id, start_date, end_date)
     VALUES (@aircraftId, @airlineId, @startDate, @endDate)`,
  );

  // Airlines first — build a name -> id map for the lease inserts.
  const airlineId = {};
  for (const airline of AIRLINES) {
    airlineId[airline.name] = insertAirline.run(airline).lastInsertRowid;
  }

  for (const aircraft of FLEET) {
    const aircraftId = insertAircraft.run({
      tail_number: aircraft.tail_number,
      model: aircraft.model,
      manufacturer: aircraft.manufacturer,
      serial_number: aircraft.serial_number,
    }).lastInsertRowid;

    for (const investor of aircraft.investors) {
      // Reuse this person's id if they already own a stake elsewhere.
      const investorId =
        findInvestor.get(investor.name)?.id ??
        insertInvestor.run(investor.name).lastInsertRowid;

      insertHolding.run(aircraftId, investorId, investor.basis_points);
    }

    if (aircraft.lease) {
      insertLease.run({
        aircraftId,
        airlineId: airlineId[aircraft.lease.airline],
        startDate: aircraft.lease.start_date,
        endDate: aircraft.lease.end_date,
      });
    }
  }
});

// actually execute the transaction defined above
runSeed();

const counts = db
  .prepare(
    `SELECT
       (SELECT COUNT(*) FROM aircraft) AS aircraft,
       (SELECT COUNT(*) FROM investor) AS investors,
       (SELECT COUNT(*) FROM airline)  AS airlines,
       (SELECT COUNT(*) FROM lease)    AS leases`,
  )
  .get();
console.log(
  `Seeded ${counts.aircraft} aircraft, ${counts.investors} investors, ` +
    `${counts.airlines} airlines, ${counts.leases} leases.`,
);
console.log('Run `npm run peek` to see the data.');
