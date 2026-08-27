/**
 * The "Log Flight Revenue" form — the one administrative input on the dashboard.
 *
 * The admin types a dollar amount (and an optional note). On submit we:
 *   1. convert the amount to whole cents,
 *   2. POST it to the API (which calculates and stores the payouts),
 *   3. hand the refreshed dashboard data back to the parent via onLogged(),
 *      so the asset card and shareholder table update immediately.
 */

import { useState } from 'react'

import { logRevenue } from '../api.js'
import { dollarsToCents, formatCents } from '../format.js'

function RevenueForm({ aircraftId, onLogged }) {
  const [amount, setAmount] = useState('')
  const [memo, setMemo] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [confirmation, setConfirmation] = useState(null)

  async function handleSubmit(event) {
    // Stop the browser's default "reload the page on form submit" behaviour.
    event.preventDefault()

    const amountCents = dollarsToCents(amount)
    if (amountCents === null) {
      setError('Enter a positive dollar amount (up to 2 decimal places).')
      setConfirmation(null)
      return
    }

    setSubmitting(true)
    setError(null)
    setConfirmation(null)
    try {
      const result = await logRevenue(aircraftId, amountCents, memo.trim())

      onLogged(result.summary) // parent replaces its state -> dashboard re-renders

      const paid = result.distribution.allocations.length
      setConfirmation(
        `Logged ${formatCents(result.distribution.revenueCents)} — split across ${paid} owner${paid === 1 ? '' : 's'}.`,
      )
      setAmount('')
      setMemo('')
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="card">
      <h3>Log Flight Revenue</h3>

      <form onSubmit={handleSubmit} className="revenue-form">
        <label>
          Amount (USD)
          <input
            type="text"
            inputMode="decimal"
            placeholder="50000"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={submitting}
          />
        </label>

        <label>
          Note (optional)
          <input
            type="text"
            placeholder="NYC–London charter"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            disabled={submitting}
          />
        </label>

        <button type="submit" disabled={submitting}>
          {submitting ? 'Logging…' : 'Log revenue'}
        </button>
      </form>

      {error && <p className="error">{error}</p>}
      {confirmation && <p className="confirmation">{confirmation}</p>}
    </section>
  )
}

export default RevenueForm
