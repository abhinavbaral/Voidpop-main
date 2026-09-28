// Episode / chapter progress: "Ep 7 / 12" with − and +1.
// Used on the title page (big) and on Library cards (compact).
import { totalFor, unitFor, airedFor } from "@voidation/shared/backend/store";

export function progressLabel(item, progress) {
  const total = totalFor(item);
  return `${unitFor(item.segment)} ${progress || 0}${total ? ` / ${total}` : ""}`;
}

// "2 new": aired episodes you haven't watched (anime only)
export function behind(item, progress) {
  const aired = airedFor(item);
  return aired == null ? 0 : Math.max(0, aired - (progress || 0));
}

export default function ProgressStepper({ item, progress, onChange }) {
  const total = totalFor(item);
  const unit = item.segment === "manga" ? "Chapters read" : "Episodes watched";
  const pct = total ? Math.min(100, (progress / total) * 100) : 0;
  const late = behind(item, progress);
  return (
    <section className="panel progress-panel">
      <div className="grow">
        <div className="eyebrow">{unit}</div>
        <b className="progress-num">{progress}{total ? <span className="faint"> / {total}</span> : null}</b>
        {late > 0 && <span className="behind">{late} new {late === 1 ? "episode" : "episodes"} to watch</span>}
        {total ? <div className="progress-bar" aria-hidden="true"><span style={{ width: `${pct}%` }} /></div> : null}
      </div>
      <div className="row gap-8">
        <button className="btn ghost" onClick={() => onChange(progress - 1)} disabled={progress <= 0} aria-label="One less">−</button>
        <button className="btn primary" onClick={() => onChange(progress + 1)} disabled={!!total && progress >= total}>
          +1 {unitFor(item.segment)}
        </button>
      </div>
    </section>
  );
}
