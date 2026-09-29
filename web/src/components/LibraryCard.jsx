// Library poster: the whole card is the cover, title over the bottom, and a
// badge with how many episodes (chapters) are out that you haven't watched.
import { Link } from "react-router-dom";
import { leftToWatch } from "@voidation/shared/backend/store";
import { titlePath, cacheTitle } from "../lib/titles.js";

export default function LibraryCard({ entry, selecting, selected, onToggle }) {
  const item = entry.item;
  const left = leftToWatch(entry);
  const unit = item.segment === "manga" ? "chapters" : "episodes";
  return (
    <Link
      to={titlePath(item)}
      className={`lib-card${selecting ? " selecting" : ""}${selected ? " selected" : ""}`}
      aria-pressed={selecting ? !!selected : undefined}
      aria-label={`${item.title}${left ? `, ${left} ${unit} left` : ""}`}
      onClick={(e) => { if (selecting) { e.preventDefault(); onToggle?.(); } else cacheTitle(item); }}
    >
      {item.image ? <img src={item.image} alt="" loading="lazy" /> : <span className="lib-noimg" />}
      {left > 0 && <span className="lib-badge" title={`${left} ${unit} left to ${item.segment === "manga" ? "read" : "watch"}`}>{left}</span>}
      {entry.delay && <span className="lib-late">Delayed</span>}
      {selecting && <span className="select-tick" aria-hidden="true">{selected ? "✓" : ""}</span>}
      <span className="lib-title clamp-2">{item.title}</span>
    </Link>
  );
}
