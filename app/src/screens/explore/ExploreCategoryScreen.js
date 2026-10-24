// One Explore tile opened: its shows as a poster grid, with a Reroll button for new
// ones (not on the fixed lists). Pulling down does the same as Reroll. The titles never
// change; only the shows do. A list is never empty: it tops itself up or shows what it
// showed last time.
import { useMemo, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useExplore, reroll, loadTrend, initExplore } from "../../state/explore";
import { viewTile, COMING_KINDS } from "@voidpop/shared/features/exploreTiles";
import { useTheme } from "../../context/ThemeContext.js";
import { openDetail, goBackOrHome } from "../../utils/nav";
import Card from "../../components/ui/Card.js";
import Icon from "../../components/ui/Icon.js";
import Chips from "../../components/ui/Chips.js";
import Skeleton from "../../components/ui/Skeleton.js";
import { COUNTRIES } from "./TrendsScreen.js";

export default function ExploreCategoryScreen({ navigation, route }) {
  const { C } = useTheme();
  const styles = makeStyles(C);
  const key = route.params.key;
  const ex = useExplore();
  const [comingKind, setComingKind] = useState("all"); // Coming soon: All / Anime / Manga / Novels / Movies / TV
  const v = useMemo(() => viewTile(key, key === "coming" ? { ...ex, comingKind } : ex), [key, ex, comingKind]);
  const busy = !!ex.busy[key];
  const [refreshing, setRefreshing] = useState(false);
  // pull down: new shows if this list can be rerolled, otherwise just reload it
  const refresh = async () => {
    setRefreshing(true);
    try { if (v.reroll) await reroll(key); else if (key === "trending") await loadTrend(); else await initExplore(); } catch { /* offline: keep what's shown */ }
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={[styles.head, { backgroundColor: v.color }]}>
        <TouchableOpacity onPress={() => goBackOrHome(navigation)} hitSlop={12} accessibilityLabel="Back"><Icon name="back" size={22} color="#fff" /></TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} accessibilityRole="header" numberOfLines={2}>{v.title}</Text>
          {v.subtitle ? <Text style={styles.sub}>{v.subtitle}</Text> : null}
        </View>
        {v.reroll && (
          <TouchableOpacity onPress={() => reroll(key)} disabled={busy} style={[styles.reroll, busy && { opacity: 0.5 }]} accessibilityRole="button"
            accessibilityLabel={busy ? "Finding new shows" : `Reroll ${v.title}`} accessibilityHint="Shows a new set of titles">
            <Icon name="shuffle" size={16} color="#fff" />
            <Text style={styles.rerollText}>{busy ? "…" : "Reroll"}</Text>
          </TouchableOpacity>
        )}
      </View>

      {key === "coming" && (
        <View style={{ paddingHorizontal: 14, paddingTop: 10 }}>
          <Chips value={comingKind} onChange={setComingKind} options={COMING_KINDS} />
        </View>
      )}

      {key === "trending" && (
        <View style={{ paddingHorizontal: 14, paddingTop: 10 }}>
          <Chips value={ex.country} onChange={loadTrend} options={COUNTRIES.filter((c) => c.key)} />
        </View>
      )}

      {v.loading ? (
        <View style={styles.skeletons}>{Array.from({ length: 9 }, (_, i) => <Skeleton key={i} width="30%" height={190} style={{ margin: "1.5%" }} />)}</View>
      ) : !v.items?.length ? (
        <Text style={styles.empty}>{v.empty}</Text>
      ) : (
        <FlatList
          data={v.items}
          numColumns={3}
          keyExtractor={(it) => `${it.segment}-${it.id}`}
          contentContainerStyle={{ padding: 8, paddingBottom: 30 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.purple} colors={[C.purple]} />}
          renderItem={({ item }) => <Card columns={3} item={item} onPress={() => openDetail(navigation, item)} />}
          ListFooterComponent={key === "loved" ? (
            <TouchableOpacity onPress={() => navigation.navigate("Browse", { sort: "loved" })} accessibilityRole="button"><Text style={styles.more}>See more in Browse ›</Text></TouchableOpacity>
          ) : key === "trending" ? (
            <TouchableOpacity onPress={() => navigation.navigate("Trends", { country: ex.country })} accessibilityRole="button"><Text style={styles.more}>See more in Trends ›</Text></TouchableOpacity>
          ) : null}
        />
      )}
    </SafeAreaView>
  );
}

const makeStyles = (C) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  head: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 14 },
  title: { color: "#fff", fontSize: 20, fontWeight: "900" },
  sub: { color: "rgba(255,255,255,0.85)", fontSize: 12, marginTop: 2 },
  reroll: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1.5, borderColor: "#fff", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  rerollText: { color: "#fff", fontWeight: "800", fontSize: 13 },
  skeletons: { flexDirection: "row", flexWrap: "wrap", padding: 8 },
  empty: { color: C.faint, fontSize: 14, lineHeight: 21, textAlign: "center", margin: 30 },
  more: { color: C.purple, fontWeight: "800", fontSize: 14, textAlign: "center", padding: 16 },
});
