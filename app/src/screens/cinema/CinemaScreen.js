// MOVIES & TV — the "Cinema" tab. Two views: Discover (hero, trending, curated shelves, browse)
// and Your shelf (watchlist, watched, your verdicts). Works without a TMDB key (sample titles).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, View, Text, TextInput, Image, TouchableOpacity, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { fetchCinema, fetchTrendingCinema, hasTmdb, CINEMA_GENRES, CINEMA_SORTS } from "@voidpop/shared/api/tmdb";
import { buildCollections, featuredPick } from "@voidpop/shared/features/cinema";
import { SAMPLE_TAKES } from "@voidpop/shared/demo/cinema";
import { getCinemaShelf, onDataChange, timeAgo, VERDICTS } from "@voidpop/shared/backend/store";
import { useTheme } from "../../context/ThemeContext.js";
import { useGridColumns } from "../../utils/layout";
import { openDetail } from "../../utils/nav";
import Card from "../../components/ui/Card.js";
import Chips from "../../components/ui/Chips.js";
import PosterRow from "../../components/ui/PosterRow.js";
import { SkeletonGrid } from "../../components/ui/Skeleton.js";
import { VoidmonEmpty, VoidmonTrouble } from "../../components/brand/Voidmon.js";
import Icon from "../../components/ui/Icon.js";

const TYPES = [{ key: "all", label: "Everything" }, { key: "movie", label: "Movies" }, { key: "tv", label: "Series" }];
const GENRES = [{ key: "", label: "All genres" }, ...CINEMA_GENRES.map((g) => ({ key: g.name, label: g.name }))];

