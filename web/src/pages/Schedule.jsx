// SCHEDULE — the heart of Voidation: when does the next episode drop?
//   Your watch:    countdowns for the anime you follow, and what you're behind on
//   Out this week: premiere calendar, airing in the next 24 hours, latest premieres
import { Link, useSearchParams } from "react-router-dom";
import { useNow } from "@voidation/shared/hooks/useNow";
import { useDocumentTitle } from "../lib/useDocumentTitle.js";
import YourShows from "../components/YourShows.jsx";
import Upcoming from "./Upcoming.jsx";

export default function Schedule() {
  useDocumentTitle("Schedule");
  const now = useNow(1000);
  // ?view=week opens "Out this week" (old /upcoming links land here)
  const [params, setParams] = useSearchParams();
  const view = params.get("view") === "week" ? "week" : "mine";
  const setView = (v) => setParams(v === "week" ? { view: "week" } : {}, { replace: true });

  return (
    <div className="stack">
      <div className="row-head">
        <h1>Schedule</h1>
        <Link to="/season" className="btn ghost">Season chart →</Link>
      </div>

      <div className="seg-tabs schedule-tabs" role="tablist" aria-label="Schedule">
        <button role="tab" aria-selected={view === "mine"} className={`seg-tab${view === "mine" ? " on" : ""}`} onClick={() => setView("mine")}>Your watch</button>
        <button role="tab" aria-selected={view === "week"} className={`seg-tab${view === "week" ? " on" : ""}`} onClick={() => setView("week")}>Out this week</button>
      </div>

      {view === "mine" ? (
        <YourShows
          now={now}
          emptyText="Nothing you follow is airing right now. Mark an airing anime as Watching or Plan to Watch and its countdown shows up here, or see what's coming in Out this week."
        />
      ) : (
        <Upcoming />
      )}
    </div>
  );
}
