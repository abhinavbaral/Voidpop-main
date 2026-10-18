// HISTORY — laid out like YouTube's watch history: a big title, a search bar, filter chips,
// a section for each day, and wide rows with a thumbnail, a badge and a progress bar.
//   - Watched: the episodes/chapters you marked (from your watch log), one row per title per day,
//     and titles you Completed or Dropped.
//   - To watch: episodes that aired in the last 14 days for the anime you follow (Watching, Plan to
//     Watch, On Hold, Excited) that you haven't watched yet. "Mark watched" is in the ⋮ menu.
//   - Swipe a row left (or ⋮ › Remove) to take it out of History. This only hides it here:
//     your progress, stats and streaks are not touched. ⋮ at the top clears or restores.
// Works offline for what you've watched; only "To watch" needs AniList.

import { useCallback, useMemo, useState } from "react";
import { View, Text, SectionList, ScrollView, TextInput, TouchableOpacity, Pressable, StyleSheet, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { fetchRecentEpisodes } from "@voidpop/shared/api/anilist";
import { readKey, writeKey } from "@voidpop/shared/backend/storage";
import { getLibrary, getExcited, getLog, setProgress, setStatus, addReview } from "@voidpop/shared/backend/store";
import { buildHistory, historyText, HISTORY_FILTERS } from "@voidpop/shared/features/history";
import { useAuth } from "@voidpop/shared/backend/AuthContext";
import VerdictModal from "../../components/title/VerdictModal.js";
import { airedAgo } from "@voidpop/shared/lib/format";
import { useNow } from "@voidpop/shared/lib/useNow";
import { useTheme } from "../../context/ThemeContext.js";
import { openDetail } from "../../utils/nav";
import { SkeletonList } from "../../components/ui/Skeleton.js";
import Icon from "../../components/ui/Icon.js";
import OptionsSheet from "../../components/ui/OptionsSheet.js";
import HistoryRow from "../../components/history/HistoryRow.js";
import { VoidmonEmpty } from "../../components/brand/Voidmon.js";

const FOLLOWING = { watching: "Watching", plan: "Plan to Watch", onhold: "On Hold" };
const DAYS = 14;
const HIDDEN_KEY = "voidation:history:hidden:v1"; // ids you removed from History (hidden only: nothing is deleted)

export default function HistoryScreen({ navigation }) {
  const { C } = useTheme();
  const styles = makeStyles(C);
  const now = useNow(60000);
  const { user } = useAuth();
  const [library, setLibrary] = useState({});
  const [log, setLog] = useState([]);
  const [aired, setAired] = useState([]);
  const [labels, setLabels] = useState({});
  const [progress, setProgressMap] = useState({}); // anime id → episodes watched
  const [hidden, setHidden] = useState(new Set());
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [sheet, setSheet] = useState(null); // a row's item | "top"
  const [finishing, setFinishing] = useState(null);

  const load = useCallback(async () => {
    const [lib, excited, entries] = await Promise.all([getLibrary(), getExcited(), getLog()]);
    setLibrary(lib);
    setLog(entries);
    const prog = {};
    const next = {};
    Object.values(lib).filter((e) => e.item.segment === "anime").forEach((e) => {
      prog[e.item.id] = e.progress || 0;
      if (FOLLOWING[e.status]) next[e.item.id] = FOLLOWING[e.status];
    });
    Object.values(excited).filter((e) => e.item.segment === "anime").forEach((e) => { next[e.item.id] = next[e.item.id] || "Excited"; });
    setProgressMap(prog);
    setLabels(next);
    try { setHidden(new Set(JSON.parse((await readKey(HIDDEN_KEY)) || "[]"))); } catch { /* none removed */ }
    setLoading(false); // what you've watched is on screen now; "to watch" follows
    try {
      setAired(await fetchRecentEpisodes(Object.keys(next), DAYS));
      setOffline(false);
    } catch {
      setAired([]);
      setOffline(true);
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const sections = useMemo(
    () => buildHistory({ log, library, aired, labels, progress, hidden, filter, query, now }),
    [log, library, aired, labels, progress, hidden, filter, query, Math.floor(now / 60000)] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const everything = useMemo( // for "Clear all history": every row, whatever the filter or search
    () => buildHistory({ log, library, aired, labels, progress, hidden, now }).flatMap((s) => s.data),
    [log, library, aired, labels, progress, hidden, Math.floor(now / 60000)] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const hide = async (ids) => {
    const next = new Set([...hidden, ...ids]);
    setHidden(next);
    writeKey(HIDDEN_KEY, JSON.stringify([...next].slice(-2000))).catch(() => {});
  };
  const restore = () => { setHidden(new Set()); writeKey(HIDDEN_KEY, "[]").catch(() => {}); };

  // marking episode 7 watched means you've watched 1–7
  const markWatched = async (x) => {
    const r = await setProgress(user, x.item, Math.max(progress[x.item.id] || 0, x.episode), "history");
    if (r.reachedEnd) setFinishing(x.item);
    load();
  };
  const finish = async ({ verdict, vibes, moods, comment }) => {
    await setStatus(user, finishing.segment, finishing, "completed");
    await addReview(user, finishing.segment, finishing.id, { verdict, vibes, moods, comment });
    setFinishing(null);
    load();
  };

  const lines = (x) => {
    const t = historyText(x);
    const when = x.type === "aired" ? airedAgo(Math.floor(x.at / 1000), now) : new Date(x.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    return [`${t.line1} · ${when}`, t.line2];
  };
  const badge = (x) => (x.type === "aired" ? `EP ${x.episode}` : x.type === "status" ? (x.status === "completed" ? "DONE" : "DROPPED") : `+${x.count}`);
  const rowOptions = (x) => [
    ...(x.type === "aired" ? [{ key: "watch", label: "Mark watched" }] : []),
    { key: "open", label: "Open title" },
    { key: "remove", label: "Remove from history", danger: true },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.top}>
        <Text style={styles.title} accessibilityRole="header">History</Text>
        <TouchableOpacity onPress={() => setSheet("top")} hitSlop={12} accessibilityRole="button" accessibilityLabel="History options">
          <View style={{ gap: 4, alignItems: "center", padding: 6 }}>{[0, 1, 2].map((i) => <View key={i} style={styles.dot} />)}</View>
        </TouchableOpacity>
      </View>

      <View style={styles.search}>
        <Icon name="search" size={20} color={C.faint} />
        <TextInput value={query} onChangeText={setQuery} placeholder="Search history" placeholderTextColor={C.faint} returnKeyType="search"
          style={styles.input} accessibilityLabel="Search history" />
        {!!query && <TouchableOpacity onPress={() => setQuery("")} hitSlop={10} accessibilityLabel="Clear search"><Icon name="close" size={18} color={C.faint} /></TouchableOpacity>}
      </View>

      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {HISTORY_FILTERS.map((f) => {
            const on = filter === f.key;
            return (
              <Pressable key={f.key} onPress={() => setFilter(f.key)} accessibilityRole="button" accessibilityState={{ selected: on }}
                style={[styles.chip, on && { backgroundColor: C.text }]}>
                <Text style={[styles.chipText, on && { color: C.bg }]}>{f.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
      {offline && <Text style={styles.note}>Couldn't check for new episodes. Showing what you've watched.</Text>}

      {loading ? (
        <SkeletonList rows={6} style={{ paddingHorizontal: 14 }} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(x) => x.id}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ paddingBottom: 30 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.purple} colors={[C.purple]} />}
          renderSectionHeader={({ section }) => <Text style={styles.day}>{section.label}</Text>}
          renderItem={({ item: x }) => (
            <HistoryRow x={x} lines={lines(x)} badge={badge(x)} onOpen={() => openDetail(navigation, x.item)} onMenu={() => setSheet(x)} onRemove={() => hide([x.id])} />
          )}
          ListEmptyComponent={
            <VoidmonEmpty pose={query ? "peeking" : "sleeping"}
              text={query ? `Nothing in your history matches "${query.trim()}".`
                : filter === "towatch" ? "You're all caught up. New episodes of the shows you follow show up here."
                  : "Nothing in your history yet. Mark an episode watched and it shows up here."} />
          }
        />
      )}

      <OptionsSheet
        visible={!!sheet && sheet !== "top"}
        title={sheet && sheet !== "top" ? sheet.item.title : ""}
        options={sheet && sheet !== "top" ? rowOptions(sheet) : []}
        onPick={(k) => {
          const x = sheet;
          setSheet(null);
          if (k === "watch") markWatched(x); else if (k === "open") openDetail(navigation, x.item); else hide([x.id]);
        }}
        onClose={() => setSheet(null)}
      />
      <OptionsSheet
        visible={sheet === "top"}
        title="History"
        options={[
          ...(everything.length ? [{ key: "clear", label: "Clear all history", danger: true }] : []),
          ...(hidden.size ? [{ key: "restore", label: `Show the ${hidden.size} removed again` }] : []),
          { key: "close", label: "Close" },
        ]}
        onPick={(k) => { setSheet(null); if (k === "clear") hide(everything.map((x) => x.id)); else if (k === "restore") restore(); }}
        onClose={() => setSheet(null)}
      />
      {finishing && <VerdictModal visible initial={null} onSave={finish} onClose={() => { setFinishing(null); load(); }} />}
    </SafeAreaView>
  );
}

const makeStyles = (C) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingTop: 6 },
  title: { color: C.text, fontSize: 32, fontWeight: "900" },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: C.text },
  search: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12, marginHorizontal: 14, paddingHorizontal: 12, height: 44, borderRadius: 10, backgroundColor: C.card },
  input: { flex: 1, color: C.text, fontSize: 15, paddingVertical: 0 },
  chips: { gap: 8, paddingHorizontal: 14, paddingVertical: 12 },
  chip: { height: 34, paddingHorizontal: 14, borderRadius: 8, backgroundColor: C.card, alignItems: "center", justifyContent: "center" },
  chipText: { color: C.text, fontWeight: "700", fontSize: 14 },
  note: { color: C.faint, fontSize: 12, paddingHorizontal: 14, marginBottom: 4 },
  day: { color: C.text, fontSize: 20, fontWeight: "900", paddingHorizontal: 14, paddingTop: 14, paddingBottom: 6 },
});
