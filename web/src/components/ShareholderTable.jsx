/**
 * The list of fractional owners: name, ownership stake, and the total they have
 * been paid so far across every logged flight.
 */

import { formatCents, formatBasisPoints } from '../format.js';

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
          {shareholders.map((s) => (
            <tr key={s.investorId}>
              <td>{s.name}</td>
              <td className="num">{formatBasisPoints(s.basisPoints)}</td>
              <td className="num">{formatCents(s.totalPaidCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export default ShareholderTable;
