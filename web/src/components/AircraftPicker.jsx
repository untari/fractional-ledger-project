/**
 * Dropdown to choose which aircraft the dashboard shows.
 *
 * Presentational: it renders the options it is given and reports the new
 * selection upward via onSelect(). It holds no state of its own.
 */

function AircraftPicker({ aircraft, selectedId, onSelect }) {
  return (
    <label className="aircraft-picker">
      Aircraft
      <select
        value={selectedId ?? ''}
        // <select> values are always strings; convert back to a number
        onChange={(e) => onSelect(Number(e.target.value))}
      >
        {aircraft.map((a) => (
          <option key={a.id} value={a.id}>
            {a.manufacturer} {a.model} — {a.tailNumber}
          </option>
        ))}
      </select>
    </label>
  )
}

export default AircraftPicker
