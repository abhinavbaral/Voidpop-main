// Episode / chapter progress: "Ep 7 / 12" with −, +1, and a number you can type.
// You can't go past what's out: aired episodes for anime, the chapter count for
// finished manga (ongoing manga have no known count, so any number is fine).
import { useState } from "react";
import { totalFor, unitFor, airedFor, maxProgress, checkProgress } from "@voidation/shared/backend/store";

export function progressLabel(item, progress) {
  const total = totalFor(item);
  return `${unitFor(item.segment)} ${progress || 0}${total ? ` / ${total}` : ""}`;
}

// "2 new": aired episodes you haven't watched (anime only)
export function behind(item, progress) {
  const aired = airedFor(item);
  return aired == null ? 0 : Math.max(0, aired - (progress || 0));
}

export const canAddOne = (item, progress) => {
  const max = maxProgress(item);
  return max == null || progress < max;
};

export default function ProgressStepper({ item, progress, onChange }) {
  const total = totalFor(item);
  const max = maxProgress(item);
  const unit = item.segment === "manga" ? "Chapters read" : "Episodes watched";
  const pct = total ? Math.min(100, (progress / total) * 100) : 0;
  const late = behind(item, progress);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");

  const startEdit = () => { setDraft(String(progress)); setError(""); setEditing(true); };
  const commit = (e) => {
    e?.preventDefault();
    const err = checkProgress(item, draft);
    if (err) { setError(err); return; }
    setEditing(false);
    if (Number(draft) !== progress) onChange(Number(draft), "typed");
  };

  return (
    <section className="panel progress-panel">
      <div className="grow">
        <div className="eyebrow">{unit}</div>
        {editing ? (
          <form className="row gap-8" onSubmit={commit}>
            <input className="input progress-input" inputMode="numeric" autoFocus value={draft} aria-label={unit}
              aria-invalid={!!error} onChange={(e) => { setDraft(e.target.value.replace(/[^\d]/g, "")); setError(""); }}
              onKeyDown={(e) => e.key === "Escape" && setEditing(false)} />
            {total ? <span className="faint">/ {total}</span> : null}
            <button className="btn primary">Save</button>
            <button type="button" className="btn ghost" onClick={() => setEditing(false)}>Cancel</button>
          </form>
        ) : (
          <button className="progress-num as-text" onClick={startEdit} title="Tap to type a number">
            {progress}{total ? <span className="faint"> / {total}</span> : null} <span className="edit-hint">✎</span>
          </button>
        )}
        {error && <span className="field-error" role="alert">{error}</span>}
        {!error && late > 0 && <span className="behind">{late} new {late === 1 ? "episode" : "episodes"} to watch</span>}
        {!error && item.segment === "manga" && !total && (
          <span className="faint small">Still publishing: the latest chapter number isn't known, so any number is accepted.</span>
        )}
        {total ? <div className="progress-bar" aria-hidden="true"><span style={{ width: `${pct}%` }} /></div> : null}
      </div>
      <div className="row gap-8">
        <button className="btn ghost" onClick={() => onChange(progress - 1)} disabled={progress <= 0} aria-label="One less">−</button>
        <button className="btn primary" onClick={() => onChange(progress + 1)} disabled={max != null && progress >= max}
          title={max != null && progress >= max ? "You're caught up" : undefined}>
          +1 {unitFor(item.segment)}
        </button>
      </div>
    </section>
  );
}
