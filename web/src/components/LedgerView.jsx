/**
 * Challenge 1 — Fractional Share & Dividend Ledger.
 *
 * Loads the fleet, lets the user pick an aircraft, shows its asset card,
 * revenue form and shareholder table. Logging revenue drops the server's fresh
 * summary straight into state so the whole view re-renders.
 */

import { useEffect, useState } from 'react'

import { getAircraft, listAircraft } from '../api.js'
import AircraftPicker from './AircraftPicker.jsx'
import AssetCard from './AssetCard.jsx'
import RevenueForm from './RevenueForm.jsx'
import ShareholderTable from './ShareholderTable.jsx'

function LedgerView() {
  const [fleet, setFleet] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  // dashboard payload for the selected aircraft: { aircraft, shareholders, totals }
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState(null)

  // 1. Load the aircraft list once, then select the first.
  useEffect(() => {
    listAircraft()
      .then((data) => {
        setFleet(data.aircraft)
        setSelectedId(data.aircraft[0]?.id ?? null)
      })
      .catch((err) => setError(err.message))
  }, [])

  // 2. (Re)load the dashboard whenever the selection changes.
  useEffect(() => {
    if (selectedId == null) return
    setSummary(null)
    getAircraft(selectedId)
      .then(setSummary)
      .catch((err) => setError(err.message))
  }, [selectedId])

  if (error) {
    return <p className="error">Could not load the dashboard: {error}</p>
  }

  return (
    <>
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
    </>
  )
}

export default LedgerView
