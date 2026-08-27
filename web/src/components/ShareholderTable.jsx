/**
 * The list of fractional owners: name, ownership stake (with a visual bar), and
 * the total they have been paid so far across every logged flight.
 */

// "37.5%" formatter
import { formatBasisPoints } from '../format.js';
// currency value that flashes when it goes up
import AnimatedCents from './AnimatedCents.jsx';

// `shareholders` is the array from summary.shareholders
function ShareholderTable({ shareholders }) {
  return (
    <section className="card">
      <h3>Shareholders</h3>
      <table className="shareholders">
        <thead>
          <tr>
            <th>Investor</th>
            <th>Ownership</th>
            <th className="num">Accumulated payout</th>
          </tr>
        </thead>
        <tbody>
          {/* one <tr> per shareholder; key = stable id for React */}
          {shareholders.map((s) => (
            <tr key={s.investorId}>
              <td className="holder-name">{s.name}</td>
              <td className="ownership-cell">
                {formatBasisPoints(s.basisPoints)}
                {/* bar filled to the ownership percentage */}
                <div className="ownership-bar">
                  <span style={{ width: `${s.basisPoints / 100}%` }} />
                </div>
              </td>
              <td className="num">
                <AnimatedCents value={s.totalPaidCents} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export default ShareholderTable;
