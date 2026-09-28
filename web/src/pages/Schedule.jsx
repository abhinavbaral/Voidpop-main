// SCHEDULE — the heart of Voidation: when does the next episode drop?
//   1. Your next episodes: airing anime in your library, soonest first, live countdown
//   2. This week: everything airing in the next 7 days, grouped by day
//   3. Upcoming anime: not started yet — mark yourself Excited
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchAiringSchedule, fetchAniList, fetchNextEpisodes } from "@voidation/shared/api/anilist";
import { getLibrary, getExcited, toggleExcited, noteAiring } from "@voidation/shared/backend/store";
import { useAuth } from "@voidation/shared/backend/AuthContext";
import { formatCountdown, dayLabel, airTime, releaseLabel, secondsUntil } from "@voidation/shared/format";
import { useNow } from "@voidation/shared/hooks/useNow";
import { useSettings } from "@voidation/shared/backend/SettingsContext";
import { titlePath, cacheTitle } from "../lib/titles.js";
import { useDocumentTitle } from "../lib/useDocumentTitle.js";
import PendingPanel from "../components/PendingPanel.jsx";
import FilterBar from "../components/FilterBar.jsx";
import { applyFilters } from "@voidation/shared/filters";

// statuses that mean "I still care when the next episode comes out"
const FOLLOWING = new Set(["watching", "plan", "onhold"]);

