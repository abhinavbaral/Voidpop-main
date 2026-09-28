// Site navigation.
//  Desktop (≥900px): top bar — logo, the six sections, search box, theme.
//  Phone browsers:   compact top bar + a bottom tab bar, like the mobile app.
import { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import Brand from "./Brand.jsx";
import Icon from "./Icon.jsx";
import { useTheme } from "../theme.jsx";

const SECTIONS = [
  { to: "/", label: "Explore", icon: "explore", end: true },
  { to: "/library", label: "Library", icon: "library" },
  { to: "/browse", label: "Browse", icon: "browse" },
  { to: "/history", label: "History", icon: "history" },
  { to: "/schedule", label: "Schedule", icon: "schedule" },
  { to: "/more", label: "More", icon: "more" },
];

function ThemeToggle() {
  const { mode, setMode } = useTheme();
  const next = mode === "void" ? "pop" : "void";
  return (
    <button className="icon-btn" onClick={() => setMode(next)}
      aria-label={`Switch to ${next === "pop" ? "Pop (light)" : "Void (dark)"} theme`}
      title={next === "pop" ? "Pop theme" : "Void theme"}>
      <Icon name={mode === "void" ? "sun" : "moon"} />
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

  return (
    <header className="topnav">
      <div className="topnav-inner">
        <Link to="/" aria-label="Voidation home"><Brand /></Link>

        <nav className="topnav-links" aria-label="Sections">
          {SECTIONS.map((s) => (
            <NavLink key={s.to} to={s.to} end={s.end} className="topnav-link">{s.label}</NavLink>
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
  return (
    <nav className="bottom-tabs" aria-label="Sections">
      {SECTIONS.map((s) => (
        <NavLink key={s.to} to={s.to} end={s.end} className="bottom-tab">
          <Icon name={s.icon} size={20} />
          <span>{s.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
