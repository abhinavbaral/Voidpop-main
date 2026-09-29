// Home. Same sections and same daily picks as the app (shared/explore.js).
import { useEffect, useState } from "react";
import { loadExplorePools, buildExplore, knownKeys, loadVerdictRows, loadNewSeasons, loadAnimeOfTheYear } from "@voidation/shared/explore";
import Browse from "./Browse.jsx";
import { useNow } from "@voidation/shared/hooks/useNow";
import PosterRow from "../components/PosterRow.jsx";
import YourShows from "../components/YourShows.jsx";
import { loadSpotlightRow } from "@voidation/shared/backend/store";
import { useDocumentTitle } from "../lib/useDocumentTitle.js";

export default function Explore() {
  useDocumentTitle(null);
  const now = useNow(1000); // the Up next countdowns tick every second
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [verdictRows, setVerdictRows] = useState([]);
  const [newSeasons, setNewSeasons] = useState([]);
  const [spotlight, setSpotlight] = useState(null);

  const [aoty, setAoty] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  // shuffle = true: a refresh gets different pages and a new mix (Anime of the Year stays)
  const load = async (shuffle) => {
    const [pools, known] = await Promise.all([loadExplorePools({ shuffle }), knownKeys()]);
    setData(buildExplore(pools, known, shuffle ? Math.floor(Math.random() * 1e6) : undefined));
  };
  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([load(true).catch(() => {}), loadNewSeasons().then(setNewSeasons).catch(() => {}), loadVerdictRows().then(setVerdictRows).catch(() => {})]);
    setRefreshing(false);
  };

  useEffect(() => {
    load(false).catch(() => {}).finally(() => setLoading(false));
    loadAnimeOfTheYear().then(setAoty).catch(() => {});
    loadVerdictRows().then(setVerdictRows).catch(() => {});
    loadNewSeasons().then(setNewSeasons).catch(() => {});
    loadSpotlightRow().then(setSpotlight).catch(() => {});
  }, []);

  return (
    <div className="stack">
      <div className="explore-head">
        <button className="btn ghost" onClick={refresh} disabled={refreshing || loading}>{refreshing ? "Refreshing…" : "↻ New picks"}</button>
        <a className="btn ghost" href="#browse">🔎 Browse</a>
      </div>
      {spotlight && <PosterRow title={`⭐ ${spotlight.title}`} items={spotlight.items} now={now} />}
      <YourShows now={now} layout="row" title="⏳ Up next" />
      {newSeasons.length > 0 && <PosterRow title="🆕 New seasons of shows you watched" items={newSeasons} now={now} />}
      {data.coming?.length > 0 && <PosterRow title={`📅 ${data.comingTitle}`} items={data.coming} now={now} />}
      {verdictRows.map((r) => (
        <PosterRow key={r.verdict} title={r.title} dot={r.color} items={r.items} now={now} />
      ))}
      <PosterRow title="🔥 Talk of the Week" items={data.talk} loading={loading} now={now} />
      <PosterRow title="🎌 Don't Miss This — Anime" items={data.dontMissAnime} loading={loading} now={now} />
      <PosterRow title="📖 Don't Miss This — Manga" items={data.dontMissManga} loading={loading} now={now} />
      <PosterRow title="🌀 Isekai Heaven" items={data.isekai} loading={loading} now={now} />
      <PosterRow title="🔥 Shonen Feast" items={data.shonen} loading={loading} now={now} />
      <PosterRow title="⭐ Voidation Angles" items={data.voidpicks} loading={loading} now={now} />
      {aoty.length > 0 && <PosterRow title="🏆 Anime of the Year · the last decade" items={aoty} now={now} />}
      <Browse embedded />
    </div>
  );
}
