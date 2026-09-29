// WATCHING THIS SEASON — your Watching anime that are airing (or that you're
// behind on), with a Pending count: episodes that are out but not watched yet.
// New episodes add to it automatically; +1 takes one off.
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@voidation/shared/backend/AuthContext";
import { getPending, setProgress, setStatus, addReview, onDataChange, totalFor } from "@voidation/shared/backend/store";
import { formatCountdown } from "@voidation/shared/format";
import { titlePath, cacheTitle } from "../lib/titles.js";
import VerdictModal from "./VerdictModal.jsx";

export default function PendingPanel({ now, refreshKey }) {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [finishing, setFinishing] = useState(null);
  const load = useCallback(() => getPending().then(setData).catch(() => {}), []);

  useEffect(() => { load(); }, [load, refreshKey]);
  useEffect(() => onDataChange(load), [load]);
  // an episode airing while the page is open moves into Pending on its own
  const minute = Math.floor(now / 60000);
  useEffect(() => { load(); }, [minute, load]);

  if (!data || !data.items.length) return null;

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
    <section className="panel pending-panel">
      <div className="row-head">
        <h2>Watching this season</h2>
        <span className={`pending-total${data.total ? " on" : ""}`}>
          {data.total ? `${data.total} pending` : "All caught up"}
        </span>
      </div>
      <ul className="next-list">
        {data.items.map(({ entry, pending }) => {
          const it = entry.item;
          const next = it.nextEpisode && it.nextEpisode.airingAt > now / 1000 ? it.nextEpisode : null;
          return (
            <li key={it.id} className="pending-row">
              <Link to={titlePath(it)} onClick={() => cacheTitle(it)} className="next-row grow">
                {it.image ? <img src={it.image} alt="" loading="lazy" /> : <span className="thumb-empty" />}
                <span className="grow">
                  <b className="ellipsis">{it.title}</b>
                  <span className="faint small">
                    Watched {entry.progress || 0}{totalFor(it) ? ` of ${totalFor(it)}` : ""}
                    {next ? ` · Ep ${next.episode} in ${formatCountdown(next.airingAt, now)}` : ""}
                  </span>
                </span>
              </Link>
              {pending > 0 ? (
                <>
                  <span className="pending-chip">{pending} pending</span>
                  <button className="plus-btn big" onClick={() => plus(entry)} aria-label={`Watched episode ${(entry.progress || 0) + 1} of ${it.title}`}>+1</button>
                </>
              ) : (
                <span className="watched-tag">Caught up ✓</span>
              )}
            </li>
          );
        })}
      </ul>
      {finishing && <VerdictModal open initial={null} onSave={finish} onClose={() => setFinishing(null)} />}
    </section>
  );
}