export default function CinemaScreen({ navigation }) {
  const { C } = useTheme();
  const styles = makeStyles(C);
  const [tab, setTab] = useState("discover");
  const live = hasTmdb();
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.head}>
        <Text style={styles.h1}>Movies &amp; TV</Text>
        <Text style={styles.sub}>Films and series, rated the VoidPop way: as a feeling, not a star score.</Text>
        <View style={styles.tabs}>
          {[["discover", "Discover"], ["shelf", "Your shelf"]].map(([k, label]) => (
            <TouchableOpacity key={k} onPress={() => setTab(k)} accessibilityRole="tab" accessibilityState={{ selected: tab === k }}
              style={[styles.tab, tab === k && { borderColor: C.purple, backgroundColor: C.card }]}>
              <Text style={{ color: tab === k ? C.purple : C.sub, fontWeight: "800" }}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      {tab === "shelf" ? <Shelf navigation={navigation} onFind={() => setTab("discover")} /> : <Discover navigation={navigation} live={live} />}
    </SafeAreaView>
  );
}

/* ---------------- Discover ---------------- */

function Discover({ navigation, live }) {
  const { C } = useTheme();
  const styles = makeStyles(C);
  const [pool, setPool] = useState(null);
  const [failed, setFailed] = useState(false);
  const [mine, setMine] = useState([]);
  const open = (item) => openDetail(navigation, item);

  const load = useCallback(() => {
    setFailed(false); setPool(null);
    Promise.all([
      fetchTrendingCinema(),
      fetchCinema("movie", { sort: "rated" }).then((r) => r.items).catch(() => []),
      fetchCinema("tv", { sort: "popular" }).then((r) => r.items).catch(() => []),
    ]).then((lists) => {
      const seen = new Set();
      setPool(lists.flat().filter((t) => !seen.has(`${t.segment}:${t.id}`) && seen.add(`${t.segment}:${t.id}`)));
    }).catch(() => setFailed(true));
  }, []);
  useEffect(load, [load]);
  useEffect(() => {
    const read = () => getCinemaShelf().then((s) => setMine(s.filter((e) => e.review))).catch(() => {});
    read();
    return onDataChange(read);
  }, []);

  const collections = useMemo(() => (pool ? buildCollections(pool) : []), [pool]);
  const hero = useMemo(() => (pool ? featuredPick(pool) : null), [pool]);
  const takes = useMemo(() => {
    const own = mine.slice(0, 3).map((e) => ({ id: `m-${e.item.segment}-${e.item.id}`, author: "You", time: timeAgo(e.review.date), item: e.item, verdict: e.review.verdict, body: e.review.comment }));
    const sample = pool?.some((t) => t.demo) ? SAMPLE_TAKES.map((t) => ({ ...t, sample: true, item: pool.find((p) => p.id === t.titleId) })) : [];
    return [...own, ...sample].slice(0, 3);
  }, [mine, pool]);

  if (failed) return <ScrollView><VoidmonTrouble what="Movies & TV" onRetry={load} navigation={navigation} /></ScrollView>;

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
      {!live && (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>Showing <Text style={{ fontWeight: "800" }}>sample titles</Text>. Set EXPO_PUBLIC_TMDB_API_KEY to see live movies and series.</Text>
        </View>
      )}

      {hero ? (
        <TouchableOpacity activeOpacity={0.9} onPress={() => open(hero)} accessibilityRole="button" accessibilityLabel={`${hero.title}. Explore the story`} style={styles.hero}>
          {hero.banner ? <Image source={{ uri: hero.banner }} style={StyleSheet.absoluteFill} resizeMethod="resize" /> : null}
          <View style={styles.heroShade} />
          <View style={{ padding: 18, gap: 6 }}>
            <Text style={styles.heroKicker}>THE STORY EVERYONE’S TALKING ABOUT</Text>
            <Text style={styles.heroTitle}>{hero.title}</Text>
            <Text style={styles.heroMeta}>{[hero.dateLabel, hero.segment === "tv" ? "Series" : "Movie", hero.runtime].filter(Boolean).join(" · ")}</Text>
            <Text style={styles.heroText} numberOfLines={3}>{hero.overview}</Text>
            <View style={styles.heroBtn}><Icon name="play" size={14} color="#fff" fill /><Text style={{ color: "#fff", fontWeight: "800" }}>Explore the story</Text></View>
          </View>
        </TouchableOpacity>
      ) : <View style={[styles.hero, { opacity: 0.5 }]} />}

      <PosterRow title="Talk of the town" items={pool?.slice(0, 12)} loading={!pool} onOpen={open} />

      <View style={styles.banner}>
        <Text style={styles.eyebrow}>A BETTER KIND OF RATING</Text>
        <Text style={styles.bannerTitle}>Forget the stars. Tell us how it felt.</Text>
        <Text style={styles.sub}>Some films are peak. Some are just a good Tuesday night. Your verdict should sound like you, not a spreadsheet.</Text>
        <View style={styles.legend}>
          {VERDICTS.map((v) => (
            <View key={v.key} style={styles.legendItem}><View style={[styles.dot, { backgroundColor: v.color }]} /><Text style={styles.legendText}>{v.label}</Text></View>
          ))}
        </View>
      </View>

      {collections.map((c) => (
        <View key={c.key}>
          <PosterRow title={c.title} items={c.items} onOpen={open} />
          <Text style={styles.rowSub}>{c.subtitle}</Text>
        </View>
      ))}

      {takes.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.h2}>A little more human</Text>
          <Text style={styles.sub}>What people felt, not what an algorithm decided.</Text>
          {takes.map((t) => <Take key={t.id} take={t} onOpen={open} />)}
        </View>
      )}

      <BrowseCinema navigation={navigation} />
    </ScrollView>
  );
}

function Take({ take, onOpen }) {
  const { C } = useTheme();
  const styles = makeStyles(C);
  const v = VERDICTS.find((x) => x.key === take.verdict);
  return (
    <TouchableOpacity disabled={!take.item} onPress={() => take.item && onOpen(take.item)} style={styles.take} accessibilityRole="button">
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text style={{ color: C.text, fontWeight: "800", flex: 1 }} numberOfLines={1}>{take.author}<Text style={{ color: C.faint, fontWeight: "400", fontSize: 12 }}>  {take.time}</Text></Text>
        {take.sample && <Text style={styles.sampleTag}>Sample</Text>}
        {v && <View style={[styles.vChip, { backgroundColor: v.color }]}><Text style={styles.vChipText}>{v.label}</Text></View>}
      </View>
      {!!take.item && <Text style={{ color: C.purple, fontWeight: "700", marginTop: 4 }}>{take.item.title}</Text>}
      {!!take.body && <Text style={{ color: C.text, lineHeight: 20, marginTop: 6 }}>{take.body}</Text>}
    </TouchableOpacity>
  );
}

/* ---------------- Browse ---------------- */

