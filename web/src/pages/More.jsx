// MORE — a menu, like the "More" tab in reader apps:
//   /more             menu + a one-line summary of your library
//   /more/statistics  in library, completed, rank (tier), per-status trackers
//   /more/appearance  Void (dark) / Light
//   /more/settings    24-hour clock, countdown badges on posters
//   /more/data        backup, restore, storage used, clear data
//   /more/help        common questions
//   /more/about       version, credits, data source
import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import {
  getUserTier, TIERS, statusesFor, exportData, importData, clearData, storageSize,
  importAniListEntries,
} from "@voidation/shared/backend/store";
import { useSettings } from "@voidation/shared/backend/SettingsContext";
import { fetchAniListUserList, cacheSize, cacheClear } from "@voidation/shared/api/anilist";
import TierBadge from "../components/TierBadge.jsx";
import Icon from "../components/Icon.jsx";
import { useTheme } from "../theme.jsx";
import { useDocumentTitle } from "../lib/useDocumentTitle.js";
import logo from "../assets/logo.png";

const VERSION = "1.0.0";

const PAGES = [
  { key: "statistics", label: "Statistics", hint: "Library, completed, rank" },
  { key: "appearance", label: "Appearance", hint: "Dark or light" },
  { key: "settings", label: "Settings", hint: "Clock, countdown badges" },
  { key: "data", label: "Data and storage", hint: "Backup, restore, clear" },
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
  if (page && !current) return <Navigate to="/more" replace />;
  if (!current) return <MoreMenu />;

  const Body = { statistics: Statistics, appearance: Appearance, settings: Settings, data: DataStorage, help: Help, about: About }[page];
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
      <div className="more-logo"><img src={logo} alt="Voidation" /></div>
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
      <ul className="menu-list">
        {row("statistics", "stats", "Statistics")}
        {row("appearance", "palette", "Appearance")}
        {row("data", "storage", "Data and storage")}
      </ul>
      <ul className="menu-list">
        {row("settings", "settings", "Settings")}
        {row("help", "help", "Help")}
        {row("about", "info", "About")}
      </ul>
    </div>
  );
}

function Statistics() {
  const [data] = useStats();
  if (!data) return <p className="muted">Loading…</p>;
  const { tier, stats } = data;
  const next = TIERS.find((t) => t.min > stats.totalCompleted);
  return (
    <>
      <div className="stats">
        {[["In library", stats.tracking], ["Completed", stats.totalCompleted], ["Episodes watched", stats.episodesWatched],
          ["Chapters read", stats.chaptersRead], ["Verdicts", stats.verdicts], ["Excited", stats.excited]].map(([l, n]) => (
          <div key={l} className="stat"><b>{n}</b><span>{l}</span></div>
        ))}
      </div>
      <section className="panel stack-sm">
        <h2 className="row gap-8">Rank <TierBadge tier={tier} large /></h2>
        <p className="muted">
          {next ? <>{next.min - stats.totalCompleted} more completed to reach <b style={{ color: next.color }}>{next.label}</b>.</> : "Top rank reached."}
        </p>
        <div className="tier-ladder">
          {TIERS.map((t) => (
            <span key={t.key} className={`tier-step${t.key === tier.key ? " on" : ""}`} style={{ borderColor: t.color, color: t.color }}>
              {t.label} <small>{t.min}+</small>
            </span>
          ))}
        </div>
      </section>
      <div className="two-col">
        {["anime", "manga"].map((seg) => (
          <section key={seg} className="panel">
            <h2>{seg === "anime" ? "Anime" : "Manga"} trackers <span className="faint small">{stats.inLibrary[seg]} total</span></h2>
            <ul className="tracker-list">
              {statusesFor(seg).map((s) => (
                <li key={s.key}><span>{s.label}</span><b>{stats.byStatus[seg][s.key] || 0}</b></li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}

function Appearance() {
  const { mode, setMode } = useTheme();
  return (
    <div className="theme-switch" role="radiogroup" aria-label="Appearance">
      {[["void", "Void", "Dark"], ["pop", "Light", "Light"]].map(([k, label, hint]) => (
        <button key={k} role="radio" aria-checked={mode === k} className={`list-btn${mode === k ? " on" : ""}`} onClick={() => setMode(k)}>
          <b>{label}</b><span className="small">{hint}</span>
        </button>
      ))}
    </div>
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
    <section className="panel stack-sm">
      <Toggle label="24-hour clock" hint="Airing times as 16:30 instead of 4:30 PM"
        checked={settings.clock24} onChange={(v) => update("clock24", v)} />
      <Toggle label="Countdown badges on posters" hint={'Shows "Ep 7 · 3h 30m" on airing anime'}
        checked={settings.posterBadges} onChange={(v) => update("posterBadges", v)} />
    </section>
  );
}

function DataStorage() {
  const { reload } = useSettings();
  const [size, setSize] = useState(null);
  const [offlineSize, setOfflineSize] = useState(null);
  const [message, setMessage] = useState("");
  const fileInput = useRef(null);
  const measure = () => { storageSize().then(setSize); cacheSize().then(setOfflineSize); };
  useEffect(() => { measure(); }, []);

  const download = async () => {
    const blob = new Blob([await exportData()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `voidation-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setMessage("Backup downloaded.");
  };
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

  return (
    <>
      <p className="muted">
        No account, no sign-in: everything is saved in this browser only. Clearing site data erases it, so download a
        backup now and then. Using {size === null ? "…" : `${(size / 1024).toFixed(1)} KB`}.
      </p>
      <section className="panel stack-sm">
        <div className="row gap-8 wrap">
          <button className="btn primary" onClick={download}>Download backup</button>
          <button className="btn ghost" onClick={() => fileInput.current?.click()}>Restore from backup</button>
          <input ref={fileInput} type="file" accept="application/json,.json" onChange={restore} hidden />
        </div>
      </section>
      <AniListImport onDone={() => { reload(); measure(); }} />
      <section className="panel stack-sm">
        <b>Offline copy</b>
        <p className="faint small">
          The latest schedules and titles are saved as you browse, so Voidation still works without internet.
          Using {offlineSize === null ? "…" : `${(offlineSize / 1024).toFixed(0)} KB`}. Clearing it doesn't touch your library.
        </p>
        <button className="btn ghost" onClick={async () => { await cacheClear(); setMessage("Offline copy cleared."); measure(); }}>
          Clear offline copy
        </button>
      </section>
      <section className="panel stack-sm">
        <b>Clear data</b>
        <p className="faint small">Removes every tracked title, verdict and Excited mark from this browser.</p>
        <button className="btn danger" onClick={clear}>Clear library</button>
      </section>
      {message && <p className="faint small" role="status">{message}</p>}
    </>
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

const FAQ = [
  ["Where is my library saved?", "In this browser (or on your phone in the app). There is no account and nothing is uploaded. Use Data and storage to back it up."],
  ["How do I move to a new phone or browser?", "Download a backup under Data and storage, then use Restore from backup on the new device."],
  ["Can I bring my AniList lists?", "Yes. Data and storage → Import from AniList, then type your username. Your lists need to be public; nothing is changed on AniList."],
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
