/**
 * The list of fractional owners: name, ownership stake, and the total they have
 * been paid so far across every logged flight.
 */

// "$..." and "..%" formatters
import { formatCents, formatBasisPoints } from '../format.js';

// `shareholders` is the array from summary.shareholders
function ShareholderTable({ shareholders }) {
  return (
    <section className="card">
      <h3>Shareholders</h3>
      <table className="shareholders">
        <thead>
          <tr>
            <th>Investor</th>
            <th className="num">Ownership</th>
            <th className="num">Accumulated payout</th>
          </tr>
        </thead>
        <tbody>
          {/* one <tr> per shareholder */}
          {shareholders.map((s) => (
            // key: stable id so React can track rows efficiently across re-renders
            <tr key={s.investorId}>
              <td>{s.name}</td>
              {/* 3750 -> "37.5%" */}
              <td className="num">{formatBasisPoints(s.basisPoints)}</td>
              {/* cents -> "$..." */}
              <td className="num">{formatCents(s.totalPaidCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export default ShareholderTable;
