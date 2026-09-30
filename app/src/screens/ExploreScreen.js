// EXPLORE — the homepage. Pull down for new picks (everything reshuffles
// except Anime of the Year). Browse opens from the button at the top.

import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { FlatList, View, Text, TouchableOpacity, StyleSheet, RefreshControl, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import PosterRow from "../components/PosterRow.js";
import { loadCategoryRows } from "@voidation/shared/backend/store";
import Brand from "../components/Brand.js";
import { loadExplorePools, buildExplore, knownKeys, loadVerdictRows, loadNewSeasons, loadAnimeOfTheYear, loadJumpBackIn } from "@voidation/shared/explore";
import { useTheme } from "../context/ThemeContext.js";
import { openDetail } from "../lib/nav";
import { useIsWide } from "../lib/layout";
import Icon from "../components/Icon.js";
import AnimatedBanner from "../components/AnimatedBanner.js";
import { NewEpisodeCards, Countdowns } from "../components/ExploreCards.js";
import RankedRow from "../components/RankedRow.js";
import Billboard from "../components/Billboard.js";
import { COUNTRIES } from "./TrendsScreen.js";
import { fetchAniList } from "@voidation/shared/api/anilist";

// the greeting on the banner, by the time of day
const greeting = (h = new Date().getHours()) =>
  h < 5 ? "Still up?" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : h < 22 ? "Good evening" : "Still up?";

export default function ExploreScreen({ navigation }) {
  const { C, dark } = useTheme();
  const styles = makeStyles(C);
  const wide = useIsWide();
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [verdictRows, setVerdictRows] = useState([]);
  const [newSeasons, setNewSeasons] = useState([]);
  const [jump, setJump] = useState({ anime: [], manga: [] }); // titles you started and left
  const [catRows, setCatRows] = useState([]); // your categories (500+ completed), days 15–21

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

  // "Trending in [Japan]": tap the pill to switch Japan → Korea → China
  const [country, setCountry] = useState("JP");
  const [trend, setTrend] = useState(null);
  const nextCountry = () => {
    const list = COUNTRIES.filter((c) => c.key);
    setCountry(list[(list.findIndex((c) => c.key === country) + 1) % list.length].key);
  };
  // "Top rated": the highest-scored anime on AniList
  const [topRated, setTopRated] = useState(null);
  useEffect(() => {
    fetchAniList("anime", { sort: "score", perPage: 10 }).then((r) => setTopRated(r.items)).catch(() => setTopRated([]));
  }, []);
  useEffect(() => {
    let alive = true;
    setTrend(null);
    fetchAniList("anime", { sort: "trending", origin: country, perPage: 15 }).then((r) => alive && setTrend(r.items)).catch(() => alive && setTrend([]));
    return () => { alive = false; };
  }, [country]);


  // Explore's rows in order. Each one renders only when it's near the screen.
  const row = (key, render) => ({ key, render });
  const sections = [
    data.featured && row("billboard", () => <Billboard item={data.featured} onOpen={open} />),
    row("new-eps", () => <NewEpisodeCards onOpen={open} />),
    ...catRows.map((r) => row(`cat-${r.id}`, () => <PosterRow title={r.title} items={r.items} onOpen={open} />)),
    row("coming-up", () => <Countdowns onOpen={open} />),
    // right under Coming up on purpose: mark one of these Excited and it
    // leaves this row and starts counting down in Coming up
    data.coming?.length > 0 && row("coming-soon", () => <PosterRow title={data.comingTitle} chip={data.comingChip} items={data.coming} onOpen={open} />),
    jump.anime.length > 0 && row("jump-anime", () => <PosterRow title="Jump back in: Anime" items={jump.anime} onOpen={open} />),
    jump.manga.length > 0 && row("jump-manga", () => <PosterRow title="Jump back in: Manga" items={jump.manga} onOpen={open} />),
    newSeasons.length > 0 && row("new-seasons", () => <PosterRow title="New seasons of shows you watched" items={newSeasons} onOpen={open} />),
    ...verdictRows.map((r) => row(`verdict-${r.verdict}`, () => <PosterRow title={r.title} dot={r.color} items={r.items} onOpen={open} />)),
    row("talk", () => <PosterRow title="Talk of the Week" items={data.talk} loading={loading} onOpen={open} onMore={() => navigation.navigate("Trends")} />),
    row("top-rated", () => <RankedRow title="Top rated" subtitle="The highest-scored anime on AniList" items={topRated} loading={topRated === null} onOpen={open}
      onMore={() => navigation.navigate("Browse", { sort: "score" })} />),
    row("trending-in", () => <PosterRow title="Trending in" items={trend} loading={trend === null} onOpen={open}
      chip={{ label: COUNTRIES.find((c) => c.key === country)?.label, onPress: nextCountry, a11y: "Change country" }}
      onMore={() => navigation.navigate("Trends", { country })} />),
    row("dont-miss-anime", () => <PosterRow title="Don't Miss This — Anime" items={data.dontMissAnime} loading={loading} onOpen={open} />),
    row("dont-miss-manga", () => <PosterRow title="Don't Miss This — Manga" items={data.dontMissManga} loading={loading} onOpen={open} />),
    row("isekai", () => <PosterRow title="Isekai Heaven" items={data.isekai} loading={loading} onOpen={open} />),
    row("shonen", () => <PosterRow title="Shonen Feast" items={data.shonen} loading={loading} onOpen={open} />),
    row("angles", () => <PosterRow title="Voidation Angles" items={data.voidpicks} loading={loading} onOpen={open} />),
    aoty.length > 0 && row("aoty", () => <PosterRow title="Anime of the Year (Crunchyroll Awards)" items={aoty} onOpen={open} />),
  ].filter(Boolean);

  const header = !wide && (
    <>
    <View style={styles.hero}>
      {/* the same animated sky as More (sun by day, moon and stars by night) */}
      <View style={StyleSheet.absoluteFill}><AnimatedBanner accent={C.purple} dark={dark} height={170} /></View>
      <View style={styles.heroTop}><Brand size={20} /></View>
      <Text style={styles.hello} accessibilityRole="header">{greeting()}</Text>
    </View>
    <View style={styles.header}>
      {/* search and Browse in one row */}
      <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
        <TouchableOpacity onPress={() => navigation.navigate("Search")} style={[styles.searchBtn, { flex: 1, marginTop: 0 }]}>
          <Text style={{ color: C.faint, fontSize: 13 }}>Search anime and manga...</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate("Browse")} style={[styles.searchBtn, { marginTop: 0 }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><Icon name="browse" size={14} color={C.text} /><Text style={{ color: C.text, fontSize: 13, fontWeight: "700" }}>Browse</Text></View>
        </TouchableOpacity>
      </View>
    </View>
    </>
    ) || null;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* One vertical list of rows, drawn only near the screen: rows (and their
          posters) appear as you scroll to them and are dropped once they're
          well above or below, so Explore never holds every poster at once. */}
      <FlatList
        data={sections}
        keyExtractor={(x) => x.key}
        renderItem={({ item: x }) => x.render()}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingBottom: 30 }}
        initialNumToRender={4}
        maxToRenderPerBatch={2}
        windowSize={5}
        removeClippedSubviews={Platform.OS === "android"}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.purple} colors={[C.purple]} />}
      />
    </SafeAreaView>
  );
}

const makeStyles = (C) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: { paddingHorizontal: 14, paddingTop: 10 },
  hero: { height: 170, overflow: "hidden", justifyContent: "space-between", padding: 14, paddingBottom: 18 },
  heroTop: { flexDirection: "row", alignItems: "center" },
  hello: { color: "#fff", fontSize: 30, fontWeight: "900", textShadowColor: "rgba(0,0,0,0.35)", textShadowRadius: 8, textShadowOffset: { width: 0, height: 2 } },
  brand: { color: C.text, fontSize: 22, fontWeight: "800" },
  searchBtn: {
    marginTop: 10, height: 40, borderRadius: 12, borderWidth: 1,
    borderColor: C.border, backgroundColor: C.card,
    justifyContent: "center", paddingHorizontal: 14,
  },
});