export default function Schedule() {
  useDocumentTitle("Schedule");
  const { user } = useAuth();
  const now = useNow(1000);
  const { clock24 } = useSettings().settings;
  const [mine, setMine] = useState(null); // null = loading
  const [week, setWeek] = useState(null);
  const [upcoming, setUpcoming] = useState([]);
  const [excited, setExcited] = useState({});
  const [onlyMine, setOnlyMine] = useState(false);
  const [filters, setFilters] = useState({ genre: "", studio: "" });
  const [error, setError] = useState(false);
  const [tracked, setTracked] = useState(new Set());
  const [fetched, setFetched] = useState(0); // bumps after fresh air times are saved

  useEffect(() => {
    let alive = true;
    (async () => {
      // your library is on this device; the countdowns come fresh from AniList
      const lib = Object.values(await getLibrary(user));
      const following = lib.filter((e) => e.item.segment === "anime" && FOLLOWING.has(e.status));
      if (alive) setTracked(new Set(following.map((e) => e.item.id)));
      try {
        const fresh = await fetchNextEpisodes(following.map((e) => e.item.id));
        if (!alive) return;
        // compare with the saved times to spot delays, then read the entries back
        await noteAiring(fresh);
        setFetched((n) => n + 1);
        const saved = await getLibrary(user);
        setMine(
          following
            .map((e) => {
              const now = saved[`anime:${e.item.id}`] || e;
              const item = fresh[e.item.id] || e.item;
              return { status: e.status, item, delay: now.delay?.episode === item.nextEpisode?.episode ? now.delay : null };
            })
            .filter((e) => e.item.nextEpisode)
            .sort((a, b) => a.item.nextEpisode.airingAt - b.item.nextEpisode.airingAt)
        );
      } catch {
        if (alive) { setMine([]); setError(true); }
      }
    })();
    fetchAiringSchedule(7).then((s) => alive && setWeek(s)).catch(() => { if (alive) { setWeek([]); setError(true); } });
    fetchAniList("anime", { sort: "popular", unreleasedOnly: true, perPage: 12 })
      .then((r) => alive && setUpcoming(r.items)).catch(() => {});
    getExcited(user).then((x) => alive && setExcited(x)).catch(() => {});
    return () => { alive = false; };
  }, [user]);

  // group the week by day, dropping episodes that aired more than an hour ago
  const days = useMemo(() => {
    const groups = [];
    (week || [])
      .filter((s) => secondsUntil(s.airingAt, now) > -3600)
      .filter((s) => !onlyMine || tracked.has(s.item.id))
      .filter((s) => applyFilters([s.item], filters).length)
      .forEach((s) => {
        const label = dayLabel(s.airingAt, now);
        const last = groups[groups.length - 1];
        if (last && last.label === label) last.items.push(s);
        else groups.push({ label, items: [s] });
      });
    return groups;
    // the day labels only change at midnight, so re-group once a minute at most
  }, [week, onlyMine, tracked, filters, Math.floor(now / 60000)]); // eslint-disable-line react-hooks/exhaustive-deps

  const excite = async (item) => {
    await toggleExcited(user, item);
    setExcited(await getExcited(user));
  };

  return (
    <div className="stack">
      <div className="row-head">
        <h1>Schedule</h1>
        <Link to="/season" className="btn ghost">Season chart →</Link>
      </div>
      {error && <p className="notice error">Couldn't reach AniList for the latest airing times. Check your connection and reload.</p>}

      <PendingPanel now={now} refreshKey={fetched} />

      <section className="panel">
        <h2>⏳ Your next episodes</h2>
        {mine === null ? (
          <p className="muted">Loading…</p>
        ) : !mine.length ? (
          <p className="muted">
            Nothing you follow is airing right now. Mark an airing anime as <b>Watching</b> or <b>Plan to Watch</b> and
            its countdown shows up here.
          </p>
        ) : (
          <ul className="next-list">
            {mine.map(({ item, delay }) => {
              const next = item.nextEpisode;
              const soon = secondsUntil(next.airingAt, now) < 86400;
              return (
                <li key={item.id}>
                  <Link to={titlePath(item)} onClick={() => cacheTitle(item)} className="next-row">
                    {item.image ? <img src={item.image} alt="" loading="lazy" /> : <span className="thumb-empty" />}
                    <span className="grow">
                      <b className="ellipsis">{item.title}</b>
                      <span className="faint small">
                        Episode {next.episode}{item.episodes ? ` of ${item.episodes}` : ""} · {dayLabel(next.airingAt, now)}, {airTime(next.airingAt, clock24)}
                      </span>
                      {delay && <span className="delayed">Delayed · was {dayLabel(delay.from, now)}, {airTime(delay.from, clock24)}</span>}
                    </span>
                    <span className={`countdown${soon ? " soon" : ""}`} aria-label={`Airs in ${formatCountdown(next.airingAt, now)}`}>
                      {formatCountdown(next.airingAt, now)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="stack-sm">
        <div className="row-head">
          <h2>📅 This week</h2>
          <div className="chips" role="group" aria-label="Show">
            <button className={`chip${!onlyMine ? " on" : ""}`} aria-pressed={!onlyMine} onClick={() => setOnlyMine(false)}>All shows</button>
            <button className={`chip${onlyMine ? " on" : ""}`} aria-pressed={onlyMine} onClick={() => setOnlyMine(true)}>Only mine</button>
          </div>
        </div>
        <FilterBar items={(week || []).map((s) => s.item)} value={filters} onChange={setFilters} />
        {week === null ? (
          <p className="muted">Loading…</p>
        ) : !days.length ? (
          <p className="empty">{filters.genre || filters.studio ? "Nothing this week matches these filters." : onlyMine ? "None of your shows air this week." : "No episodes found for this week."}</p>
        ) : (
          days.map((g) => (
            <section key={g.label} className="panel day-group">
              <h3>{g.label}</h3>
              <ul className="list">
                {g.items.map((s) => (
                  <li key={`${s.item.id}-${s.episode}`}>
                    <Link to={titlePath(s.item)} onClick={() => cacheTitle(s.item)} className="list-row">
                      <span className="air-time">{airTime(s.airingAt, clock24)}</span>
                      {s.item.image ? <img src={s.item.image} alt="" loading="lazy" /> : <span className="thumb-empty" />}
                      <span className="grow">
                        <b className="ellipsis">{s.item.title}</b>
                        <span className="faint small">
                          Episode {s.episode}{tracked.has(s.item.id) ? " · in your library" : ""}
                        </span>
                      </span>
                      <span className="countdown sm">{formatCountdown(s.airingAt, now)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </section>

      {upcoming.length > 0 && (
        <section className="panel">
          <h2>🚀 Upcoming anime</h2>
          <ul className="list">
            {upcoming.slice(0, 8).map((item) => {
              const on = !!excited[`${item.segment}:${item.id}`];
              return (
                <li key={item.id} className="list-row">
                  <Link to={titlePath(item)} onClick={() => cacheTitle(item)} className="row gap-12 grow">
                    {item.image ? <img src={item.image} alt="" loading="lazy" /> : <span className="thumb-empty" />}
                    <span className="grow"><b className="ellipsis">{item.title}</b>
                      <span className="faint small">{item.date ? releaseLabel(item) : "Release date TBA"}</span></span>
                  </Link>
                  <button className={`status-btn excited${on ? " on" : ""}`} aria-pressed={on} onClick={() => excite(item)}>
                    {on ? "Excited ✓" : "Excited?"}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
