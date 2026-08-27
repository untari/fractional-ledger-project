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
  // the text in the "Amount" input
  const [amount, setAmount] = useState('')
  // the text in the "Note" input
  const [memo, setMemo] = useState('')
  // true while the request is in flight (used to disable the form)
  const [submitting, setSubmitting] = useState(false)
  // validation or server error message, or null
  const [error, setError] = useState(null)
  // success message shown after a log, or null
  const [confirmation, setConfirmation] = useState(null)

  async function handleSubmit(event) {
    // stop the browser's default "reload the page on form submit" behaviour
    event.preventDefault()

    // "50,000" -> 5000000, or null if the input is invalid
    const amountCents = dollarsToCents(amount)
    if (amountCents === null) {
      setError('Enter a positive dollar amount (up to 2 decimal places).')
      // clear any old success message
      setConfirmation(null)
      // stop here — don't call the API
      return
    }

    // lock the form
    setSubmitting(true)
    // clear previous messages
    setError(null)
    setConfirmation(null)
    try {
      // POST to the API and wait for the response
      const result = await logRevenue(aircraftId, amountCents, memo.trim())

      // parent replaces its state -> the whole dashboard re-renders
      onLogged(result.summary)

      // how many owners got a share
      const paid = result.distribution.allocations.length
      // build the success message (with correct singular/plural "owner(s)")
      setConfirmation(
        `Logged ${formatCents(result.distribution.revenueCents)} — split across ${paid} owner${paid === 1 ? '' : 's'}.`,
      )
      // reset the inputs for the next entry
      setAmount('')
      setMemo('')
    } catch (err) {
      // show whatever the API / network reported
      setError(err.message)
    } finally {
      // unlock the form whether it succeeded or failed
      setSubmitting(false)
    }
  }

  return (
    <section className="card">
      <h3>Log Flight Revenue</h3>

      {/* onSubmit fires on button click or Enter in a field */}
      <form onSubmit={handleSubmit} className="revenue-form">
        {/* Note: JSX does not allow comments between an element's attributes,
            so these notes sit at the end of each attribute line instead. */}
        <label>
          Amount (USD)
          <input
            type="text"
            inputMode="decimal" // hints mobile keyboards to show a number pad
            placeholder="50000"
            value={amount} // controlled input: React state is the source of truth
            onChange={(e) => setAmount(e.target.value)} // sync state on every keystroke
            disabled={submitting} // grey it out mid-request
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
          {/* button label reflects the submitting state */}
          {submitting ? 'Logging…' : 'Log revenue'}
        </button>
      </form>

      {/* render only when `error` is truthy */}
      {error && <p className="error">{error}</p>}
      {/* render only when `confirmation` is truthy */}
      {confirmation && <p className="confirmation">{confirmation}</p>}
    </section>
  )
}

export default RevenueForm
