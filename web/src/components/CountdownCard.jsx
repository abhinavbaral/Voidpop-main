// One followed show: poster, title (+ Japanese title), next episode with a big
// DAY / HOURS / MINS / SECS countdown, and your pending episodes with +1.
import { Link } from "react-router-dom";
import { countdownParts, dayLabel, airTime } from "@voidation/shared/format";
import { titlePath, cacheTitle } from "../lib/titles.js";

const STATUS = { plan: "Plan to Watch", onhold: "On Hold" };

export default function CountdownCard({ show, now, clock24, onPlus }) {
  const { item, next, pending, delay, entry } = show;
  const parts = next ? countdownParts(next.airingAt, now) : null;
  return (
    <article className="cd-card">
      <Link to={titlePath(item)} onClick={() => cacheTitle(item)} className="cd-poster" aria-label={item.title}>
        {item.image ? <img src={item.image} alt="" loading="lazy" /> : <span className="thumb-empty" />}
      </Link>
      <div className="cd-body">
        <Link to={titlePath(item)} onClick={() => cacheTitle(item)} className="cd-title clamp-2">{item.title}</Link>
        {item.altTitle && <div className="cd-alt ellipsis">{item.altTitle}</div>}
        {next ? (
          <>
            <div className="cd-ep">
              Episode {next.episode}{item.episodes ? <span className="faint"> of {item.episodes}</span> : null}
              {STATUS[entry.status] && <span className="cd-status">{STATUS[entry.status]}</span>}
            </div>
            <div className={`cd-boxes${parts.d === 0 ? " soon" : ""}`} aria-label={`Airs in ${parts.d} days ${parts.h} hours ${parts.m} minutes`}>
              {[[parts.d, parts.d === 1 ? "Day" : "Days"], [parts.h, "Hours"], [parts.m, "Mins"], [parts.s, "Secs"]].map(([n, label]) => (
                <span key={label}><b>{n}</b><small>{label}</small></span>
              ))}
            </div>
            <div className="cd-when faint small">
              {dayLabel(next.airingAt, now)}, {airTime(next.airingAt, clock24)}
              {delay && <span className="delayed-inline"> · Delayed, was {dayLabel(delay.from, now)}</span>}
            </div>
          </>
        ) : (
          <div className="cd-ep">No date for the next episode yet</div>
        )}
        {entry.status === "watching" && (
          <div className="cd-foot">
            {pending > 0 ? (
              <>
                <span className="pending-chip">{pending} pending</span>
                <button className="plus-btn big" onClick={() => onPlus(entry)} aria-label={`Watched episode ${(entry.progress || 0) + 1} of ${item.title}`}>+1</button>
              </>
            ) : (
              <span className="watched-tag">Caught up ✓</span>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
