// MORE — a menu, like the "More" tab in reader apps:
//   /more             menu + a one-line summary of your library
//   /more/statistics  in library, completed, rank (tier), per-status trackers
//   /more/settings    theme (System / Light / Dark, Pure black), clock, badges
//   /more/settings    24-hour clock, countdown badges on posters
//   /more/data        backup, restore, storage used, clear data
//   /more/help        common questions
//   /more/about       version, credits, data source
import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import {
  getUserTier, TIERS, statusesFor, exportData, importData, clearData, storageSize,
  importAniListEntries,
  getCategories, addCategory, renameCategory, moveCategory, deleteCategory,
  getExcited, toggleExcited,
  celebrate,
  getCategoryAccess, CATEGORY_MIN,
  exportLibraryCsv,
} from "@voidation/shared/backend/store";
import { useSettings } from "@voidation/shared/backend/SettingsContext";
import { durationLabel } from "@voidation/shared/format";
import { fetchAniListUserList, cacheSize, cacheClear } from "@voidation/shared/api/anilist";
import Icon from "../components/Icon.jsx";
import { useTheme } from "../theme.jsx";
import { useDocumentTitle } from "../lib/useDocumentTitle.js";
import logoDark from "../assets/logo.png";
import logoLight from "../assets/logo-light.png";
import AniListSync from "../components/AniListSync.jsx";
import { loadAnnounced, daysLeft, ANNOUNCED_DAYS } from "@voidation/shared/announced";
import { useAuth } from "@voidation/shared/backend/AuthContext";
import { releaseLabel } from "@voidation/shared/format";
import { titlePath, cacheTitle } from "../lib/titles.js";

const VERSION = "1.0.0";

const PAGES = [
  { key: "statistics", label: "Statistics", hint: "Overview, anime, chapters" },
  { key: "settings", label: "Appearance and Others", hint: "Theme, clock, countdown badges" },
  { key: "data", label: "Data and storage", hint: "Backup, restore, clear" },
  { key: "badge", label: "Your badge", hint: "Your rank and every badge" },
  { key: "announced", label: "New announcements", hint: "Anime announced this week" },
  { key: "categories", label: "Categories", hint: "Your own rows in Explore (500+ completed)" },
  { key: "anilist", label: "AniList", hint: "Sync or import your lists" },
  { key: "help", label: "Help", hint: "Common questions" },
  { key: "about", label: "About", hint: `Version ${VERSION}` },
];

function useStats() {
  const [data, setData] = useState(null);
  const refresh = () => getUserTier().then(setData).catch(() => {});
  useEffect(() => { refresh(); }, []);
  return [data, refresh];
}

export default function More() {
  const { page } = useParams();
  const current = PAGES.find((p) => p.key === page);
  useDocumentTitle(current ? current.label : "More");
  if (page === "appearance") return <Navigate to="/more/settings" replace />; // Appearance now lives in Settings
  if (page && !current) return <Navigate to="/more" replace />;
  if (!current) return <MoreMenu />;

  const Body = { statistics: Statistics, settings: Settings, data: DataStorage, categories: Categories, anilist: AniListPage, announced: Announced, badge: BadgePage, help: Help, about: About }[page];
  return (
    <div className="stack narrow">
      <Link to="/more" className="link-btn"><Icon name="back" size={16} /> More</Link>
      <h1>{current.label}</h1>
      <Body />
    </div>
  );
}

