// SEASON CHART — every anime of a season, grouped by format (TV, ONA, Movies…),
// with countdowns and one-tap Plan to Watch. ‹ › moves between seasons.
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@voidation/shared/backend/AuthContext";
import { getLibrary, setStatus, statusesFor } from "@voidation/shared/backend/store";
import { useNow } from "@voidation/shared/hooks/useNow";
import { seasonOf, shiftSeason, seasonTitle, FORMAT_GROUPS, groupOf, fetchSeason } from "@voidation/shared/season";
import Card, { CardSkeleton } from "../components/Card.jsx";
import { useDocumentTitle } from "../lib/useDocumentTitle.js";
import FilterBar from "../components/FilterBar.jsx";
import { applyFilters } from "@voidation/shared/filters";

export default function Season() {
  const { user } = useAuth();
  const now = useNow(30000);
  const [season, setSeason] = useState(seasonOf);
  const [items, setItems] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [group, setGroup] = useState("all");
  const [lib, setLib] = useState({});
  const [filters, setFilters] = useState({ genre: "", studio: "" });
  useDocumentTitle(`${seasonTitle(season)} season`);

  useEffect(() => { getLibrary(user).then(setLib).catch(() => {}); }, [user]);

  useEffect(() => {
    let alive = true;
    setItems(null);
    setError(false);
    setLoadingMore(true);
    fetchSeason(season, (so) => alive && setItems(so))
      .then((all) => alive && setItems(all))
      .catch(() => alive && setError(true))
      .finally(() => alive && setLoadingMore(false));
    return () => { alive = false; };
  }, [season]);

  const counts = useMemo(() => {
    const c = {};
    (items || []).forEach((it) => { const g = groupOf(it); c[g] = (c[g] || 0) + 1; });
    return c;
  }, [items]);
  const shown = applyFilters((items || []).filter((it) => group === "all" || groupOf(it) === group), filters);
  const label = (key) => statusesFor("anime").find((s) => s.key === key)?.label;

  // adds to Plan to Watch, or undoes that; never removes a title you're
  // already watching (that would throw away its progress)
  const togglePlan = async (item) => {
    const tracked = lib[`anime:${item.id}`];
    if (tracked && tracked.status !== "plan") return;
    await setStatus(user, "anime", item, tracked ? null : "plan");
    setLib(await getLibrary(user));
  };

  return (
    <div className="stack">
      <div className="browse-head">
        <h1>Season chart</h1>
        <div className="season-nav" role="group" aria-label="Season">
          <button className="icon-btn" aria-label="Previous season" onClick={() => setSeason((s) => shiftSeason(s, -1))}>‹</button>
          <b>{seasonTitle(season)}</b>
          <button className="icon-btn" aria-label="Next season" onClick={() => setSeason((s) => shiftSeason(s, 1))}>›</button>
        </div>
      </div>
      <div className="chips" role="tablist" aria-label="Format">
        <button role="tab" aria-selected={group === "all"} className={`chip${group === "all" ? " on" : ""}`} onClick={() => setGroup("all")}>
          All {items && <span className="count">{items.length}</span>}
        </button>
        {FORMAT_GROUPS.filter((g) => counts[g.key]).map((g) => (
          <button key={g.key} role="tab" aria-selected={group === g.key} className={`chip${group === g.key ? " on" : ""}`} onClick={() => setGroup(g.key)}>
            {g.label} <span className="count">{counts[g.key]}</span>
          </button>
        ))}
      </div>
      <FilterBar items={items} value={filters} onChange={setFilters} />
      {error && !items?.length && <p className="notice error">Couldn't load this season. Check your connection and try again.</p>}
      {items === null ? (
        <div className="grid">{Array.from({ length: 12 }, (_, i) => <CardSkeleton key={i} />)}</div>
      ) : !shown.length ? (
        <p className="empty">{loadingMore ? "Loading…" : filters.genre || filters.studio ? "Nothing matches these filters." : "Nothing announced for this season yet."}</p>
      ) : (
        <div className="grid">
          {shown.map((it) => {
            const tracked = lib[`anime:${it.id}`];
            return (
              <div key={it.id} className="season-cell">
                <Card item={it} now={now} />
                <button className={`status-btn season-add${tracked ? " on" : ""}`} aria-pressed={!!tracked} onClick={() => togglePlan(it)}
                  disabled={!!tracked && tracked.status !== "plan"}
                  title={!tracked ? "Add to Plan to Watch" : tracked.status === "plan" ? "Remove from Plan to Watch" : "Already in your library"}>
                  {tracked ? `✓ ${label(tracked.status)}` : "+ Plan to Watch"}
                </button>
              </div>
            );
          })}
        </div>
      )}
      {loadingMore && items?.length > 0 && <p className="faint small">Loading the rest of the season…</p>}
    </div>
  );
}
