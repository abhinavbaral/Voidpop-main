// OUT THIS WEEK (Schedule tab) — a month calendar of premieres (tap a day to see them), what's
// airing in the next 24 hours, and the latest premieres.
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { loadMonthPremieres, monthGrid, dayKey, loadAiringSoon, loadLatestPremieres } from "@voidation/shared/upcoming";
import { getExcited, toggleExcited } from "@voidation/shared/backend/store";
import { useAuth } from "@voidation/shared/backend/AuthContext";
import { useNow } from "@voidation/shared/hooks/useNow";
import { useSettings } from "@voidation/shared/backend/SettingsContext";
import { formatCountdown, airTime } from "@voidation/shared/format";
import PosterRow from "../components/PosterRow.jsx";
import { titlePath, cacheTitle } from "../lib/titles.js";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function Upcoming() {
  const { user } = useAuth();
  const now = useNow(1000);
  const { clock24 } = useSettings().settings;
  const today = new Date();
  const [month, setMonth] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const [byDay, setByDay] = useState(null);
  const [picked, setPicked] = useState(null);
  const [soon, setSoon] = useState(null);
  const [latest, setLatest] = useState([]);
  const [excited, setExcited] = useState({});

  useEffect(() => {
    let alive = true;
    setByDay(null);
    loadMonthPremieres(month.y, month.m).then((d) => {
      if (!alive) return;
      setByDay(d);
      // open on today if it has premieres, else the first day that does
      const t = dayKey(today);
      setPicked(d[t] ? t : Object.keys(d).sort().find((k) => k >= t) || Object.keys(d).sort()[0] || null);
    }).catch(() => alive && setByDay({}));
    return () => { alive = false; };
  }, [month.y, month.m]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    loadAiringSoon(24).then(setSoon).catch(() => setSoon([]));
    loadLatestPremieres(21).then(setLatest).catch(() => {});
    getExcited(user).then(setExcited).catch(() => {});
  }, [user]);

  const weeks = useMemo(() => monthGrid(month.y, month.m), [month.y, month.m]);
  const title = new Date(month.y, month.m, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const shift = (d) => setMonth(({ y, m }) => { const x = new Date(y, m + d, 1); return { y: x.getFullYear(), m: x.getMonth() }; });
  const dayItems = picked && byDay ? byDay[picked] || [] : [];
  const excite = async (item) => { await toggleExcited(user, item); setExcited(await getExcited(user)); };

  return (
    <div className="stack">

      <section className="panel stack-sm">
        <div className="row-head">
          <h2>Premiere calendar</h2>
          <div className="season-nav">
            <button className="icon-btn" aria-label="Previous month" onClick={() => shift(-1)}>‹</button>
            <b>{title}</b>
            <button className="icon-btn" aria-label="Next month" onClick={() => shift(1)}>›</button>
          </div>
        </div>
        <div className="cal" role="grid" aria-label={`Premieres in ${title}`}>
          {WEEKDAYS.map((d) => <div key={d} className="cal-head" role="columnheader">{d}</div>)}
          {weeks.flat().map((d, i) => {
            if (!d) return <div key={i} className="cal-cell empty" />;
            const k = dayKey(d);
            const items = byDay?.[k] || [];
            return (
              <button key={k} role="gridcell" aria-selected={picked === k}
                className={`cal-cell${items.length ? " has" : ""}${picked === k ? " on" : ""}${k === dayKey(today) ? " today" : ""}`}
                onClick={() => setPicked(k)} aria-label={`${d.toDateString()}: ${items.length} premieres`}>
                <span className="cal-num">{d.getDate()}</span>
                {items.length > 0 && (
                  <span className="cal-thumbs">
                    {items.slice(0, 2).map((it) => it.image && <img key={it.id} src={it.image} alt="" loading="lazy" />)}
                    {items.length > 2 && <em>+{items.length - 2}</em>}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {byDay === null ? <p className="muted">Loading…</p> : picked ? (
          <div className="stack-sm">
            <h3 className="cal-day-title">{new Date(`${picked}T00:00`).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</h3>
            {dayItems.length ? (
              <ul className="list">
                {dayItems.map((item) => {
                  const on = !!excited[`anime:${item.id}`];
                  return (
                    <li key={item.id} className="list-row">
                      <Link to={titlePath(item)} onClick={() => cacheTitle(item)} className="row gap-12 grow">
                        {item.image ? <img src={item.image} alt="" loading="lazy" /> : <span className="thumb-empty" />}
                        <span className="grow"><b className="ellipsis">{item.title}</b>
                          <span className="faint small">{[item.format?.replace("_", " "), item.creator, item.genres?.slice(0, 2).join(", ")].filter(Boolean).join(" · ")}</span></span>
                      </Link>
                      {item.unreleased && (
                        <button className={`status-btn excited${on ? " on" : ""}`} aria-pressed={on} onClick={() => excite(item)}>{on ? "Excited ✓" : "Excited?"}</button>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : <p className="muted">No premieres that day.</p>}
          </div>
        ) : <p className="muted">No premieres with a set date this month yet.</p>}
      </section>

      <section className="panel stack-sm">
        <h2>Airing soon <span className="faint small">next 24 hours</span></h2>
        {soon === null ? <p className="muted">Loading…</p> : !soon.length ? <p className="muted">Nothing airs in the next 24 hours.</p> : (
          <ul className="list">
            {soon.map((s) => (
              <li key={`${s.item.id}-${s.episode}`}>
                <Link to={titlePath(s.item)} onClick={() => cacheTitle(s.item)} className="list-row">
                  <span className="air-time">{airTime(s.airingAt, clock24)}</span>
                  {s.item.image ? <img src={s.item.image} alt="" loading="lazy" /> : <span className="thumb-empty" />}
                  <span className="grow"><b className="ellipsis">{s.item.title}</b><span className="faint small">Episode {s.episode}</span></span>
                  <span className="countdown sm">{formatCountdown(s.airingAt, now)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {latest.length > 0 && <PosterRow title="Latest premieres · last 3 weeks" items={latest} now={now} />}
    </div>
  );
}