function BrowseCinema({ navigation }) {
  const { C } = useTheme();
  const styles = makeStyles(C);
  const cols = useGridColumns();
  const [type, setType] = useState("all");
  const [genre, setGenre] = useState("");
  const [sort, setSort] = useState("popular");
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const reqId = useRef(0); // answers from an older filter are ignored

  useEffect(() => {
    const t = setTimeout(() => setSearch(text.trim()), 350);
    return () => clearTimeout(t);
  }, [text]);

  const load = useCallback(async (pageToLoad, reset) => {
    const id = ++reqId.current;
    setLoading(true); setError(false);
    try {
      const kinds = type === "all" ? ["movie", "tv"] : [type];
      const results = await Promise.all(kinds.map((k) => fetchCinema(k, { sort, genre, search, page: pageToLoad })));
      if (id !== reqId.current) return;
      // "Everything" interleaves films and series so neither floods the grid
      const merged = results.length === 2
        ? Array.from({ length: Math.max(...results.map((r) => r.items.length)) }, (_, i) => results.map((r) => r.items[i]).filter(Boolean)).flat()
        : results[0].items;
      setItems((prev) => {
        const base = reset ? [] : prev;
        const seen = new Set(base.map((t) => `${t.segment}:${t.id}`));
        return [...base, ...merged.filter((t) => !seen.has(`${t.segment}:${t.id}`))];
      });
      setHasMore(results.some((r) => r.hasMore));
      setPage(pageToLoad + 1);
    } catch {
      if (id === reqId.current) { setError(true); setHasMore(false); }
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [type, genre, sort, search]);
  useEffect(() => { setItems([]); load(1, true); }, [load]);

  return (
    <View style={styles.section}>
      <Text style={styles.h2}>Find your next favourite</Text>
      <Chips options={TYPES} value={type} onChange={setType} style={{ paddingHorizontal: 0 }} />
      <TextInput value={text} onChangeText={setText} placeholder="Title, genre or director…" placeholderTextColor={C.faint} accessibilityLabel="Search movies and series"
        style={styles.search} returnKeyType="search" />
      <Chips options={GENRES} value={genre} onChange={setGenre} style={{ paddingHorizontal: 0 }} />
      <Chips options={CINEMA_SORTS.map((s) => ({ key: s.key, label: s.label }))} value={sort} onChange={setSort} style={{ paddingHorizontal: 0 }} />

      {error ? <VoidmonTrouble what="Movies & TV" onRetry={() => load(1, true)} navigation={navigation} /> : (
        <>
          <View style={{ flexDirection: "row", flexWrap: "wrap", marginHorizontal: -6 }}>
            {items.map((t) => <Card key={`${t.segment}-${t.id}`} item={t} columns={cols} onPress={() => openDetail(navigation, t)} />)}
          </View>
          {loading && <SkeletonGrid columns={cols} rows={items.length ? 1 : 2} />}
          {!loading && !items.length && <VoidmonEmpty pose="peeking" text="Nothing in this frame. Try a different search or fewer filters." />}
          {hasMore && !loading && (
            <TouchableOpacity onPress={() => load(page, false)} accessibilityRole="button" style={styles.more}><Text style={{ color: C.text, fontWeight: "700" }}>Show more</Text></TouchableOpacity>
          )}
        </>
      )}
    </View>
  );
}

/* ---------------- Your shelf ---------------- */

function Shelf({ navigation, onFind }) {
  const { C } = useTheme();
  const styles = makeStyles(C);
  const cols = useGridColumns();
  const [shelf, setShelf] = useState(null);
  useEffect(() => {
    const read = () => getCinemaShelf().then(setShelf).catch(() => setShelf([]));
    read();
    return onDataChange(read);
  }, []);
  if (!shelf) return null;
  if (!shelf.length) {
    return (
      <ScrollView>
        <VoidmonEmpty pose="peeking" text="Your shelf is a blank canvas. Add a few movies or series and they’ll wait here, with your verdicts.">
          <TouchableOpacity onPress={onFind} accessibilityRole="button" style={[styles.more, { backgroundColor: C.purple, borderColor: C.purple, marginTop: 16 }]}><Text style={{ color: "#fff", fontWeight: "800" }}>Find something to watch</Text></TouchableOpacity>
        </VoidmonEmpty>
      </ScrollView>
    );
  }
  const plan = shelf.filter((e) => e.status === "plan");
  const watched = shelf.filter((e) => e.status === "completed");
  const verdicts = shelf.filter((e) => e.review).length;
  const grid = (entries, empty) => (entries.length ? (
    <View style={{ flexDirection: "row", flexWrap: "wrap", marginHorizontal: -6 }}>
      {entries.map((e) => {
        const v = VERDICTS.find((x) => x.key === e.review?.verdict);
        return (
          <View key={`${e.item.segment}-${e.item.id}`} style={{ width: `${100 / cols}%` }}>
            <Card item={e.item} onPress={() => openDetail(navigation, e.item)} />
            {v && <View style={[styles.vChip, { backgroundColor: v.color, position: "absolute", top: 14, left: 14 }]} pointerEvents="none"><Text style={styles.vChipText}>{v.label}</Text></View>}
          </View>
        );
      })}
    </View>
  ) : <Text style={styles.sub}>{empty}</Text>);
  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.stats}>
        {[[plan.length, "On your watchlist"], [watched.length, "Watched"], [verdicts, "Verdicts given"]].map(([n, l]) => (
          <View key={l} style={styles.stat}><Text style={styles.statN}>{n}</Text><Text style={styles.statL}>{l}</Text></View>
        ))}
      </View>
      <View style={styles.section}><Text style={styles.h2}>Watchlist <Text style={{ color: C.faint }}>{plan.length}</Text></Text>{grid(plan, "Nothing saved for later yet.")}</View>
      <View style={styles.section}><Text style={styles.h2}>Watched <Text style={{ color: C.faint }}>{watched.length}</Text></Text>{grid(watched, "Mark a title as watched from its page.")}</View>
    </ScrollView>
  );
}

