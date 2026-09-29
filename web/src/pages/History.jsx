// HISTORY — episodes that have already aired, newest first, but only for the
// anime you follow: Watching, Plan to Watch, On Hold, or marked Excited.
// (Schedule looks forward; History looks back.)
// Each episode can be marked watched right here; watched ones get a tick.
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchRecentEpisodes } from "@voidation/shared/api/anilist";
import { getLibrary, getExcited, setProgress, addReview, setStatus as saveStatus } from "@voidation/shared/backend/store";
import { useAuth } from "@voidation/shared/backend/AuthContext";
import VerdictModal from "../components/VerdictModal.jsx";
import { useSettings } from "@voidation/shared/backend/SettingsContext";
import { dayLabel, airTime, airedAgo } from "@voidation/shared/format";
import { useNow } from "@voidation/shared/hooks/useNow";
import { titlePath, cacheTitle } from "../lib/titles.js";
import { useDocumentTitle } from "../lib/useDocumentTitle.js";

const FOLLOWING = new Set(["watching", "plan", "onhold"]);
const DAYS = 14;

export default function History() {
  useDocumentTitle("History");
  const { settings } = useSettings();
  const now = useNow(60000);
  const [episodes, setEpisodes] = useState(null);
  const [status, setStatus] = useState({}); // anime id -> "Watching" / "Excited" …
  const [error, setError] = useState(false);
  const [progress, setProgressMap] = useState({}); // anime id -> episodes watched (library titles only)
  const [finishing, setFinishing] = useState(null);
  const { user } = useAuth();

  const readProgress = async () => {
    const map = {};
    Object.values(await getLibrary()).forEach((e) => { if (e.item.segment === "anime") map[e.item.id] = e.progress || 0; });
    setProgressMap(map);
  };

  // marking episode 7 watched means you've watched 1–7
  const markWatched = async (s) => {
    const r = await setProgress(user, s.item, Math.max(progress[s.item.id] || 0, s.episode), "history");
    if (r.reachedEnd) setFinishing(s.item);
    readProgress();
  };
  const finish = async ({ verdict, vibes, moods, comment }) => {
    await saveStatus(user, finishing.segment, finishing, "completed");
    await addReview(user, finishing.segment, finishing.id, { verdict, vibes, moods, comment });
    setFinishing(null);
    readProgress();
  };

  useEffect(() => {
    let alive = true;
    readProgress();
    (async () => {
      const [lib, excited] = await Promise.all([getLibrary(), getExcited()]);
      const labels = {};
      Object.values(lib)
        .filter((e) => e.item.segment === "anime" && FOLLOWING.has(e.status))
        .forEach((e) => { labels[e.item.id] = { watching: "Watching", plan: "Plan to Watch", onhold: "On Hold" }[e.status]; });
      Object.values(excited)
        .filter((e) => e.item.segment === "anime")
        .forEach((e) => { labels[e.item.id] = labels[e.item.id] || "Excited"; });
      if (!alive) return;
      setStatus(labels);
      try {
        const eps = await fetchRecentEpisodes(Object.keys(labels), DAYS);
        if (alive) setEpisodes(eps);
      } catch {
        if (alive) { setEpisodes([]); setError(true); }
      }
    })();
    return () => { alive = false; };
  }, []);

  const days = useMemo(() => {
    const groups = [];
    (episodes || []).forEach((s) => {
      const label = dayLabel(s.airingAt, now);
      const last = groups[groups.length - 1];
      if (last && last.label === label) last.items.push(s);
      else groups.push({ label, items: [s] });
    });
    return groups;
  }, [episodes, Math.floor(now / 3600000)]); // eslint-disable-line react-hooks/exhaustive-deps

  const following = Object.keys(status).length;
  return (
    <div className="stack">
      <div>
        <h1>History</h1>
        <p className="muted">Episodes that aired in the last {DAYS} days for the {following || ""} anime you follow.</p>
      </div>
      {error && <p className="notice error">Couldn't reach AniList. Check your connection and reload.</p>}
      {episodes === null ? (
        <p className="muted">Loading…</p>
      ) : !following ? (
        <p className="notice">
          Nothing to show yet. Mark anime as <b>Watching</b>, <b>Plan to Watch</b>, <b>On Hold</b> or <b>Excited</b> and
          their new episodes collect here. <Link to="/schedule">See what's airing →</Link>
        </p>
      ) : !days.length ? (
        <p className="empty">No new episodes in the last {DAYS} days for the shows you follow.</p>
      ) : (
        days.map((g) => (
          <section key={g.label} className="panel day-group">
            <h3>{g.label}</h3>
            <ul className="list">
              {g.items.map((s) => (
                <li key={`${s.item.id}-${s.episode}`} className="list-row">
                  <Link to={titlePath(s.item)} onClick={() => cacheTitle(s.item)} className="row gap-12 grow">
                    <span className="air-time">{airTime(s.airingAt, settings.clock24)}</span>
                    {s.item.image ? <img src={s.item.image} alt="" loading="lazy" /> : <span className="thumb-empty" />}
                    <span className="grow">
                      <b className="ellipsis">{s.item.title}</b>
                      <span className="faint small">Episode {s.episode} · {airedAgo(s.airingAt, now)} · {status[s.item.id]}</span>
                    </span>
                  </Link>
                  {(progress[s.item.id] || 0) >= s.episode ? (
                    <span className="watched-tag" aria-label={`Episode ${s.episode} watched`}>Watched ✓</span>
                  ) : (
                    <button className="status-btn" onClick={() => markWatched(s)}>Mark watched</button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
      {finishing && <VerdictModal open initial={null} onSave={finish} onClose={() => { setFinishing(null); readProgress(); }} />}
    </div>
  );
}
