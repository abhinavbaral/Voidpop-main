// SEASON CHART — every anime of a season, grouped by format (TV, ONA, Movies…),
// with countdown badges and one-tap Plan to Watch. ‹ › moves between seasons.
// Sort by hype (most followed), trending, soonest or A–Z; grid or list view.
import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, Image, FlatList, TouchableOpacity, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "@voidpop/shared/backend/AuthContext";
import { getLibrary, setStatus, statusesFor } from "@voidpop/shared/backend/store";
import { seasonOf, shiftSeason, seasonTitle, seasonMonths, FORMAT_GROUPS, groupOf, fetchSeason } from "@voidpop/shared/features/seasonChart";
import Chips from "../../components/ui/Chips.js";
import FilterChips from "../../components/ui/FilterChips.js";
import { applyFilters } from "@voidpop/shared/lib/filters";
import { useSettings } from "@voidpop/shared/backend/SettingsContext";
import { hypeLabel, formatCountdown, releaseLabel } from "@voidpop/shared/lib/format";
import Icon from "../../components/ui/Icon.js";
import Card from "../../components/ui/Card.js";
import { useTheme } from "../../context/ThemeContext.js";
import { useGridColumns } from "../../utils/layout";
import { openDetail, goBackOrHome } from "../../utils/nav";
import { SkeletonList, SkeletonGrid } from "../../components/ui/Skeleton.js";
import { VoidmonTrouble } from "../../components/brand/Voidmon.js";