// Laid out like the "More" tab in reader apps: logo, quick toggles, then menu rows.
function MoreMenu() {
  const { settings, update } = useSettings();
  // Categories only appear once you've completed 500 anime
  const [catsOpen, setCatsOpen] = useState(false);
  useEffect(() => { getCategoryAccess().then((a) => setCatsOpen(a.unlocked)).catch(() => {}); }, []);
  const row = (key, icon, label) => (
    <li key={key}>
      <Link to={`/more/${key}`} className="menu-row">
        <Icon name={icon} size={22} className="menu-icon" />
        <b className="grow">{label}</b>
      </Link>
    </li>
  );
  return (
    <div className="more-page narrow">
      <div className="more-logo"><img src={useTheme().dark ? logoDark : logoLight} alt="Voidation" /></div>
      <ul className="menu-list">
        <li>
          <label className="menu-row">
            <Icon name="clock" size={22} className="menu-icon" />
            <span className="grow"><b>24-hour clock</b><span className="faint small">Airing times as 16:30</span></span>
            <input type="checkbox" role="switch" className="switch" checked={settings.clock24} onChange={(e) => update("clock24", e.target.checked)} />
          </label>
        </li>
        <li>
          <label className="menu-row">
            <Icon name="badge" size={22} className="menu-icon" />
            <span className="grow"><b>Countdown badges</b><span className="faint small">Next episode on posters</span></span>
            <input type="checkbox" role="switch" className="switch" checked={settings.posterBadges} onChange={(e) => update("posterBadges", e.target.checked)} />
          </label>
        </li>
      </ul>
      <YourBadgeRow />
      <ul className="menu-list">
        <li>
          <Link to="/wrapped" className="menu-row wrapped-row">
            <Icon name="stats" size={22} className="menu-icon" />
            <span className="grow"><b>Voidation Rewind</b><span className="faint small">All time, or year by year</span></span>
          </Link>
        </li>
      </ul>
      <ul className="menu-list">
        {row("announced", "schedule", "New announcements")}
      </ul>
      <ul className="menu-list">
        {row("statistics", "stats", "Statistics")}
        {row("data", "storage", "Data and storage")}
      </ul>
      <ul className="menu-list">
        {catsOpen && row("categories", "library", "Categories")}
        {row("anilist", "browse", "AniList")}
      </ul>
      <ul className="menu-list">
        {row("settings", "settings", "Appearance and Others")}
        {row("help", "help", "Help")}
        {row("about", "info", "About")}
      </ul>
    </div>
  );
}

