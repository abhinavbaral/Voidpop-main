// Site navigation.
//  Desktop (≥900px): top bar — logo, the six sections, search box, theme.
//  Phone browsers:   compact top bar + a bottom tab bar, like the mobile app.
import { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import Brand from "./Brand.jsx";
import Icon from "./Icon.jsx";
import { useTheme } from "../theme.jsx";
import { getPending, onDataChange } from "@voidation/shared/backend/store";

// Pending episodes (aired, not watched) for the Schedule badge. Rechecked when
// your library changes and once a minute, so Sunday's episodes appear by themselves.
function usePendingCount() {
  const [n, setN] = useState(0);
  useEffect(() => {
    const check = () => getPending().then((p) => setN(p.total)).catch(() => {});
    check();
    const stop = onDataChange(check);
    const timer = setInterval(check, 60000);
    return () => { stop(); clearInterval(timer); };
  }, []);
  return n;
}

const Badge = ({ n }) => (n > 0 ? <span className="nav-badge" aria-label={`${n} pending`}>{n > 99 ? "99+" : n}</span> : null);

const SECTIONS = [
  { to: "/", label: "Explore", icon: "explore", end: true },
  { to: "/library", label: "Library", icon: "library" },
  { to: "/history", label: "History", icon: "history" },
  { to: "/schedule", label: "Schedule", icon: "schedule" },
  { to: "/more", label: "More", icon: "more" },
];

function ThemeToggle() {
  const { dark, setPref } = useTheme();
  return (
    <button className="icon-btn" onClick={() => setPref(dark ? "light" : "dark")}
      aria-label={`Switch to ${dark ? "light" : "dark"} theme`} title={dark ? "Light theme" : "Dark theme"}>
      <Icon name={dark ? "sun" : "moon"} />
    </button>
  );
}

export function TopNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const [q, setQ] = useState("");

  // keep the box in sync when arriving on /search?q=…
  useEffect(() => {
    if (location.pathname === "/search") setQ(new URLSearchParams(location.search).get("q") || "");
  }, [location]);

  const submit = (e) => {
    e.preventDefault();
    navigate(q.trim() ? `/search?q=${encodeURIComponent(q.trim())}` : "/search");
  };

  const pending = usePendingCount();
  return (
    <header className="topnav">
      <div className="topnav-inner">
        <Link to="/" aria-label="Voidation home"><Brand /></Link>

        <nav className="topnav-links" aria-label="Sections">
          {SECTIONS.map((s) => (
            <NavLink key={s.to} to={s.to} end={s.end} className="topnav-link">
              {s.label}{s.to === "/schedule" && <Badge n={pending} />}
            </NavLink>
          ))}
        </nav>

        <div className="topnav-right">
          <form className="topnav-search" onSubmit={submit} role="search">
            <Icon name="search" size={16} />
            <input id="nav-search" value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Search anime and manga…" aria-label="Search" />
          </form>
          <Link to="/search" className="icon-btn mobile-only" aria-label="Search"><Icon name="search" /></Link>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

export function BottomTabs() {
  const pending = usePendingCount();
  return (
    <nav className="bottom-tabs" aria-label="Sections">
      {SECTIONS.map((s) => (
        <NavLink key={s.to} to={s.to} end={s.end} className="bottom-tab">
          <span className="tab-icon"><Icon name={s.icon} size={20} />{s.to === "/schedule" && <Badge n={pending} />}</span>
          <span>{s.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