const makeStyles = (C) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  head: { paddingHorizontal: 18, paddingTop: 8, gap: 4 },
  h1: { color: C.text, fontSize: 28, fontWeight: "800" },
  h2: { color: C.text, fontSize: 19, fontWeight: "800" },
  sub: { color: C.sub, fontSize: 13, lineHeight: 19 },
  tabs: { flexDirection: "row", gap: 8, marginTop: 10, marginBottom: 6 },
  tab: { borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  notice: { marginHorizontal: 18, marginTop: 8, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: C.border, backgroundColor: C.card },
  noticeText: { color: C.sub, fontSize: 12, lineHeight: 18 },
  hero: { marginHorizontal: 18, marginTop: 12, minHeight: 250, borderRadius: 18, overflow: "hidden", backgroundColor: C.card, justifyContent: "flex-end", borderWidth: 1, borderColor: C.border },
  heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(8,10,16,0.72)" },
  heroKicker: { color: "#d1d5db", fontSize: 10, fontWeight: "800", letterSpacing: 1.2 },
  heroTitle: { color: "#fff", fontSize: 28, fontWeight: "800" },
  heroMeta: { color: "#d1d5db", fontSize: 13 },
  heroText: { color: "#e5e7eb", lineHeight: 20 },
  heroBtn: { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start", backgroundColor: C.purple, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, marginTop: 6 },
  banner: { marginHorizontal: 18, marginTop: 22, padding: 18, borderRadius: 16, borderWidth: 1, borderColor: C.border, backgroundColor: C.card, gap: 6 },
  eyebrow: { color: C.purple, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  bannerTitle: { color: C.text, fontSize: 22, fontWeight: "800", lineHeight: 27 },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: C.bg },
  legendText: { color: C.text, fontWeight: "700", fontSize: 13 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  rowSub: { color: C.faint, fontSize: 12, paddingHorizontal: 18, marginTop: 2 },
  section: { paddingHorizontal: 18, marginTop: 24, gap: 10 },
  take: { backgroundColor: C.card, borderColor: C.border, borderWidth: 1, borderRadius: 12, padding: 12 },
  sampleTag: { color: C.faint, fontSize: 10, fontWeight: "800", borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1 },
  vChip: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  vChipText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  search: { color: C.text, backgroundColor: C.inputBg, borderColor: C.border, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  more: { alignSelf: "center", borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10, marginTop: 8 },
  stats: { flexDirection: "row", gap: 10, paddingHorizontal: 18, marginTop: 12 },
  stat: { flex: 1, backgroundColor: C.card, borderColor: C.border, borderWidth: 1, borderRadius: 12, padding: 12 },
  statN: { color: C.text, fontSize: 24, fontWeight: "800" },
  statL: { color: C.sub, fontSize: 11 },
});
