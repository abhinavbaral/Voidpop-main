// HISTORY — episodes that have already aired (last 14 days), newest first, for
// the anime you follow: Watching, Plan to Watch, On Hold, or Excited.
// Schedule looks forward; History looks back. Same logic as the website.
// Each episode can be marked watched right here; watched ones get a tick.

import { useCallback, useMemo, useState } from "react";
import { ScrollView, View, Text, Image, TouchableOpacity, StyleSheet, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { fetchRecentEpisodes } from "@voidpop/shared/api/anilist";
import { getLibrary, getExcited, setProgress, setStatus, addReview } from "@voidpop/shared/backend/store";
import { useAuth } from "@voidpop/shared/backend/AuthContext";
import VerdictModal from "../../components/title/VerdictModal.js";
import { dayLabel, airedAgo } from "@voidpop/shared/lib/format";
import { useNow } from "@voidpop/shared/lib/useNow";
import { useTheme } from "../../context/ThemeContext.js";
import { openDetail } from "../../utils/nav";
import { SkeletonList } from "../../components/ui/Skeleton.js";
import { VoidmonEmpty, VoidmonTrouble } from "../../components/brand/Voidmon.js";

const FOLLOWING = { watching: "Watching", plan: "Plan to Watch", onhold: "On Hold" };
const DAYS = 14;

export default function HistoryScreen({ navigation }) {
  const { C } = useTheme();
  const styles = makeStyles(C);
  const now = useNow(60000);
  const [episodes, setEpisodes] = useState(null);
  const [labels, setLabels] = useState({});
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [progress, setProgressMap] = useState({}); // anime id -> episodes watched
  const [finishing, setFinishing] = useState(null);
  const { user } = useAuth();

  const readProgress = useCallback(async () => {
    const map = {};
    Object.values(await getLibrary()).forEach((e) => { if (e.item.segment === "anime") map[e.item.id] = e.progress || 0; });
    setProgressMap(map);
  }, []);

  // marking episode 7 watched means you've watched 1–7
  const markWatched = async (s) => {
    const r = await setProgress(user, s.item, Math.max(progress[s.item.id] || 0, s.episode), "history");
    if (r.reachedEnd) setFinishing(s.item);
    readProgress();
  };
  const finish = async ({ verdict, vibes, moods, comment }) => {
    await setStatus(user, finishing.segment, finishing, "completed");
    await addReview(user, finishing.segment, finishing.id, { verdict, vibes, moods, comment });
    setFinishing(null);
    readProgress();
  };

  const load = useCallback(async () => {
    setError(false);
    readProgress();
    const [lib, excited] = await Promise.all([getLibrary(), getExcited()]);
    const next = {};
    Object.values(lib)
      .filter((e) => e.item.segment === "anime" && FOLLOWING[e.status])
      .forEach((e) => { next[e.item.id] = FOLLOWING[e.status]; });
    Object.values(excited)
      .filter((e) => e.item.segment === "anime")
      .forEach((e) => { next[e.item.id] = next[e.item.id] || "Excited"; });
    setLabels(next);
    try {
      setEpisodes(await fetchRecentEpisodes(Object.keys(next), DAYS));
    } catch {
      setEpisodes([]);
      setError(true);
    }
  }, [readProgress]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const days = useMemo(() => {
    const groups = [];
    (episodes || []).forEach((s) => {
      const label = dayLabel(s.airingAt, now);
      const last = groups[groups.length - 1];
      if (last && last.label === label) last.items.push(s);
      else groups.push({ label, items: [s] });
    });
    return groups;
  }, [episodes, Math.floor(now / 3600000)]); // eslint-disable-line react-hooks/exhaustive-deps

  const following = Object.keys(labels).length;
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 30 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.purple} />}
      >
        <Text style={styles.title}>History</Text>
        <Text style={styles.sub}>Episodes from the last {DAYS} days for the anime you follow.</Text>
        {episodes === null ? (
          <SkeletonList rows={6} style={{ paddingHorizontal: 0 }} />
        ) : error ? (
          <VoidmonTrouble what="History" onRetry={load} navigation={navigation} />
        ) : !following ? (
          <VoidmonEmpty pose="peeking" text="Nothing to show yet. Mark anime as Watching, Plan to Watch, On Hold or Excited and their new episodes collect here.">
            <TouchableOpacity onPress={() => navigation.navigate("Main", { screen: "Schedule" })} accessibilityRole="button"
              style={{ marginTop: 14, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9, borderWidth: 1, borderColor: C.border, backgroundColor: C.card }}>
              <Text style={{ color: C.text, fontWeight: "800" }}>See what's airing</Text>
            </TouchableOpacity>
          </VoidmonEmpty>
        ) : !days.length ? (
          <VoidmonEmpty pose="sleeping" text={`No new episodes in the last ${DAYS} days for the shows you follow.`} />
        ) : (
          days.map((g) => (
            <View key={g.label}>
              <Text style={styles.day}>{g.label}</Text>
              {g.items.map((s) => (
                <TouchableOpacity key={`${s.item.id}-${s.episode}`} style={styles.row} onPress={() => openDetail(navigation, s.item)}>
                  {s.item.image ? <Image source={{ uri: s.item.image }} style={styles.thumb} /> : <View style={styles.thumb} />}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle} numberOfLines={2}>{s.item.title}</Text>
                    <Text style={styles.rowSub}>
                      Episode {s.episode} · {airedAgo(s.airingAt, now)} · {labels[s.item.id]}
                    </Text>
                  </View>
                  {(progress[s.item.id] || 0) >= s.episode ? (
                    <Text style={styles.watched}>Watched ✓</Text>
                  ) : (
                    <TouchableOpacity onPress={() => markWatched(s)} style={styles.markBtn} hitSlop={6}>
                      <Text style={styles.markText}>Mark watched</Text>
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          ))
        )}
      </ScrollView>
      {finishing && (
        <VerdictModal visible initial={null} onSave={finish} onClose={() => { setFinishing(null); readProgress(); }} />
      )}
    </SafeAreaView>
  );
}

const makeStyles = (C) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  title: { color: C.text, fontSize: 20, fontWeight: "800", paddingHorizontal: 14, paddingTop: 8 },
  sub: { color: C.faint, fontSize: 12, paddingHorizontal: 14, marginTop: 4 },
  error: { color: C.rose, fontSize: 12, paddingHorizontal: 14, marginTop: 8 },
  empty: { color: C.faint, fontSize: 13, paddingHorizontal: 14, marginTop: 20, lineHeight: 19 },
  day: {
    color: C.sub, fontSize: 12, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase",
    paddingHorizontal: 14, marginTop: 18, marginBottom: 2,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 7 },
  thumb: { width: 40, height: 56, borderRadius: 6, backgroundColor: C.border },
  rowTitle: { color: C.text, fontSize: 13, fontWeight: "700" },
  rowSub: { color: C.faint, fontSize: 11, marginTop: 2 },
  watched: { color: C.green || "#10b981", fontSize: 11, fontWeight: "800" },
  markBtn: { borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 6 },
  markText: { color: C.sub, fontSize: 11, fontWeight: "800" },
  tag: {
    color: C.sub, fontSize: 10, fontWeight: "700", borderWidth: 1, borderColor: C.border,
    borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3, overflow: "hidden",
  },
});
