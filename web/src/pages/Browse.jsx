// BROWSE — filters live in the URL (/browse?type=anime&origin=JP&sort=trending)
// so every view can be bookmarked and shared.
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { fetchAniList, SORTS, SEASONS, GENRES, ANIME_ORIGINS, MANGA_ORIGINS } from "@voidation/shared/api/anilist";
import { useNow } from "@voidation/shared/hooks/useNow";
import Card, { CardSkeleton } from "../components/Card.jsx";
import { SEGMENTS, SEGMENT_LABEL } from "../lib/titles.js";
import { useDocumentTitle } from "../lib/useDocumentTitle.js";

const ORIGINS = { anime: ANIME_ORIGINS, manga: MANGA_ORIGINS };
const THIS_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 10 }, (_, i) => String(THIS_YEAR - i));

// embedded: shown as the last section of Explore (Browse now lives there)
export default function Browse({ embedded = false }) {
  const [params, setParams] = useSearchParams();
  const segment = SEGMENTS.includes(params.get("type")) ? params.get("type") : "anime";
  const origin = params.get("origin") || "";
  const sort = params.get("sort") || "popular";
  const season = segment === "anime" ? params.get("season") || "" : "";
  const year = params.get("year") || String(THIS_YEAR);
  const genre = params.get("genre") || "";
  useDocumentTitle(embedded ? null : `Browse ${SEGMENT_LABEL[segment]}`);
  const now = useNow(30000);

  const set = (patch) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) (v ? next.set(k, v) : next.delete(k));
    setParams(next, { replace: true });
  };

  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Every filter change bumps this; responses from older requests are ignored,
  // so a slow page-2 for "Anime" can never land in the "Manga" grid.
  const reqId = useRef(0);
  const busy = useRef(false);

  const load = useCallback(async (pageToLoad, reset) => {
    if (busy.current && !reset) return;
    const id = reset ? ++reqId.current : reqId.current;
    busy.current = true;
    setLoading(true);
    setError(null);
    try {
      const opts = { page: pageToLoad, sort, origin, genre };
      const res = await fetchAniList(segment, { ...opts, season, year: Number(year) });
      if (id !== reqId.current) return; // stale
      setItems((prev) => {
        const base = reset ? [] : prev;
        const seen = new Set(base.map((i) => i.id));
        return [...base, ...res.items.filter((i) => !seen.has(i.id))];
      });
      setHasMore(res.hasMore);
      setPage(pageToLoad + 1);
    } catch (e) {
      if (id !== reqId.current) return;
      setError("Couldn't load titles. Check your connection and retry.");
      setHasMore(false);
    } finally {
      if (id === reqId.current) { busy.current = false; setLoading(false); }
    }
  }, [segment, origin, sort, season, year, genre]);

  useEffect(() => {
    setItems([]);
    setHasMore(true);
    load(1, true);
  }, [load]);

  // infinite scroll
  const sentinel = useRef(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => e[0].isIntersecting && hasMore && !busy.current && load(page, false), { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, page, load]);

  return (
    <div className={embedded ? "stack browse-embedded" : "stack"} id={embedded ? "browse" : undefined}>
      <div className="browse-head">
        {embedded ? <h2>🔎 Browse everything</h2> : <h1>Browse</h1>}
        <div className="seg-tabs" role="tablist" aria-label="Type">
          {SEGMENTS.map((s) => (
            <button key={s} role="tab" aria-selected={s === segment} className={`seg-tab${s === segment ? " on" : ""}`}
              onClick={() => setParams(new URLSearchParams({ type: s }), { replace: true })}>
              {SEGMENT_LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      <div className="filters">
        <Select id="f-origin" label="Origin"
          value={origin} onChange={(v) => set({ origin: v })} options={ORIGINS[segment]} />
        <Select id="f-genre" label="Genre" value={genre} onChange={(v) => set({ genre: v })}
          options={[{ key: "", label: "All genres" }, ...GENRES.map((g) => ({ key: g, label: g }))]} />
        {segment === "anime" && (
          <Select id="f-season" label="Season" value={season} onChange={(v) => set({ season: v })}
            options={[{ key: "", label: "All time" }, ...SEASONS.map((s) => ({ key: s, label: s[0].toUpperCase() + s.slice(1) }))]} />
        )}
        {segment === "anime" && season && (
          <Select id="f-year" label="Year" value={year} onChange={(v) => set({ year: v })} options={YEARS.map((y) => ({ key: y, label: y }))} />
        )}
        {!(segment === "anime" && season) && (
          <Select id="f-sort" label="Sort by" value={sort} onChange={(v) => set({ sort: v === "popular" ? "" : v })} options={SORTS} />
        )}
      </div>

      {error ? (
        <p className="notice error">{error}
          <button className="btn primary sm ml-8" onClick={() => load(1, true)}>Retry</button>
        </p>
      ) : (
        <>
          <div className="grid">
            {items.map((it) => <Card key={`${segment}-${it.id}`} item={it} now={now} />)}
            {loading && Array.from({ length: items.length ? 6 : 12 }, (_, i) => <CardSkeleton key={`s${i}`} />)}
          </div>
          {!loading && !items.length && <p className="empty">No titles match these filters.</p>}
          <div ref={sentinel} />
        </>
      )}
    </div>
  );
}

function Select({ id, label, value, onChange, options }) {
  return (
    <label className="select" htmlFor={id}>
      <span>{label}</span>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o.key || "all"} value={o.key}>{o.label}</option>)}
      </select>
    </label>
  );
}
