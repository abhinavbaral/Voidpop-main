// BROWSE — sidebar-driven. The ☰ Filters button opens the sidebar, where
// the two segments live; the active segment expands into DROPDOWNS:
//   Anime : Origin (All/JP/KR Animation/CN Donghua), Season, Year, Sort
//   Manga : Origin (All/JP/Manhwa/Manhua/Comics), Sort

import { useEffect, useRef, useState, useCallback } from "react";
import {
  View, Text, FlatList, ActivityIndicator, StyleSheet, TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Sidebar from "../components/Sidebar.js";
import Card from "../components/Card.js";
import {
  fetchAniList, SORTS, SEASONS, GENRES, ANIME_ORIGINS, MANGA_ORIGINS,
} from "@voidation/shared/api/anilist";
import { useTheme } from "../context/ThemeContext.js";
import { useGridColumns } from "../lib/layout";
import { openDetail } from "../lib/nav";
import Icon from "../components/Icon.js";
import { SkeletonGrid } from "../components/Skeleton.js";
import { VoidmonEmpty, VoidmonTrouble } from "../components/Voidmon.js";

const SEGMENTS = [
  { key: "anime", label: "Anime" },
  { key: "manga", label: "Manga" },
];

const ORIGIN_MAP = {
  anime: ANIME_ORIGINS,
  manga: MANGA_ORIGINS,
};

const THIS_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 10 }, (_, i) => ({
  key: String(THIS_YEAR - i), label: String(THIS_YEAR - i),
}));
const SEASON_OPTIONS = [
  { key: "", label: "All time", icon: "calendar" },
  ...SEASONS.map((s) => ({ key: s, label: s[0].toUpperCase() + s.slice(1), icon: s === "summer" ? "sun" : s })),
];

export default function BrowseScreen({ navigation, route }) {
  const { C } = useTheme();
  const styles = makeStyles(C);
  const cols = useGridColumns();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [segment, setSegment] = useState("anime");
  const [origin, setOrigin] = useState("");
  const [season, setSeason] = useState("");
  const [year, setYear] = useState(String(THIS_YEAR));
  const [sort, setSort] = useState(route?.params?.sort || "popular"); // "See all" from Top rated opens it sorted by score
  const [genre, setGenre] = useState("");

  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const loadingRef = useRef(false);

  const load = useCallback(
    async (pageToLoad, reset = false) => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      setLoading(true);
      setError(null);
      try {
        const opts = { page: pageToLoad, sort, origin, genre };
        const result = await fetchAniList(segment, {
          ...opts,
          season: segment === "anime" ? season : "",
          year: Number(year),
        });
        setItems((prev) => {
          const base = reset ? [] : prev;
          const ids = new Set(base.map((i) => i.id));
          return [...base, ...result.items.filter((i) => !ids.has(i.id))];
        });
        setHasMore(result.hasMore);
        setPage(pageToLoad + 1);
      } catch (e) {
        setError("Could not load data. Retry in a moment.");
        setHasMore(false);
      } finally {
        setLoading(false);
        loadingRef.current = false;
      }
    },
    [segment, sort, origin, season, year, genre]
  );
  const retryFirst = useCallback(() => load(1, true), [load]);

  useEffect(() => {
    setItems([]);
    setHasMore(true);
    load(1, true);
  }, [load]);

  const changeSegment = (key) => {
    if (key !== segment) {
      setSegment(key);
      setOrigin("");
      setSeason("");
      setSort("popular");
    }
  };

  // filter sections for the ACTIVE segment (Genres, Season + Year, Origin, Sort)
  const sections = [
    {
      label: "Genres",
      value: genre,
      options: [{ key: "", label: "All" }, ...GENRES.map((g) => ({ key: g, label: g }))],
      onSelect: setGenre,
    },
    ...(segment === "anime"
      ? [
          { label: "Season", value: season, options: SEASON_OPTIONS, onSelect: setSeason, layout: "tiles" },
          ...(season
            ? [{ label: "Year", value: year, options: YEAR_OPTIONS, onSelect: setYear, layout: "row" }]
            : []),
        ]
      : []),
    {
      label: "Origin",
      value: origin,
      options: ORIGIN_MAP[segment],
      onSelect: setOrigin,
    },
    ...(!(segment === "anime" && season)
      ? [{ label: "Sort by", value: sort, options: SORTS, onSelect: setSort }]
      : []),
  ];

  // summary line under the header, e.g. "Anime · Japanese Anime · Summer 2026"
  const summary = [
    SEGMENTS.find((s) => s.key === segment)?.label,
    ORIGIN_MAP[segment].find((o) => o.key === origin && o.key !== "")?.label,
    genre || null,
    segment === "anime" && season
      ? `${season[0].toUpperCase() + season.slice(1)} ${year}`
      : null,
    !(segment === "anime" && season)
      ? SORTS.find((s) => s.key === sort && s.key !== "popular")?.label
      : null,
  ]
    .filter(Boolean)
    .join("  ·  ");

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        {navigation.canGoBack() && (
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.filterBtn} accessibilityLabel="Back">
            <Text style={styles.filterBtnText}>‹</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={() => setSidebarOpen(true)} style={styles.filterBtn}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><Icon name="menu" size={15} color={C.text} /><Text style={styles.filterBtnText}>Filters</Text></View>
        </TouchableOpacity>
        <Text style={styles.summary} numberOfLines={1}>{summary}</Text>
      </View>

      {error ? (
        <VoidmonTrouble what="Browse" onRetry={retryFirst} navigation={navigation} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => `${segment}-${item.id}`}
          key={`grid-${cols}`}
        numColumns={cols}
          contentContainerStyle={{ padding: 6, paddingBottom: 30 }}
          renderItem={({ item }) => (
            <Card item={item} columns={cols} onPress={() => openDetail(navigation, item)} />
          )}
          onEndReached={() => hasMore && !loadingRef.current && load(page)}
          onEndReachedThreshold={0.6}
          ListFooterComponent={
            loading ? <ActivityIndicator color={C.orange} style={{ margin: 20 }} /> : null
          }
          ListEmptyComponent={
            !loading ? <VoidmonEmpty pose="peeking" text="No results found. Try fewer filters." /> : <SkeletonGrid columns={cols} rows={3} />
          }
        />
      )}

      <Sidebar
        visible={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        segments={SEGMENTS}
        segment={segment}
        onSegment={changeSegment}
        sections={sections}
      />
    </SafeAreaView>
  );
}

const makeStyles = (C) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 14, paddingTop: 8, paddingBottom: 6,
  },
  filterBtn: {
    height: 38, borderRadius: 10, borderWidth: 1, borderColor: C.border,
    backgroundColor: C.card, paddingHorizontal: 14, justifyContent: "center",
  },
  filterBtnText: { color: C.text, fontWeight: "800", fontSize: 13 },
  summary: { color: C.sub, fontSize: 12, flex: 1 },
  errorBox: { margin: 16, padding: 16, borderRadius: 12, backgroundColor: "#451a03" },
  errorText: { color: "#fcd34d", fontSize: 13, lineHeight: 19 },
  retry: {
    marginTop: 10, alignSelf: "flex-start", backgroundColor: C.orange,
    borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8,
  },
  empty: { color: C.faint, textAlign: "center", marginTop: 40 },
});
