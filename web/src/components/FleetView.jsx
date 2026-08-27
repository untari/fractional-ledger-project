/**
 * Challenge 2 — Fleet Lease Tracker.
 *
 * A grid of every aircraft: which airline it's leased to and until when, with a
 * red badge for leases expiring within 90 days (or already expired). Each row
 * can be reassigned to another airline / date range, or returned (lease ended).
 *
 * The 90-day rule and every status label come from the server — this view only
 * chooses a colour.
 */

import { Fragment, useEffect, useState } from 'react'

import { assignLease, endLease, getAirlines, getFleet } from '../api.js'
import { formatDate } from '../format.js'

const STATUS_TEXT = {
  ok: 'On lease',
  'expiring-soon': 'Expiring soon',
  expired: 'Expired',
}

function FleetView() {
  const [fleet, setFleet] = useState(null)
  const [airlines, setAirlines] = useState([])
  const [error, setError] = useState(null)

  // which aircraft row is open for editing, or null
  const [editingId, setEditingId] = useState(null)
  // the in-progress edit for that row
  const [draft, setDraft] = useState({ airlineId: '', startDate: '', endDate: '' })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    Promise.all([getFleet(), getAirlines()])
      .then(([f, a]) => {
        setFleet(f.fleet)
        setAirlines(a.airlines)
      })
      .catch((err) => setError(err.message))
  }, [])

  function openEditor(aircraft) {
    setError(null)
    setEditingId(aircraft.id)
    setDraft({
      airlineId: aircraft.lease ? String(aircraft.lease.airlineId) : '',
      startDate: aircraft.lease?.startDate ?? '',
      endDate: aircraft.lease?.endDate ?? '',
    })
  }

  async function save(aircraftId) {
    if (!draft.airlineId || !draft.startDate || !draft.endDate) {
      setError('Pick an airline and both dates.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const { fleet: fresh } = await assignLease(aircraftId, {
        airlineId: Number(draft.airlineId),
        startDate: draft.startDate,
        endDate: draft.endDate,
      })
      setFleet(fresh)
      setEditingId(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function returnAircraft(aircraftId) {
    setBusy(true)
    setError(null)
    try {
      const { fleet: fresh } = await endLease(aircraftId)
      setFleet(fresh)
      setEditingId(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (error && !fleet) {
    return <p className="error">Could not load the fleet: {error}</p>
  }
  if (!fleet) {
    return <p className="loading">Loading…</p>
  }

  return (
    <section className="card">
      <h3>Fleet &amp; Leases</h3>

      <table className="fleet">
        <thead>
          <tr>
            <th>Tail #</th>
            <th>Model</th>
            <th>Lessee</th>
            <th>Start</th>
            <th>End</th>
            <th>Status</th>
            <th aria-label="actions" />
          </tr>
        </thead>
        <tbody>
          {fleet.map((a) => {
            const lease = a.lease
            const editing = editingId === a.id
            return (
              <Fragment key={a.id}>
                <tr>
                  <td className="mono">{a.tailNumber}</td>
                  <td>
                    {a.manufacturer} {a.model}
                  </td>
                  <td>{lease ? lease.lessee : <span className="muted">—</span>}</td>
                  <td>{lease ? formatDate(lease.startDate) : '—'}</td>
                  <td>{lease ? formatDate(lease.endDate) : '—'}</td>
                  <td>
                    {lease ? (
                      <span className={`badge badge-${lease.status}`}>
                        {STATUS_TEXT[lease.status]}
                        {lease.status !== 'ok' && (
                          <>
                            {' '}
                            ·{' '}
                            {lease.daysUntilExpiry < 0
                              ? `${-lease.daysUntilExpiry}d ago`
                              : `${lease.daysUntilExpiry}d`}
                          </>
                        )}
                      </span>
                    ) : (
                      <span className="badge badge-available">Available</span>
                    )}
                  </td>
                  <td className="fleet-actions">
                    <button
                      type="button"
                      className="link-btn"
                      onClick={() => (editing ? setEditingId(null) : openEditor(a))}
                    >
                      {editing ? 'Cancel' : 'Manage'}
                    </button>
                  </td>
                </tr>

                {editing && (
                  <tr className="fleet-editor-row">
                    <td colSpan={7}>
                      <div className="fleet-editor">
                        <label>
                          Airline
                          <select
                            value={draft.airlineId}
                            onChange={(e) =>
                              setDraft({ ...draft, airlineId: e.target.value })
                            }
                            disabled={busy}
                          >
                            <option value="">Select…</option>
                            {airlines.map((al) => (
                              <option key={al.id} value={al.id}>
                                {al.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Start
                          <input
                            type="date"
                            value={draft.startDate}
                            onChange={(e) =>
                              setDraft({ ...draft, startDate: e.target.value })
                            }
                            disabled={busy}
                          />
                        </label>
                        <label>
                          End
                          <input
                            type="date"
                            value={draft.endDate}
                            onChange={(e) =>
                              setDraft({ ...draft, endDate: e.target.value })
                            }
                            disabled={busy}
                          />
                        </label>

                        <div className="fleet-editor-buttons">
                          <button
                            type="button"
                            className="btn-primary"
                            onClick={() => save(a.id)}
                            disabled={busy}
                          >
                            {lease ? 'Reassign' : 'Assign'}
                          </button>
                          {lease && (
                            <button
                              type="button"
                              className="btn-ghost"
                              onClick={() => returnAircraft(a.id)}
                              disabled={busy}
                            >
                              End lease
                            </button>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>

      {error && <p className="error">{error}</p>}
    </section>
  )
}

export default FleetView
