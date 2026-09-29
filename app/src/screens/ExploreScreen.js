// EXPLORE — the homepage. Pull down for new picks (everything reshuffles
// except Anime of the Year). Browse opens from the button at the top.

import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { ScrollView, View, Text, TouchableOpacity, StyleSheet, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import PosterRow from "../components/PosterRow.js";
import YourShows from "../components/YourShows.js";
import { loadCategoryRows } from "@voidation/shared/backend/store";
import { useNow } from "@voidation/shared/hooks/useNow";
import Brand from "../components/Brand.js";
import { loadExplorePools, buildExplore, knownKeys, loadVerdictRows, loadNewSeasons, loadAnimeOfTheYear, loadJumpBackIn } from "@voidation/shared/explore";
import { useTheme } from "../context/ThemeContext.js";
import { openDetail } from "../lib/nav";
import { useIsWide } from "../lib/layout";
import Icon from "../components/Icon.js";

export default function ExploreScreen({ navigation }) {
  const { C } = useTheme();
  const styles = makeStyles(C);
  const wide = useIsWide();
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [verdictRows, setVerdictRows] = useState([]);
  const [newSeasons, setNewSeasons] = useState([]);
  const [jump, setJump] = useState({ anime: [], manga: [] }); // titles you started and left
  const [catRows, setCatRows] = useState([]); // your categories (500+ completed), days 15–21
  const now = useNow(1000); // Up next countdowns tick every second

  // your verdicts change as you use the app, so these rows refresh on every visit
  useFocusEffect(useCallback(() => {
    loadVerdictRows().then(setVerdictRows).catch(() => {});
    loadNewSeasons().then(setNewSeasons).catch(() => {});
    loadJumpBackIn().then(setJump).catch(() => {});
    loadCategoryRows().then(setCatRows).catch(() => {});
  }, []));

  const [pools, setPools] = useState(null);
  const [seed, setSeed] = useState(undefined); // undefined = today's picks; a number after pull-to-refresh
  const [aoty, setAoty] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  useEffect(() => {
    // same sections, same daily picks as the website
    loadExplorePools()
      .then(setPools)
      .catch(() => setLoading(false));
    loadAnimeOfTheYear().then(setAoty).catch(() => {});
  }, []);
  // anything you add to your library disappears from Explore when you come back
  useFocusEffect(useCallback(() => {
    if (!pools) return;
    knownKeys().then((known) => { setData(buildExplore(pools, known, seed)); setLoading(false); }).catch(() => {});
  }, [pools, seed]));

  // pull to refresh: different pages from AniList and a new mix
  const refresh = async () => {
    setRefreshing(true);
    try {
      const fresh = await loadExplorePools({ shuffle: true });
      setSeed(Math.floor(Math.random() * 1e6));
      setPools(fresh);
      loadVerdictRows().then(setVerdictRows).catch(() => {});
      loadNewSeasons().then(setNewSeasons).catch(() => {});
      loadJumpBackIn().then(setJump).catch(() => {});
    } catch { /* offline: keep what's shown */ }
    setRefreshing(false);
  };

  const open = (item) => openDetail(navigation, item);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 30 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.purple} colors={[C.purple]} />}
      >
        {!wide && (
        <View style={styles.header}>
          {/* logo on the left, then search and Browse in one row */}
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            <Brand size={22} />
            <TouchableOpacity onPress={() => navigation.navigate("Search")} style={[styles.searchBtn, { flex: 1, marginTop: 0 }]}>
              <Text style={{ color: C.faint, fontSize: 13 }}>Search anime and manga...</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate("Browse")} style={[styles.searchBtn, { marginTop: 0 }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><Icon name="browse" size={14} color={C.text} /><Text style={{ color: C.text, fontSize: 13, fontWeight: "700" }}>Browse</Text></View>
            </TouchableOpacity>
          </View>
        </View>
        )}

        {catRows.map((r) => <PosterRow key={r.id} title={r.title} items={r.items} onOpen={open} />)}
        <YourShows now={now} layout="row" title="Up next" onOpen={open} />
        {jump.anime.length > 0 && <PosterRow title="Jump back in: Anime" items={jump.anime} onOpen={open} />}
        {jump.manga.length > 0 && <PosterRow title="Jump back in: Manga" items={jump.manga} onOpen={open} />}
        {newSeasons.length > 0 && <PosterRow title="New seasons of shows you watched" items={newSeasons} onOpen={open} />}
        {data.coming?.length > 0 && <PosterRow title={data.comingTitle} items={data.coming} onOpen={open} />}
        {verdictRows.map((r) => (
          <PosterRow key={r.verdict} title={r.title} dot={r.color} items={r.items} onOpen={open} />
        ))}
        <PosterRow title="Talk of the Week" items={data.talk} loading={loading} onOpen={open} />
        <PosterRow title="Don't Miss This — Anime" items={data.dontMissAnime} loading={loading} onOpen={open} />
        <PosterRow title="Don't Miss This — Manga" items={data.dontMissManga} loading={loading} onOpen={open} />
        <PosterRow title="Isekai Heaven" items={data.isekai} loading={loading} onOpen={open} />
        <PosterRow title="Shonen Feast" items={data.shonen} loading={loading} onOpen={open} />
        <PosterRow title="Voidation Angles" items={data.voidpicks} loading={loading} onOpen={open} />
        {aoty.length > 0 && <PosterRow title="Anime of the Year (Crunchyroll Awards)" items={aoty} onOpen={open} />}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (C) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: { paddingHorizontal: 14, paddingTop: 8 },
  brand: { color: C.text, fontSize: 22, fontWeight: "800" },
  searchBtn: {
    marginTop: 10, height: 40, borderRadius: 12, borderWidth: 1,
    borderColor: C.border, backgroundColor: C.card,
    justifyContent: "center", paddingHorizontal: 14,
  },
});
