// Poster card — a real link, so middle-click / ctrl-click opens a new tab.
// Under the poster: Title · Creator (mangaka / studio) · Genre · release date,
// plus a live "Ep 7 in 2d 4h" badge on anime that are currently airing.
import { Link } from "react-router-dom";
import { releaseLabel, formatCountdown } from "@voidation/shared/format";
import { useSettings } from "@voidation/shared/backend/SettingsContext";
import { titlePath, cacheTitle } from "../lib/titles.js";
import { progressLabel, behind, canAddOne } from "./Progress.jsx";
import { doneLabel } from "@voidation/shared/backend/store";

// `entry` (Library only): shows your progress and, with onPlus, a +1 button.
// `selecting` (Library's Select mode): a tap selects instead of opening.
export default function Card({ item, now, entry, onPlus, selecting, selected, onToggle }) {
  const creator = item.creator;
  const { settings } = useSettings();
  const next = settings.posterBadges ? item.nextEpisode : null;
  return (
    <Link to={titlePath(item)} className={`card${selecting ? " selecting" : ""}${selected ? " selected" : ""}`}
      aria-pressed={selecting ? !!selected : undefined}
      onClick={(e) => { if (selecting) { e.preventDefault(); onToggle?.(); } else cacheTitle(item); }}>
      {selecting && <span className="select-tick" aria-hidden="true">{selected ? "✓" : ""}</span>}
      <div className="card-poster">
        {item.image ? <img src={item.image} alt="" loading="lazy" /> : <span>No image</span>}
        {next && (
          <span className={`card-countdown${entry?.delay ? " late" : ""}`} title={`Episode ${next.episode}`}>
            {entry?.delay ? "Delayed · " : ""}Ep {next.episode} · {formatCountdown(next.airingAt, now)}
          </span>
        )}
      </div>
      <div className="card-meta">
        <div className="card-title clamp-2">{item.title}</div>
        {/* always rendered so rows keep an even height while it loads */}
        <div className="card-creator ellipsis">{creator || " "}</div>
        <div className="card-sub ellipsis">{item.genre} · {releaseLabel(item)}</div>
        {entry && (
          <div className="card-progress">
            {entry.status === "completed" ? (
              <span className="ellipsis done-label">{doneLabel(item)}</span>
            ) : (
              <span className="ellipsis">
                {progressLabel(item, entry.progress)}
                {behind(item, entry.progress) > 0 && <span className="behind"> · {behind(item, entry.progress)} new</span>}
              </span>
            )}
            {onPlus && !selecting && canAddOne(item, entry.progress || 0) && (
              <button className="plus-btn" aria-label={`Mark next ${item.segment === "manga" ? "chapter read" : "episode watched"}`}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onPlus(); }}>+1</button>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}

export function CardSkeleton() {
  return (
    <div className="card skeleton-card" aria-hidden="true">
      <div className="card-poster skeleton" />
      <div className="card-meta">
        <div className="skeleton line" style={{ width: "80%" }} />
        <div className="skeleton line" style={{ width: "50%" }} />
        <div className="skeleton line" style={{ width: "65%" }} />
      </div>
    </div>
  );
}
