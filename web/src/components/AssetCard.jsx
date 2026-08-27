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
      <h2 className="asset-name">
        {/* e.g. "Bombardier Global 7500" */}
        {aircraft.manufacturer} {aircraft.model}
      </h2>
      <p className="asset-tail">Tail #{aircraft.tailNumber}</p>

      {/* description list: three label/value pairs */}
      <dl className="stat-row">
        <div className="stat">
          <dt>Revenue logged</dt>
          {/* total revenue ever logged */}
          <dd>{formatCents(totals.revenueLoggedCents)}</dd>
        </div>
        <div className="stat">
          <dt>Distributed to owners</dt>
          {/* total ever paid out */}
          <dd>{formatCents(totals.distributedCents)}</dd>
        </div>
        <div className="stat">
          <dt>Ownership allocated</dt>
          {/* already a plain number, e.g. 100 */}
          <dd>{totals.ownedPercent}%</dd>
        </div>
      </dl>
    </section>
  );
}

export default AssetCard;
