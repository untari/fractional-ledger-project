/**
 * The root component.
 *
 * When the page opens it loads the aircraft dashboard from the API, holds it in
 * state, and renders the asset card + shareholder table + revenue form.
 */

// useState: component memory; useEffect: run code after render
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
  // [current value, setter that triggers a re-render]
  const [summary, setSummary] = useState(null)
  // holds an error message string, or null
  const [error, setError] = useState(null)

  // The empty dependency array [] means "run this once, after the first render".
  useEffect(() => {
    // call the API
    getAircraft(AIRCRAFT_ID)
      // success -> store the payload in state
      .then(setSummary)
      // failure -> store the message
      .catch((err) => setError(err.message))
  }, [])

  // early return: render the error screen and nothing else
  if (error) {
    return (
      <main>
        <p className="error">Could not load the dashboard: {error}</p>
      </main>
    )
  }

  // still loading: summary hasn't arrived yet
  if (!summary) {
    return (
      <main>
        <p>Loading…</p>
      </main>
    )
  }

  // summary is loaded -> render the real dashboard
  return (
    <main>
      <h1>Fractional Share &amp; Dividend Ledger</h1>
      {/* pass slices of state down as props */}
      <AssetCard aircraft={summary.aircraft} totals={summary.totals} />
      {/* When the form logs revenue, the API returns the fresh summary; we
          drop it straight into state and every child re-renders.
          onLogged(newSummary) is literally setSummary(newSummary). */}
      <RevenueForm aircraftId={AIRCRAFT_ID} onLogged={setSummary} />
      <ShareholderTable shareholders={summary.shareholders} />
    </main>
  )
}

export default App
