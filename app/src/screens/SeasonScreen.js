// SEASON CHART — every anime of a season, grouped by format (TV, ONA, Movies…),
// with countdown badges and one-tap Plan to Watch. ‹ › moves between seasons.
import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "@voidation/shared/backend/AuthContext";
import { getLibrary, setStatus, statusesFor } from "@voidation/shared/backend/store";
import { seasonOf, shiftSeason, seasonTitle, FORMAT_GROUPS, groupOf, fetchSeason } from "@voidation/shared/season";
import Chips from "../components/Chips.js";
import FilterChips from "../components/FilterChips.js";
import { applyFilters } from "@voidation/shared/filters";
import Card from "../components/Card.js";
import { useTheme } from "../context/ThemeContext.js";
import { useGridColumns } from "../lib/layout";
import { openDetail, goBackOrHome } from "../lib/nav";

export default function SeasonScreen({ navigation }) {
  const { C } = useTheme();
  const styles = makeStyles(C);
  const cols = useGridColumns();
  const { user } = useAuth();
  const [season, setSeason] = useState(seasonOf);
  const [items, setItems] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [group, setGroup] = useState("all");
  const [lib, setLib] = useState({});
  const [filters, setFilters] = useState({ genre: "", studio: "" });

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
  }, [season]);

  const counts = useMemo(() => {
    const c = {};
    (items || []).forEach((it) => { const g = groupOf(it); c[g] = (c[g] || 0) + 1; });
    return c;
  }, [items]);
  const groups = [
    { key: "all", label: `All ${items ? items.length : ""}` },
    ...FORMAT_GROUPS.filter((g) => counts[g.key]).map((g) => ({ key: g.key, label: `${g.label} ${counts[g.key]}` })),
  ];
  const shown = applyFilters((items || []).filter((it) => group === "all" || groupOf(it) === group), filters);
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
          <Text style={styles.title}>{seasonTitle(season)}</Text>
          <TouchableOpacity style={styles.arrow} onPress={() => { setGroup("all"); setSeason((s) => shiftSeason(s, 1)); }} accessibilityLabel="Next season">
            <Text style={styles.arrowText}>›</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={{ paddingHorizontal: 14 }}>
        <Chips options={groups} value={group} onChange={setGroup} />
        <FilterChips items={items} value={filters} onChange={setFilters} style={{ marginTop: 6 }} />
      </View>
      {items === null ? (
        <View style={{ padding: 40, alignItems: "center" }}>
          {error ? <Text style={styles.empty}>Couldn't load this season. Check your connection.</Text> : <ActivityIndicator color={C.orange} />}
        </View>
      ) : (
        <FlatList
          data={shown}
          key={`season-${cols}`}
          numColumns={cols}
          keyExtractor={(it) => String(it.id)}
          contentContainerStyle={{ padding: 6, paddingBottom: 30 }}
          ListEmptyComponent={<Text style={styles.empty}>{loading ? "Loading…" : filters.genre || filters.studio ? "Nothing matches these filters." : "Nothing announced for this season yet."}</Text>}
          ListFooterComponent={loading ? <Text style={[styles.empty, { marginTop: 10 }]}>Loading the rest of the season…</Text> : null}
          renderItem={({ item: it }) => {
            const tracked = lib[`anime:${it.id}`];
            return (
              <View style={{ width: `${100 / cols}%`, padding: 6 }}>
                <Card item={it} onPress={() => openDetail(navigation, it)} style={{ margin: 0 }} width="100%" />
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
});
