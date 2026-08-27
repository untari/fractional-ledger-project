/**
 * The root component.
 *
 * On load it fetches the fleet and selects the first aircraft, then fetches that
 * aircraft's dashboard. Changing the picker re-fetches for the new selection.
 * Logging revenue drops the server's fresh summary straight into state.
 */

// useState: component memory; useEffect: run code after render
import { useEffect, useState } from 'react'

import { getAircraft, listAircraft } from './api.js'
import AircraftPicker from './components/AircraftPicker.jsx'
import AssetCard from './components/AssetCard.jsx'
import RevenueForm from './components/RevenueForm.jsx'
import ShareholderTable from './components/ShareholderTable.jsx'

function App() {
  // the list of all aircraft, for the picker
  const [fleet, setFleet] = useState([])
  // which aircraft is selected (its id), or null until the fleet loads
  const [selectedId, setSelectedId] = useState(null)
  // dashboard payload for the selected aircraft: { aircraft, shareholders, totals }
  const [summary, setSummary] = useState(null)
  // an error message string, or null
  const [error, setError] = useState(null)

  // 1. Load the fleet once, then select the first aircraft.
  useEffect(() => {
    listAircraft()
      .then((data) => {
        setFleet(data.aircraft)
        setSelectedId(data.aircraft[0]?.id ?? null)
      })
      .catch((err) => setError(err.message))
  }, [])

  // 2. Whenever the selection changes, (re)load that aircraft's dashboard.
  //    [selectedId] means "run this again every time selectedId changes".
  useEffect(() => {
    if (selectedId == null) return
    setSummary(null) // show the loading state while the new one arrives
    getAircraft(selectedId)
      .then(setSummary)
      .catch((err) => setError(err.message))
  }, [selectedId])

  if (error) {
    return (
      <main>
        <p className="error">Could not load the dashboard: {error}</p>
      </main>
    )
  }

  return (
    <main>
      <header className="page-header">
        <h1>
          Fractional Share &amp; <span className="accent">Dividend Ledger</span>
        </h1>
        <p>Charter revenue, distributed to fractional owners by stake.</p>
      </header>

      {/* only worth showing the picker when there's more than one choice */}
      {fleet.length > 1 && (
        <AircraftPicker
          aircraft={fleet}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      )}

      {!summary ? (
        <p className="loading">Loading…</p>
      ) : (
        <>
          <AssetCard aircraft={summary.aircraft} totals={summary.totals} />
          {/* onLogged(newSummary) is literally setSummary(newSummary) */}
          <RevenueForm aircraftId={selectedId} onLogged={setSummary} />
          <ShareholderTable shareholders={summary.shareholders} />
        </>
      )}
    </main>
  )
}

export default App
