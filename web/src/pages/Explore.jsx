// Home. Same sections and same daily picks as the app (shared/explore.js).
import { useEffect, useState } from "react";
import { loadExplore, loadVerdictRows, loadNewSeasons } from "@voidation/shared/explore";
import { useNow } from "@voidation/shared/hooks/useNow";
import PosterRow from "../components/PosterRow.jsx";
import { useDocumentTitle } from "../lib/useDocumentTitle.js";

export default function Explore() {
  useDocumentTitle(null);
  const now = useNow(30000); // card countdowns show minutes at most, so every 30s is enough
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [verdictRows, setVerdictRows] = useState([]);
  const [newSeasons, setNewSeasons] = useState([]);

  useEffect(() => {
    loadExplore().then(setData).catch(() => {}).finally(() => setLoading(false));
    loadVerdictRows().then(setVerdictRows).catch(() => {});
    loadNewSeasons().then(setNewSeasons).catch(() => {});
  }, []);

  return (
    <div className="stack">
      {newSeasons.length > 0 && <PosterRow title="🆕 New seasons of shows you watched" items={newSeasons} now={now} />}
      {verdictRows.map((r) => (
        <PosterRow key={r.verdict} title={r.title} dot={r.color} items={r.items} now={now} />
      ))}
      <PosterRow title="🔥 Talk of the Week" items={data.talk} loading={loading} now={now} />
      <PosterRow title="🎌 Don't Miss This — Anime" items={data.dontMissAnime} loading={loading} now={now} />
      <PosterRow title="📖 Don't Miss This — Manga" items={data.dontMissManga} loading={loading} now={now} />
      <PosterRow title="⭐ Voidation Recommendations" items={data.voidpicks} loading={loading} now={now} />
    </div>
  );
}
