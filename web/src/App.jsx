/**
 * The root component.
 *
 * When the page opens it loads the aircraft dashboard from the API, holds it in
 * state, and renders the asset card + shareholder table. The revenue form
 * (which mutates this state) is added in the next step.
 */

import { useEffect, useState } from 'react'

import { getAircraft } from './api.js'
import AssetCard from './components/AssetCard.jsx'
import RevenueForm from './components/RevenueForm.jsx'
import ShareholderTable from './components/ShareholderTable.jsx'

// The prototype manages a single aircraft. Its id in the seeded database is 1.
const AIRCRAFT_ID = 1

function App() {
  // `summary` is the API payload: { aircraft, shareholders, totals }.
  // It's null until the fetch finishes.
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState(null)

  // The empty dependency array [] means "run this once, after the first render".
  useEffect(() => {
    getAircraft(AIRCRAFT_ID)
      .then(setSummary)
      .catch((err) => setError(err.message))
  }, [])

  if (error) {
    return (
      <main>
        <p className="error">Could not load the dashboard: {error}</p>
      </main>
    )
  }

  if (!summary) {
    return (
      <main>
        <p>Loading…</p>
      </main>
    )
  }

  return (
    <main>
      <h1>Fractional Share &amp; Dividend Ledger</h1>
      <AssetCard aircraft={summary.aircraft} totals={summary.totals} />
      {/* When the form logs revenue, the API returns the fresh summary; we
          drop it straight into state and every child re-renders. */}
      <RevenueForm aircraftId={AIRCRAFT_ID} onLogged={setSummary} />
      <ShareholderTable shareholders={summary.shareholders} />
    </main>
  )
}

export default App
