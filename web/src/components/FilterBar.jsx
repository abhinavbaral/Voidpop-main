// Genre + studio dropdowns for an already-loaded list (Season chart, Schedule).
import { useMemo } from "react";
import { filterOptions } from "@voidation/shared/filters";

export default function FilterBar({ items, value, onChange }) {
  const { genres, studios } = useMemo(() => filterOptions(items || []), [items]);
  if (!genres.length && !studios.length) return null;
  const active = value.genre || value.studio;
  return (
    <div className="filter-bar" role="group" aria-label="Filter">
      <label className="mini-select">
        <span>Genre</span>
        <select value={value.genre} onChange={(e) => onChange({ ...value, genre: e.target.value })}>
          <option value="">All</option>
          {genres.map((g) => <option key={g.key} value={g.key}>{g.label} ({g.count})</option>)}
        </select>
      </label>
      {studios.length > 0 && (
        <label className="mini-select">
          <span>Studio</span>
          <select value={value.studio} onChange={(e) => onChange({ ...value, studio: e.target.value })}>
            <option value="">All</option>
            {studios.map((s) => <option key={s.key} value={s.key}>{s.label} ({s.count})</option>)}
          </select>
        </label>
      )}
      {active && <button className="link-btn small" onClick={() => onChange({ genre: "", studio: "" })}>Clear filters</button>}
    </div>
  );
}
