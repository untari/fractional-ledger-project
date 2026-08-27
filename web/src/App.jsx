/**
 * The root component.
 *
 * Renders the brand header, a two-way switcher, and one of the two challenge
 * views. Each view owns its own data loading.
 */

import { useState } from 'react'

import FleetView from './components/FleetView.jsx'
import LedgerView from './components/LedgerView.jsx'

const VIEWS = [
  { id: 'ledger', label: 'Dividend Ledger', sub: 'Fractional Share & Dividend Ledger' },
  { id: 'fleet', label: 'Fleet & Leases', sub: 'Aircraft Fleet Lease Tracker' },
]

function App() {
  const [view, setView] = useState('ledger')
  const current = VIEWS.find((v) => v.id === view)

  return (
    <main>
      {/* Brand header. Wordmark set in Cinzel (from Google Fonts).
          This is a technical-assessment prototype, not an official product. */}
      <header className="brand">
        <div className="brand-lockup">
          <span className="brand-words">
            <span className="brand-name">JET CENTRUM</span>
            <span className="brand-tagline">A High Altitude Business</span>
          </span>
        </div>
        <p className="brand-sub">{current.sub}</p>
      </header>

      {/* the challenge switcher */}
      <nav className="switcher" aria-label="View">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            className={v.id === view ? 'switch-btn is-active' : 'switch-btn'}
            aria-current={v.id === view ? 'page' : undefined}
            onClick={() => setView(v.id)}
          >
            {v.label}
          </button>
        ))}
      </nav>

      {/* mounting fresh on switch (key) keeps each view's loading logic simple */}
      {view === 'ledger' ? <LedgerView key="ledger" /> : <FleetView key="fleet" />}
    </main>
  )
}

export default App
