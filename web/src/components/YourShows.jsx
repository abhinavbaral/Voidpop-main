// YOUR SHOWS — "Your next episodes" and "Watching this season" in one: every
// anime you follow with an episode coming (big countdown) or episodes you
// haven't watched yet (Pending, +1). Schedule shows them as a grid; Explore as
// a scrolling "Up next" row.
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@voidation/shared/backend/AuthContext";
import {
  getLibrary, yourShows, setProgress, setStatus, addReview, onDataChange, noteAiring,
} from "@voidation/shared/backend/store";
import { fetchNextEpisodes } from "@voidation/shared/api/anilist";
import { useSettings } from "@voidation/shared/backend/SettingsContext";
import CountdownCard from "./CountdownCard.jsx";
import VerdictModal from "./VerdictModal.jsx";

const FOLLOWING = new Set(["watching", "plan", "onhold"]);

export default function YourShows({ now, layout = "grid", title = "Your shows", emptyText }) {
  const { user } = useAuth();
  const { clock24 } = useSettings().settings;
  const [lib, setLib] = useState(null);
  const [fresh, setFresh] = useState({});
  const [finishing, setFinishing] = useState(null);

  const readLib = useCallback(() => getLibrary(user).then(setLib).catch(() => setLib({})), [user]);
  useEffect(() => {
    let alive = true;
    (async () => {
      const l = await getLibrary(user);
      if (!alive) return;
      setLib(l);
      const ids = Object.values(l).filter((e) => e.item.segment === "anime" && FOLLOWING.has(e.status)).map((e) => e.item.id);
      const f = await fetchNextEpisodes(ids).catch(() => ({}));
      if (!alive) return;
      setFresh(f);
      if (await noteAiring(f)) readLib(); // new air times saved; spots delays
    })();
    return () => { alive = false; };
  }, [user, readLib]);
  useEffect(() => onDataChange(readLib), [readLib]);

  if (!lib) return layout === "grid" ? <p className="muted">Loading…</p> : null;
  const shows = yourShows(lib, fresh, now);
  const pending = shows.reduce((n, s) => n + s.pending, 0);
  if (!shows.length) {
    return layout === "grid" && emptyText ? (
      <section className="stack-sm"><h2>{title}</h2><p className="muted">{emptyText}</p></section>
    ) : null;
  }

  const plus = async (entry) => {
    const r = await setProgress(user, entry.item, (entry.progress || 0) + 1, "plus");
    if (r.reachedEnd) setFinishing(entry.item);
  };
  const finish = async ({ verdict, vibes, moods, comment }) => {
    await setStatus(user, finishing.segment, finishing, "completed");
    await addReview(user, finishing.segment, finishing.id, { verdict, vibes, moods, comment });
    setFinishing(null);
  };

  return (
    <section className="stack-sm">
      <div className="row-head">
        <h2>{title}</h2>
        <span className={`pending-total${pending ? " on" : ""}`}>{pending ? `${pending} pending` : "All caught up"}</span>
      </div>
      <div className={layout === "row" ? "cd-row" : "cd-grid"}>
        {shows.map((s) => <CountdownCard key={s.item.id} show={s} now={now} clock24={clock24} onPlus={plus} />)}
      </div>
      {finishing && <VerdictModal open initial={null} onSave={finish} onClose={() => setFinishing(null)} />}
    </section>
  );
}
