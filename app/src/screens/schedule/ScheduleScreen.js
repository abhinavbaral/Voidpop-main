// SCHEDULE — when does the next episode drop? (same as the website)
//   Pending:         the aired episodes you haven't watched yet (+1); the tab is hidden while there are none
//   Anime this week: every episode of this calendar week, plus aired ones you still haven't watched

import { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, View, Text, TouchableOpacity, StyleSheet, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { fetchNextEpisodes } from "@voidpop/shared/api/anilist";
import { useAuth } from "@voidpop/shared/backend/AuthContext";
import { getLibrary, noteAiring, yourShows, onDataChange } from "@voidpop/shared/backend/store";
import { useNow } from "@voidpop/shared/lib/useNow";
import { useTheme } from "../../context/ThemeContext.js";
import { openDetail } from "../../utils/nav";
import YourShows from "../../components/library/YourShows.js";
import AnimeThisWeek from "../../components/schedule/AnimeThisWeek.js";

const FOLLOWING = new Set(["watching", "plan", "onhold"]);

export default function ScheduleScreen({ navigation }) {
  const { C } = useTheme();
  const styles = makeStyles(C);
  const { user } = useAuth();
  const now = useNow(1000);
  // the Schedule tab's two views: Pending (only while something is pending) and Anime this week
  const [view, setView] = useState("pending");
  const [snap, setSnap] = useState({ lib: {}, fresh: {} }); // what the pending count is worked out from
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [fetched, setFetched] = useState(0); // bumps after fresh air times are saved

  const load = useCallback(async () => {
    setError(false);
    const saved = await getLibrary(user);
    setSnap((s) => ({ ...s, lib: saved })); // the saved copy already says what's pending; fresh air times refine it
    const following = Object.values(saved).filter((e) => e.item.segment === "anime" && FOLLOWING.has(e.status));
    const fresh = await fetchNextEpisodes(following.map((e) => e.item.id)).catch(() => { setError(true); return {}; });
    // compare with the saved times to spot delays
    await noteAiring(fresh);
    setSnap({ lib: await getLibrary(user), fresh });
    setFetched((n) => n + 1);
  }, [user]);
  // +1 on a pending show, or any other change to your library: recount
  useEffect(() => onDataChange(() => { getLibrary(user).then((lib) => setSnap((s) => ({ ...s, lib }))).catch(() => {}); }), [user]);

  const minute = Math.floor(now / 60000);
  const pendingCount = useMemo(
    () => yourShows(snap.lib, snap.fresh, minute * 60000).filter((x) => x.pending > 0).length,
    [snap, minute],
  );
  const hasPending = pendingCount > 0;
  const active = hasPending ? view : "week"; // no pending: the Pending tab is gone and so is the tab bar

  // reload whenever the tab is opened: you may have just tracked something
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 30 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.purple} />}
      >
        <View style={styles.titleRow}>
          <Text style={styles.title}>Schedule</Text>
          <TouchableOpacity onPress={() => navigation.navigate("Season")} style={styles.chip}>
            <Text style={styles.chipText}>Season chart →</Text>
          </TouchableOpacity>
        </View>
        {error && (
          <Text style={styles.error}>Couldn't load the latest airing times. Pull down to retry.</Text>
        )}

        {hasPending ? (
          <View style={styles.viewTabs}>
            {[["pending", "Pending"], ["week", "Anime this week"]].map(([k, label]) => (
              <TouchableOpacity key={k} onPress={() => setView(k)} style={[styles.viewTab, active === k && styles.viewTabOn]}>
                <Text style={[styles.viewTabText, active === k && { color: "#fff" }]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <Text style={styles.section} accessibilityRole="header">Anime this week</Text>
        )}

        {active === "pending" && (
          <YourShows now={now} refreshKey={fetched} title="Pending" onlyPending onOpen={(it) => openDetail(navigation, it)} />
        )}
        {active === "week" && <AnimeThisWeek navigation={navigation} refreshKey={fetched} />}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (C) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  title: { color: C.text, fontSize: 20, fontWeight: "800" },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingTop: 8 },
  error: { color: C.rose, fontSize: 12, paddingHorizontal: 14, marginTop: 8 },
  section: { color: C.text, fontWeight: "800", fontSize: 15, paddingHorizontal: 14, marginTop: 20, marginBottom: 8 },
  empty: { color: C.faint, fontSize: 13, paddingHorizontal: 14, lineHeight: 19 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 7 },
  thumb: { width: 44, height: 62, borderRadius: 6, backgroundColor: C.border },
  thumbSm: { width: 36, height: 50, borderRadius: 6, backgroundColor: C.border },
  rowTitle: { color: C.text, fontSize: 13, fontWeight: "700" },
  rowSub: { color: C.faint, fontSize: 11, marginTop: 2 },
  countdown: {
    color: C.purple, fontWeight: "800", fontSize: 15, fontVariant: ["tabular-nums"],
    backgroundColor: C.card, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5, overflow: "hidden",
  },
  soon: { color: C.orange },
  delayed: { color: C.rose, fontSize: 11, fontWeight: "800", marginTop: 2 },
  countdownSm: { color: C.purple, fontWeight: "800", fontSize: 12, fontVariant: ["tabular-nums"] },
  viewTabs: {
    flexDirection: "row", gap: 4, marginHorizontal: 14, marginTop: 12, padding: 4,
    backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.border,
  },
  viewTab: { flex: 1, borderRadius: 9, paddingVertical: 9, alignItems: "center" },
  viewTabOn: { backgroundColor: C.purple },
  viewTabText: { color: C.text, fontWeight: "800", fontSize: 14 },
  weekHead: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 14, marginTop: 22, marginBottom: 4,
  },
  chip: { borderWidth: 1, borderColor: C.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  chipOn: { backgroundColor: C.purple, borderColor: C.purple },
  chipText: { color: C.sub, fontSize: 12, fontWeight: "700" },
  day: {
    color: C.sub, fontSize: 12, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase",
    paddingHorizontal: 14, marginTop: 14, marginBottom: 2,
  },
  time: { color: C.sub, fontSize: 11, fontWeight: "700", width: 58, fontVariant: ["tabular-nums"] },
  excite: { borderWidth: 1, borderColor: C.orange, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  excited: { backgroundColor: C.orange },
});
