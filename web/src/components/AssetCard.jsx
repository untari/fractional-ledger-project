/**
 * The single aircraft asset shown at the top of the dashboard:
 * what it is, and the running revenue / distribution totals.
 */

// cents -> "$25,000.00"
import { formatCents } from '../format.js';

// destructure the two props passed down from App
function AssetCard({ aircraft, totals }) {
  return (
    <section className="card">
      <div className="asset-head">
        <h2 className="asset-name">
          {/* e.g. "Bombardier Global 7500" */}
          {aircraft.manufacturer} {aircraft.model}
        </h2>
        <span className="asset-tail">TAIL #{aircraft.tailNumber}</span>
      </div>

      {/* description list: three label/value tiles */}
      <dl className="stat-row">
        <div className="stat">
          <dt>Revenue logged</dt>
          <dd>{formatCents(totals.revenueLoggedCents)}</dd>
        </div>
        <div className="stat stat-accent">
          <dt>Distributed to owners</dt>
          <dd>{formatCents(totals.distributedCents)}</dd>
        </div>
        <div className="stat">
          <dt>Flights logged</dt>
          <dd>{totals.revenueEventCount}</dd>
        </div>
      </dl>
    </section>
  );
}

export default AssetCard;
