// Search anime and manga. The query lives in the URL (/search?q=naruto).
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { fetchAniList } from "@voidation/shared/api/anilist";
import { releaseLabel } from "@voidation/shared/format";
import { titlePath, cacheTitle } from "../lib/titles.js";
import { useDocumentTitle } from "../lib/useDocumentTitle.js";

export default function Search() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") || "";
  const [text, setText] = useState(q);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(false);
  const reqId = useRef(0);
  useDocumentTitle(q ? `“${q}”` : "Search");

  useEffect(() => setText(q), [q]);

  // debounce typing into the URL
  useEffect(() => {
    const t = setTimeout(() => {
      if (text.trim() !== q) setParams(text.trim() ? { q: text.trim() } : {}, { replace: true });
    }, 300);
    return () => clearTimeout(t);
  }, [text]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) { setSections([]); return; }
    const id = ++reqId.current;
    setLoading(true);
    const none = { items: [] };
    Promise.all([
      fetchAniList("anime", { search: query, perPage: 8 }).catch(() => none),
      fetchAniList("manga", { search: query, perPage: 8 }).catch(() => none),
    ]).then(([anime, manga]) => {
      if (id !== reqId.current) return; // a newer search already started
      setSections([
        { title: "Anime", data: anime.items.slice(0, 8) },
        { title: "Manga", data: manga.items.slice(0, 8) },
      ].filter((s) => s.data.length));
      setLoading(false);
    });
  }, [q]);

  return (
    <div className="stack narrow">
      <h1>Search</h1>
      <input id="search-page" className="input big" autoFocus value={text} onChange={(e) => setText(e.target.value)}
        placeholder="Search anime and manga…" aria-label="Search" />
      {q.trim().length < 2 ? (
        <p className="empty">Type at least 2 characters.</p>
      ) : loading && !sections.length ? (
        <p className="empty">Searching…</p>
      ) : !sections.length ? (
        <p className="empty">No matches for “{q}”.</p>
      ) : (
        sections.map((s) => (
          <section key={s.title} className="search-section">
            <h2>{s.title}</h2>
            <ul className="search-list">{s.data.map((it) => <SearchRow key={`${it.segment}-${it.id}`} item={it} />)}</ul>
          </section>
        ))
      )}
    </div>
  );
}

function SearchRow({ item }) {
  const creator = item.creator;
  return (
    <li>
      <Link to={titlePath(item)} onClick={() => cacheTitle(item)} className="search-row">
        {item.image ? <img src={item.image} alt="" loading="lazy" /> : <span className="thumb-empty" />}
        <span className="grow">
          <b className="ellipsis">{item.title}</b>
          {creator && <span className="creator ellipsis">{creator}</span>}
          <span className="faint small">{item.genre} · {releaseLabel(item)}</span>
        </span>
      </Link>
    </li>
  );
}
