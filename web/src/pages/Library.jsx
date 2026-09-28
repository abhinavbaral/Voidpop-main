// LIBRARY — Anime | Manga, switched like Browse, each with its own statuses:
//   Anime: Watching / Completed / Plan to Watch / On Hold / Dropped
//   Manga: Reading / Finished / Plan to Read / On Hold / Dropped
// Search, sort, your progress on every card, and +1 on what you're watching.
// Same lists as the app (shared/backend/store). Saved on this device.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@voidation/shared/backend/AuthContext";
import {
  getLibrary, statusesFor, LIBRARY_LISTS, inLibraryList, setProgress, noteAiring, addReview, setStatus, LIBRARY_SORTS, sortEntries,
  getCategories, bulkSetStatus, bulkCategory, bulkRemove,
} from "@voidation/shared/backend/store";
import { fetchNextEpisodes } from "@voidation/shared/api/anilist";
import { useNow } from "@voidation/shared/hooks/useNow";
import Card from "../components/Card.jsx";
import VerdictModal from "../components/VerdictModal.jsx";
import { useDocumentTitle } from "../lib/useDocumentTitle.js";

export default function Library() {
  useDocumentTitle("Library");
  const { user } = useAuth();
  const now = useNow(30000);
  const [entries, setEntries] = useState(null);
  const [list, setList] = useState("watch");
  const [tab, setTab] = useState("watching");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("updated");
  const [finishing, setFinishing] = useState(null); // item whose last episode you just marked
  const [cats, setCats] = useState([]);
  const [cat, setCat] = useState(""); // "" = every category
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState(new Set());

  const reload = useCallback(async () => {
    setEntries(Object.values(await getLibrary(user).catch(() => ({}))));
    setCats(await getCategories());
  }, [user]);

  useEffect(() => {
    let alive = true;
    (async () => {
      await reload();
      // saved items are snapshots: refresh "next episode" for anime still airing (also spots delays)
      const lib = Object.values(await getLibrary(user));
      const airing = lib.filter((e) => e.item.segment === "anime" && !e.item.finished && e.status !== "completed");
      const fresh = await fetchNextEpisodes(airing.map((e) => e.item.id)).catch(() => ({}));
      if (alive && (await noteAiring(fresh))) reload();
    })();
    return () => { alive = false; };
  }, [user, reload]);

  const current = LIBRARY_LISTS.find((l) => l.key === list);
  const statuses = statusesFor(current.segment);
  const q = query.trim().toLowerCase();
  // search narrows every status, so the chip counts show where the matches are
  const listEntries = useMemo(
    () => (entries || []).filter((e) => inLibraryList(e, list)
      && (!q || e.item.title.toLowerCase().includes(q))
      && (!cat || (e.cats || []).includes(cat))),
    [entries, list, q, cat]
  );
  const shown = sortEntries(listEntries.filter((e) => e.status === tab), sort);
  const count = (key) => (entries || []).filter((e) => inLibraryList(e, key)).length;
  const sorts = LIBRARY_SORTS.filter((s) => !s.anime || current.segment === "anime");

  const keyOf = (e) => `${e.item.segment}:${e.item.id}`;
  const toggle = (e) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(keyOf(e))) next.delete(keyOf(e)); else next.add(keyOf(e));
    return next;
  });
  const stopSelecting = () => { setSelecting(false); setSelected(new Set()); };
  const bulk = async (fn) => { await fn([...selected]); stopSelecting(); reload(); };

  const plus = async (e) => {
    const r = await setProgress(user, e.item, (e.progress || 0) + 1);
    if (r.reachedEnd) setFinishing(e.item);
    reload();
  };
  const finish = async ({ verdict, vibes, comment }) => {
    await setStatus(user, finishing.segment, finishing, "completed");
    await addReview(user, finishing.segment, finishing.id, { verdict, vibes, comment });
    setFinishing(null);
    reload();
  };

  return (
    <div className="stack">
      <div className="browse-head">
        <h1>Library</h1>
        <div className="seg-tabs" role="tablist" aria-label="Type">
          {LIBRARY_LISTS.map((l) => (
            <button key={l.key} role="tab" aria-selected={l.key === list} className={`seg-tab${l.key === list ? " on" : ""}`}
              onClick={() => { setList(l.key); stopSelecting(); if (sort === "airing" || sort === "behind") setSort("updated"); }}>
              {l.segment === "anime" ? "Anime" : "Manga"} {entries && <span className="count">{count(l.key)}</span>}
            </button>
          ))}
        </div>
      </div>
      <div className="library-tools">
        <input className="input" type="search" value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search your ${current.segment}`} aria-label="Search your library" />
        <select className="input" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
          {sorts.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <button className={`btn ${selecting ? "primary" : "ghost"}`} onClick={() => (selecting ? stopSelecting() : setSelecting(true))}>
          {selecting ? "Done" : "Select"}
        </button>
      </div>
      {cats.length > 0 && (
        <div className="chips" role="tablist" aria-label="Category">
          <button role="tab" aria-selected={!cat} className={`chip${!cat ? " on" : ""}`} onClick={() => setCat("")}>All categories</button>
          {cats.map((c) => (
            <button key={c.id} role="tab" aria-selected={cat === c.id} className={`chip${cat === c.id ? " on" : ""}`} onClick={() => setCat(c.id)}>
              {c.name} <span className="count">{(entries || []).filter((e) => inLibraryList(e, list) && (e.cats || []).includes(c.id)).length}</span>
            </button>
          ))}
        </div>
      )}
      <div className="chips" role="tablist" aria-label="Status">
        {statuses.map((s) => (
          <button key={s.key} role="tab" aria-selected={tab === s.key} className={`chip${tab === s.key ? " on" : ""}`} onClick={() => setTab(s.key)}>
            {s.label} {entries && <span className="count">{listEntries.filter((e) => e.status === s.key).length}</span>}
          </button>
        ))}
      </div>
      {entries === null ? <p className="muted">Loading…</p> : shown.length ? (
        <div className="grid">
          {shown.map((e) => (
            <Card key={`${e.item.segment}-${e.item.id}`} item={e.item} now={now} entry={e}
              onPlus={e.status === "watching" ? () => plus(e) : undefined}
              selecting={selecting} selected={selected.has(keyOf(e))} onToggle={() => toggle(e)} />
          ))}
        </div>
      ) : (
        <p className="empty">
          {q ? `No ${statuses.find((s) => s.key === tab)?.label} titles match "${query.trim()}".` : `Nothing in ${statuses.find((s) => s.key === tab)?.label} yet.`}
        </p>
      )}
      {selecting && (
        <div className="bulk-bar" role="toolbar" aria-label="Selected titles">
          <b>{selected.size} selected</b>
          <button className="link-btn" onClick={() => setSelected(new Set(shown.map(keyOf)))}>Select all</button>
          <select className="mini" value="" disabled={!selected.size} aria-label="Change status"
            onChange={(ev) => ev.target.value && bulk((keys) => bulkSetStatus(keys, ev.target.value))}>
            <option value="">Move to…</option>
            {statuses.map((st) => <option key={st.key} value={st.key}>{st.label}</option>)}
          </select>
          {cats.length > 0 && (
            <select className="mini" value="" disabled={!selected.size} aria-label="Add to category"
              onChange={(ev) => ev.target.value && bulk((keys) => bulkCategory(keys, ev.target.value, true))}>
              <option value="">Add to category…</option>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          {cat && (
            <button className="link-btn" disabled={!selected.size} onClick={() => bulk((keys) => bulkCategory(keys, cat, false))}>
              Remove from {cats.find((c) => c.id === cat)?.name}
            </button>
          )}
          <button className="link-btn danger-text" disabled={!selected.size}
            onClick={() => window.confirm(`Remove ${selected.size} title${selected.size === 1 ? "" : "s"} from your library? Progress and categories for them are lost.`) && bulk(bulkRemove)}>
            Remove from library
          </button>
        </div>
      )}
      {finishing && (
        <VerdictModal open initial={null} onSave={finish} onClose={() => { setFinishing(null); reload(); }} />
      )}
    </div>
  );
}