export default function SeasonScreen({ navigation }) {
  const { C } = useTheme();
  const styles = makeStyles(C);
  const cols = useGridColumns();
  const { user } = useAuth();
  const [season, setSeason] = useState(seasonOf);
  const [items, setItems] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const [group, setGroup] = useState("all");
  const [lib, setLib] = useState({});
  const [filters, setFilters] = useState({ genre: "", studio: "" });
  const [sort, setSort] = useState("hype");
  const { settings, update } = useSettings();
  const list = settings.seasonLayout === "list";

  useFocusEffect(useCallback(() => { getLibrary(user).then(setLib).catch(() => {}); }, [user]));

  useEffect(() => {
    let alive = true;
    setItems(null);
    setError(false);
    setLoading(true);
    fetchSeason(season, (so) => alive && setItems(so))
      .then((all) => alive && setItems(all))
      .catch(() => alive && setError(true))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [season, attempt]);

  const counts = useMemo(() => {
    const c = {};
    (items || []).forEach((it) => { const g = groupOf(it); c[g] = (c[g] || 0) + 1; });
    return c;
  }, [items]);
  const groups = [
    { key: "all", label: `All ${items ? items.length : ""}` },
    ...FORMAT_GROUPS.filter((g) => counts[g.key]).map((g) => ({ key: g.key, label: `${g.label} ${counts[g.key]}` })),
  ];
  const SORTS = {
    hype: (a, b) => (b.popularity || 0) - (a.popularity || 0),
    trending: (a, b) => (b.trending || 0) - (a.trending || 0) || (b.popularity || 0) - (a.popularity || 0),
    soonest: (a, b) => (a.nextEpisode?.airingAt ?? Infinity) - (b.nextEpisode?.airingAt ?? Infinity) || (a.date || "9").localeCompare(b.date || "9"),
    title: (a, b) => a.title.localeCompare(b.title),
  };
  const shown = [...applyFilters((items || []).filter((it) => group === "all" || groupOf(it) === group), filters)].sort(SORTS[sort]);
  const label = (key) => statusesFor("anime").find((s) => s.key === key)?.label;

  // adds to Plan to Watch, or undoes that; never removes a title you're
  // already watching (that would throw away its progress)
  const togglePlan = async (item) => {
    const tracked = lib[`anime:${item.id}`];
    if (tracked && tracked.status !== "plan") return;
    await setStatus(user, "anime", item, tracked ? null : "plan");
    setLib(await getLibrary(user));
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBackOrHome(navigation)} hitSlop={10}>
          <Text style={{ color: C.purple }}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.nav}>
          <TouchableOpacity style={styles.arrow} onPress={() => { setGroup("all"); setSeason((s) => shiftSeason(s, -1)); }} accessibilityLabel="Previous season">
            <Text style={styles.arrowText}>‹</Text>
          </TouchableOpacity>
          <View style={{ alignItems: "center" }}>
            <Text style={{ color: C.faint, fontSize: 11, fontWeight: "600" }}>{seasonMonths(season)}</Text>
            <Text style={styles.title}>{seasonTitle(season)} Anime</Text>
          </View>
          <TouchableOpacity style={styles.arrow} onPress={() => { setGroup("all"); setSeason((s) => shiftSeason(s, 1)); }} accessibilityLabel="Next season">
            <Text style={styles.arrowText}>›</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={{ paddingHorizontal: 14 }}>
        <Chips options={groups} value={group} onChange={setGroup} />
        <FilterChips items={items} value={filters} onChange={setFilters} style={{ marginTop: 6 }} />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 }}>
          <Chips style={{ flex: 1 }} value={sort} onChange={setSort}
            options={[{ key: "hype", label: "Hype" }, { key: "trending", label: "Trending" }, { key: "soonest", label: "Soonest" }, { key: "title", label: "A–Z" }]} />
          <TouchableOpacity onPress={() => update("seasonLayout", list ? "grid" : "list")} style={styles.layoutBtn}
            accessibilityLabel={list ? "Show as grid" : "Show as list"}>
            <Icon name={list ? "browse" : "menu"} size={18} color={C.text} />
          </TouchableOpacity>
        </View>
      </View>
      {items === null ? (
        error ? <VoidmonTrouble what="The season chart" onRetry={retry} navigation={navigation} />
          : list ? <SkeletonList rows={8} /> : <SkeletonGrid columns={cols} rows={3} />
      ) : (
        <FlatList
          data={shown}
          key={list ? "season-list" : `season-${cols}`}
          numColumns={list ? 1 : cols}
          keyExtractor={(it) => String(it.id)}
          contentContainerStyle={{ padding: 6, paddingBottom: 30 }}
          ListEmptyComponent={<Text style={styles.empty}>{loading ? "Loading…" : filters.genre || filters.studio ? "Nothing matches these filters." : "Nothing announced for this season yet."}</Text>}
          ListFooterComponent={loading ? <Text style={[styles.empty, { marginTop: 10 }]}>Loading the rest of the season…</Text> : null}
          renderItem={({ item: it }) => {
            const tracked = lib[`anime:${it.id}`];
            if (list) {
              return (
                <TouchableOpacity onPress={() => openDetail(navigation, it)} style={styles.row}>
                  {it.image ? <Image source={{ uri: it.image }} style={styles.thumb} /> : <View style={[styles.thumb, { backgroundColor: C.border }]} />}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle} numberOfLines={2}>{it.title}</Text>
                    <Text style={styles.rowSub} numberOfLines={1}>{[it.format?.replace("_", " "), it.creator].filter(Boolean).join(" · ")}</Text>
                    <Text style={styles.rowSub} numberOfLines={1}>
                      {it.nextEpisode ? `Ep ${it.nextEpisode.episode} in ${formatCountdown(it.nextEpisode.airingAt)}` : releaseLabel(it)}
                      {hypeLabel(it.popularity) ? `  ·  ${hypeLabel(it.popularity)}` : ""}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => togglePlan(it)} disabled={!!tracked && tracked.status !== "plan"} style={[styles.addSm, tracked && styles.addOn]}>
                    <Text style={[styles.addText, tracked && { color: "#fff" }]} numberOfLines={1}>{tracked ? `✓ ${label(tracked.status)}` : "+ Plan"}</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            }
            return (
              <View style={{ width: `${100 / cols}%`, padding: 6 }}>
                <Card item={it} onPress={() => openDetail(navigation, it)} style={{ margin: 0 }} width="100%" />
                {sort === "hype" && hypeLabel(it.popularity) && <Text style={styles.hype} numberOfLines={1}>{hypeLabel(it.popularity)}</Text>}
                <TouchableOpacity onPress={() => togglePlan(it)} disabled={!!tracked && tracked.status !== "plan"} style={[styles.add, tracked && styles.addOn]}>
                  <Text style={[styles.addText, tracked && { color: "#fff" }]} numberOfLines={1}>
                    {tracked ? `✓ ${label(tracked.status)}` : "+ Plan to Watch"}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const makeStyles = (C) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: { paddingHorizontal: 14, paddingTop: 8, gap: 8 },
  nav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  title: { color: C.text, fontSize: 20, fontWeight: "800" },
  arrow: { width: 40, height: 40, borderRadius: 10, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" },
  arrowText: { color: C.text, fontSize: 22, fontWeight: "700", marginTop: -2 },
  empty: { color: C.faint, textAlign: "center", marginTop: 30 },
  add: { marginTop: 6, borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingVertical: 7, alignItems: "center", backgroundColor: C.card },
  addOn: { backgroundColor: C.purple, borderColor: C.purple },
  addText: { color: C.sub, fontSize: 12, fontWeight: "800" },
  addSm: { borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10, backgroundColor: C.card, maxWidth: 110 },
  layoutBtn: { width: 36, height: 36, borderRadius: 9, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 8, paddingVertical: 8 },
  thumb: { width: 46, height: 64, borderRadius: 6 },
  rowTitle: { color: C.text, fontSize: 14, fontWeight: "700" },
  rowSub: { color: C.faint, fontSize: 11, marginTop: 2 },
  hype: { color: C.orange, fontSize: 11, fontWeight: "700", marginTop: 4 },
});