// Statistics, laid out like Mihon's: Overview, Anime, Chapters, then trackers.
function Statistics() {
  const [data] = useStats();
  if (!data) return <p className="muted">Loading…</p>;
  const { stats } = data;
  const fmt = (n) => (n || 0).toLocaleString();
  const block = (title, cells) => (
    <section className="stat-block">
      <h2 className="stat-title">{title}</h2>
      <div className="stat-cells">
        {cells.map(([n, label]) => <div key={label} className="stat-cell"><b>{n}</b><span>{label}</span></div>)}
      </div>
    </section>
  );
  return (
    <div className="stack-sm">
      {block("Overview", [[fmt(stats.tracking), "In library"], [fmt(stats.totalCompleted), "Completed & finished"], [durationLabel(stats.minutesWatched), "Time watched"]])}
      {block("Anime", [[fmt(stats.episodesTotal), "Total"], [fmt(stats.episodesWatched), "Watched"], [fmt(stats.inLibrary.anime), "Entries"]])}
      {block("Chapters", [[fmt(stats.chaptersTotal), "Total"], [fmt(stats.chaptersRead), "Read"], [fmt(stats.inLibrary.manga), "Entries"]])}
      <section className="stat-block">
        <h2 className="stat-title">Trackers</h2>
        <div className="two-col">
          {["anime", "manga"].map((seg) => (
            <div key={seg}>
              <b className="small">{seg === "anime" ? "Anime" : "Manga"}</b>
              <ul className="tracker-list">
                {statusesFor(seg).map((st) => (
                  <li key={st.key}><span>{st.label}</span><b>{stats.byStatus[seg][st.key] || 0}</b></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
      <p className="faint small">Totals count every episode/chapter of the titles in your library; a title with no known length counts what you've marked. Time watched uses each show's episode length.</p>
    </div>
  );
}

// Theme, like Mihon: System / Light / Dark, plus Pure black for dark.
function ThemeSettings() {
  const { pref, setPref, pureBlack, setPureBlack, dark } = useTheme();
  return (
    <section className="panel stack-sm">
      <b>Theme</b>
      <div className="seg-tabs theme-seg" role="radiogroup" aria-label="Theme">
        {[["system", "System"], ["light", "Light"], ["dark", "Dark"]].map(([k, label]) => (
          <button key={k} role="radio" aria-checked={pref === k} className={`seg-tab${pref === k ? " on" : ""}`} onClick={() => setPref(k)}>
            {pref === k ? "✓ " : ""}{label}
          </button>
        ))}
      </div>
      <Toggle label="Pure black dark mode" hint={dark ? "A fully black background (saves battery on OLED screens)" : "Used when the theme is dark"}
        checked={pureBlack} onChange={setPureBlack} />
    </section>
  );
}

function Toggle({ label, hint, checked, onChange }) {
  return (
    <label className="toggle-row">
      <span className="grow"><b>{label}</b><span className="faint small">{hint}</span></span>
      <input type="checkbox" role="switch" className="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

function Settings() {
  const { settings, update } = useSettings();
  return (
    <>
    <ThemeSettings />
    <section className="panel stack-sm">
      <Toggle label="24-hour clock" hint="Airing times as 16:30 instead of 4:30 PM"
        checked={settings.clock24} onChange={(v) => update("clock24", v)} />
      <Toggle label="Countdown badges on posters" hint={'Shows "Ep 7 · 3h 30m" on airing anime'}
        checked={settings.posterBadges} onChange={(v) => update("posterBadges", v)} />
    </section>
    </>
  );
}

// Data and storage, laid out like Mihon's: Create / Restore backup, storage
// usage, offline copy, export. (Automatic backups to a folder are in the app.)
function DataStorage() {
  const { reload } = useSettings();
  const [size, setSize] = useState(null);
  const [offlineSize, setOfflineSize] = useState(null);
  const [message, setMessage] = useState("");
  const fileInput = useRef(null);
  const measure = () => { storageSize().then(setSize); cacheSize().then(setOfflineSize); };
  useEffect(() => { measure(); }, []);
  const kb = (n) => (n === null ? "…" : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(2)} MB`);

  const save = (name, text, type) => {
    const blob = new Blob([text], { type });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const today = () => new Date().toISOString().slice(0, 10);
  const download = async () => { save(`voidation-backup-${today()}.json`, await exportData(), "application/json"); setMessage("Backup downloaded."); };
  const exportList = async () => { save(`voidation-library-${today()}.csv`, await exportLibraryCsv(), "text/csv"); setMessage("Library list downloaded."); };
  const restore = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !window.confirm("Replace your whole library with this backup?")) return;
    const err = await importData(await file.text());
    setMessage(err || "Library restored from backup.");
    if (!err) { reload(); measure(); }
  };
  const clear = async () => {
    if (!window.confirm("Delete your whole library, verdicts and Excited list? This can't be undone.")) return;
    await clearData();
    setMessage("Library cleared. Your settings were kept.");
    measure();
  };
  const share = offlineSize ? Math.min(100, (offlineSize / 1_500_000) * 100) : 0;

  return (
    <div className="ds">
      <h2 className="ds-section">Backup and restore</h2>
      <div className="ds-seg">
        <button onClick={download}>Create backup</button>
        <button onClick={() => fileInput.current?.click()}>Restore backup</button>
        <input ref={fileInput} type="file" accept="application/json,.json" onChange={restore} hidden />
      </div>
      <div className="ds-row static">
        <b>Automatic backup frequency</b>
        <span>In the Android app (to a folder on your phone)</span>
      </div>
      <p className="ds-info"><span aria-hidden="true">ⓘ</span>You should keep copies of backups in other places as well. Backups hold your whole library, verdicts and watch log. On the website everything lives in this browser, so clearing site data erases it.</p>

      <h2 className="ds-section">Storage usage</h2>
      <div className="ds-row static">
        <b>In this browser</b>
        <div className="ds-bar" aria-hidden="true"><span style={{ width: `${Math.max(2, share)}%` }} /></div>
        <span>Library: {kb(size)} · Offline copy: {kb(offlineSize)} of 1.5 MB</span>
      </div>
      <button className="ds-row" onClick={async () => { await cacheClear(); setMessage("Offline copy cleared."); measure(); }}>
        <b>Clear offline copy</b><span>Used: {kb(offlineSize)}. Your library isn't touched.</span>
      </button>

      <h2 className="ds-section">Export</h2>
      <button className="ds-row" onClick={exportList}>
        <b>Library list</b><span>Every title as a spreadsheet (CSV): status, progress, verdict, categories</span>
      </button>

      <h2 className="ds-section">Danger zone</h2>
      <button className="ds-row danger" onClick={clear}>
        <b>Clear library</b><span>Removes every tracked title, verdict and Excited mark from this browser</span>
      </button>
      {message && <p className="faint small" role="status">{message}</p>}
    </div>
  );
}

// Bring your AniList anime and manga lists over, by username. Nothing is
// written to AniList, and no password or key is needed (lists must be public).
function AniListImport({ onDone }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");
  const go = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setResult("");
    try {
      const entries = await fetchAniListUserList(name);
      const r = await importAniListEntries(entries);
      setResult(`Imported from AniList: ${r.added} added, ${r.updated} updated${r.kept ? `, ${r.kept} kept as they were (changed more recently here)` : ""}.`);
      onDone();
    } catch (err) {
      setResult(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="panel stack-sm">
      <b>Import from AniList</b>
      <p className="faint small">
        Adds your AniList anime and manga with their status and progress. A title that's already here keeps whichever
        copy was changed last. Nothing is changed on AniList, and your lists need to be public.
      </p>
      <form className="row gap-8 wrap" onSubmit={go}>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="AniList username"
          aria-label="AniList username" autoComplete="off" style={{ flex: "1 1 180px" }} />
        <button className="btn primary" disabled={busy || !name.trim()}>{busy ? "Importing…" : "Import"}</button>
      </form>
      {result && <p className="faint small" role="status">{result}</p>}
    </section>
  );
}

// More menu: your current badge at a glance.
function YourBadgeRow() {
  const [data] = useStats();
  if (!data) return null;
  const { tier, stats } = data;
  const next = TIERS.find((t) => t.min > stats.totalCompleted);
  return (
    <Link to="/more/badge" className="badge-row" style={{ "--tier": tier.color }}>
      <span className="mini-medal"><Icon name={tier.key === "addicted" ? "coffee" : "star"} size={16} fill={tier.key !== "addicted"} /></span>
      <span className="grow">
        <small className="faint">Your badge</small>
        <b style={{ color: tier.color }}>{tier.label}</b>
        <span className="faint small">
          {next ? `${next.min - stats.totalCompleted} more to ${next.label}` : "Top rank. Take a break!"} · {stats.anime} completed, {stats.manga} finished
        </span>
      </span>
      <span className="faint">›</span>
    </Link>
  );
}

// Your rank, progress to the next, and every badge (locked ones greyed out).
function BadgePage() {
  const [data] = useStats();
  if (!data) return <p className="muted">Loading…</p>;
  const { tier, stats } = data;
  const n = stats.totalCompleted;
  const next = TIERS.find((t) => t.min > n);
  const pct = next ? Math.round(((n - tier.min) / (next.min - tier.min)) * 100) : 100;
  return (
    <div className="stack-sm">
      <section className="panel badge-hero" style={{ "--tier": tier.color }}>
        <div className="medal static" aria-hidden="true">
          <div className="medal-ring" />
          <div className="medal-face">
            <span className="medal-star"><Icon name={tier.key === "addicted" ? "coffee" : "star"} size={40} fill={tier.key !== "addicted"} /></span>
            <b>{tier.label}</b>
            <small>{tier.min}+ titles</small>
          </div>
        </div>
        <h2>{tier.title}</h2>
        <p className="muted">{stats.anime} anime completed · {stats.manga} manga finished</p>
        {next ? (
          <>
            <div className="progress-bar wide" aria-hidden="true"><span style={{ width: `${pct}%`, background: tier.color }} /></div>
            <p className="faint small">{next.min - n} more to <b style={{ color: next.color }}>{next.label}</b> ({n} of {next.min})</p>
          </>
        ) : <p className="faint small">You've reached the top rank. Maybe take a break.</p>}
      </section>
      <ul className="badge-list">
        {TIERS.map((t) => {
          const earned = n >= t.min;
          return (
            <li key={t.key} className={earned ? "earned" : "locked"} style={{ "--tier": t.color }}>
              <button disabled={!earned} onClick={() => celebrate(t)} title={earned ? "Replay the celebration" : undefined}>
                <span className="mini-medal"><Icon name={earned ? (t.key === "addicted" ? "coffee" : "star") : "lock"} size={16} fill={earned && t.key !== "addicted"} /></span>
                <span className="grow">
                  <b>{t.label}</b>
                  <span className="faint small">{t.min === 0 ? "Where everyone starts" : `${t.min} anime completed + manga finished`}</span>
                </span>
                <span className="faint small">{earned ? "Earned" : `${t.min - n} to go`}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// Anime announced on AniList this week. Each stays 7 days, then drops off.
function Announced() {
  const { user } = useAuth();
  const [list, setList] = useState(null);
  const [excited, setExcited] = useState({});
  useEffect(() => {
    loadAnnounced().then(setList).catch(() => setList([]));
    getExcited().then(setExcited);
  }, []);
  if (!list) return <p className="muted">Loading…</p>;
  if (!list.length) return <p className="empty">No new announcements in the last {ANNOUNCED_DAYS} days.</p>;
  return (
    <div className="stack-sm">
      <p className="muted">Anime newly announced on AniList. Each one stays here for {ANNOUNCED_DAYS} days. Tap Excited to get it on your Schedule.</p>
      <ul className="list">
        {list.map(({ item, seenAt }) => {
          const on = !!excited[`anime:${item.id}`];
          return (
            <li key={item.id} className="list-row">
              <Link to={titlePath(item)} onClick={() => cacheTitle(item)} className="row gap-12 grow">
                {item.image ? <img src={item.image} alt="" loading="lazy" /> : <span className="thumb-empty" />}
                <span className="grow">
                  <b className="ellipsis">{item.title}</b>
                  <span className="faint small">
                    {item.date ? releaseLabel(item) : "Release date TBA"}{item.creator ? ` · ${item.creator}` : ""} · {daysLeft(seenAt)} day{daysLeft(seenAt) === 1 ? "" : "s"} left here
                  </span>
                </span>
              </Link>
              <button className={`status-btn excited${on ? " on" : ""}`} aria-pressed={on}
                onClick={async () => { await toggleExcited(user, item); setExcited(await getExcited()); }}>
                {on ? "Excited ✓" : "Excited?"}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// Your own Library groups ("Favourites", "Rewatch", "With friends"…), like
// Mihon's categories. Titles can be in several; deleting one keeps the titles.
function Categories() {
  const [cats, setCats] = useState(null);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState(null); // { id, name }
  const [message, setMessage] = useState("");
  const [access, setAccess] = useState(null);
  const refresh = () => { getCategories().then(setCats); getCategoryAccess().then(setAccess); };
  useEffect(() => { refresh(); }, []);

  const add = async (e) => {
    e.preventDefault();
    const cat = await addCategory(name);
    setMessage(cat ? "" : name.trim() ? "You already have a category with that name." : "");
    if (cat) setName("");
    refresh();
  };
  const remove = async (c) => {
    if (!window.confirm(`Delete "${c.name}"? Its Explore row goes; the titles stay in your library.`)) return;
    await deleteCategory(c.id);
    refresh();
  };
  if (!cats || !access) return <p className="muted">Loading…</p>;
  if (!access.unlocked) {
    return (
      <section className="panel stack-sm spotlight-panel locked">
        <b>Unlocks at {CATEGORY_MIN} completed anime</b>
        <p className="faint small">Then you can make your own categories, and each one becomes a row at the top of Explore during the third week of every month. {access.needed} to go ({access.animeCompleted} completed).</p>
      </section>
    );
  }
  return (
    <div className="stack-sm">
      <p className="muted">
        Each category is your own row at the top of Explore during the third week of every month (days 15–21).
        Add titles to it from a title's page, or with Select in the Library.
      </p>
      <form className="row gap-8" onSubmit={add}>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="New category, e.g. Hidden gems" maxLength={40} aria-label="New category name" />
        <button className="btn primary" disabled={!name.trim()}>Add</button>
      </form>
      {message && <p className="field-error">{message}</p>}
      {cats.length === 0 ? <p className="empty">No categories yet.</p> : (
        <ul className="menu-list">
          {cats.map((c, i) => (
            <li key={c.id} className="menu-row cat-row">
              {editing?.id === c.id ? (
                <form className="row gap-8 grow" onSubmit={async (e) => { e.preventDefault(); await renameCategory(c.id, editing.name); setEditing(null); refresh(); }}>
                  <input className="input" autoFocus value={editing.name} maxLength={40} onChange={(e) => setEditing({ ...editing, name: e.target.value })} aria-label="Category name" />
                  <button className="btn primary">Save</button>
                  <button type="button" className="btn ghost" onClick={() => setEditing(null)}>Cancel</button>
                </form>
              ) : (
                <>
                  <b className="grow">{c.name}</b>
                  <button className="icon-btn" aria-label={`Move ${c.name} up`} disabled={i === 0} onClick={async () => { await moveCategory(c.id, -1); refresh(); }}>↑</button>
                  <button className="icon-btn" aria-label={`Move ${c.name} down`} disabled={i === cats.length - 1} onClick={async () => { await moveCategory(c.id, 1); refresh(); }}>↓</button>
                  <button className="link-btn" onClick={() => setEditing({ id: c.id, name: c.name })}>Rename</button>
                  <button className="link-btn danger-text" onClick={() => remove(c)}>Delete</button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// AniList: two-way sync (sign in) or a one-time import by username.
function AniListPage() {
  const { reload } = useSettings();
  return (
    <div className="stack-sm">
      <AniListSync onChange={reload} />
      <AniListImport onDone={reload} />
    </div>
  );
}

const FAQ = [
  ["Where is my library saved?", "In this browser (or on your phone in the app). There is no account and nothing is uploaded. Use Data and storage to back it up."],
  ["How do I move to a new phone or browser?", "Download a backup under Data and storage, then use Restore from backup on the new device."],
  ["Can I bring my AniList lists?", "Yes, two ways under More → AniList: sign in to keep them in sync both ways, or import once by username (public lists; nothing is changed on AniList)."],
  ["What does Delayed mean?", "The next episode was going to air earlier, and its date has since moved later. Voidation shows the original date next to the new one."],
  ["Why doesn't a show have a countdown?", "It has finished airing, or AniList doesn't know the next episode's date yet. Countdowns appear as soon as a date is announced."],
  ["What time zone are the airing times in?", "Yours. Voidation converts every broadcast time to your device's time zone."],
  ["What shows up in History?", "Episodes from the last 14 days for anime you mark Watching, Plan to Watch, On Hold, or Excited."],
  ["Why no movies or web series?", "Voidation focuses on anime and manga, which AniList provides for free. A wider pop-culture guide is planned."],
];

function Help() {
  return (
    <div className="stack-sm">
      {FAQ.map(([q, a]) => (
        <details key={q} className="panel faq">
          <summary><b>{q}</b></summary>
          <p className="muted">{a}</p>
        </details>
      ))}
    </div>
  );
}

function About() {
  return (
    <section className="panel stack-sm">
      <p><b>Voidation</b> <span className="faint">version {VERSION}</span></p>
      <p className="muted">An anime and manga tracker with live countdowns to the next episode. Website and Android app, one codebase, no sign-up.</p>
      <p className="muted">Made by <a href="https://abhinavbaral.com.np" target="_blank" rel="noreferrer">Abhinav Baral</a> in Jhapa, Nepal.</p>
      <p className="faint small">
        Anime and manga data from <a href="https://anilist.co" target="_blank" rel="noreferrer">AniList</a>. Voidation is not
        affiliated with AniList.
      </p>
    </section>
  );
}
