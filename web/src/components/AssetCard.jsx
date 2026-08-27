/**
 * The single aircraft asset shown at the top of the dashboard:
 * what it is, and the running revenue / distribution totals.
 */

import { formatCents } from '../format.js';

function AssetCard({ aircraft, totals }) {
  return (
    <section className="card">
      <h2 className="asset-name">
        {aircraft.manufacturer} {aircraft.model}
      </h2>
      <p className="asset-tail">Tail #{aircraft.tailNumber}</p>

      <dl className="stat-row">
        <div className="stat">
          <dt>Revenue logged</dt>
          <dd>{formatCents(totals.revenueLoggedCents)}</dd>
        </div>
        <div className="stat">
          <dt>Distributed to owners</dt>
          <dd>{formatCents(totals.distributedCents)}</dd>
        </div>
        <div className="stat">
          <dt>Ownership allocated</dt>
          <dd>{totals.ownedPercent}%</dd>
        </div>
      </dl>
    </section>
  );
}

export default AssetCard;
