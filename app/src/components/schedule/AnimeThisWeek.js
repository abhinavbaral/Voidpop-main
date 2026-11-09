// ANIME THIS WEEK (inside the Schedule tab) — every episode of this calendar week, Monday to Sunday: today and the
// days to come first (a countdown on today's), then "Earlier this week" (folded away until you open it) for what
// already aired. Aired episodes say whether you've watched them. On top, "Aired earlier": shows you're Watching
// with episodes from before this week that you still haven't watched; they stay until you watch them.
// Drawn inside Schedule's scroll view; refreshKey changes when Schedule is pulled to refresh.
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet } from "react-native";
import { loadAnimeThisWeek, dayKey } from "@voidpop/shared/features/upcoming";
import { buildAnimeWeek } from "@voidpop/shared/features/animeWeek";
import { getLibrary, getExcited, toggleExcited, onDataChange } from "@voidpop/shared/backend/store";
import { useAuth } from "@voidpop/shared/backend/AuthContext";
import { useNow } from "@voidpop/shared/lib/useNow";
import { useSettings } from "@voidpop/shared/backend/SettingsContext";
import { formatCountdown, airTime } from "@voidpop/shared/lib/format";
import { useTheme } from "../../context/ThemeContext.js";
import { openDetail } from "../../utils/nav";
import { SkeletonList } from "../ui/Skeleton.js";

const dayLabel = (d) => {
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  if (d.isToday) return "Today";
  if (d.key === dayKey(tomorrow)) return "Tomorrow";
  return d.date.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" });
};

// memo: only today's rows get a `now` (for their countdown), so the other rows don't redraw every second
const Row = memo(function Row({ r, now, clock24, excited, onOpen, onExcite, C, styles }) {
  const { item } = r;
  const premiere = r.episode === 1 && !r.aired;
  const on = !!excited[`anime:${item.id}`];
  const sub = [`Episode ${r.episode}${item.episodes ? ` of ${item.episodes}` : ""}`, item.format?.replace("_", " ")].filter(Boolean).join(" · ");
  return (
    <TouchableOpacity style={styles.row} onPress={() => onOpen(item)} accessibilityRole="button">
      <Text style={styles.time}>{airTime(r.airingAt, clock24)}</Text>
      {item.image ? <Image source={{ uri: item.image }} style={styles.thumb} /> : <View style={styles.thumb} />}
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.rowSub} numberOfLines={1}>{sub}</Text>
        {!r.aired && now != null && <Text style={styles.countdown}>{formatCountdown(r.airingAt, now)}</Text>}
        {r.watched && <Text style={[styles.state, { color: C.green }]}>Watched ✓</Text>}
        {r.aired && !r.watched && (
          r.entry && r.entry.status === "watching"
            ? <Text style={[styles.state, { color: C.orange }]}>Aired · not watched yet</Text>
            : <Text style={[styles.state, { color: C.faint }]}>Aired</Text>
        )}
      </View>
      {premiere && (
        <TouchableOpacity onPress={() => onExcite(item)} style={[styles.excite, on && { backgroundColor: C.orange }]} accessibilityRole="button">
          <Text style={{ fontSize: 11, fontWeight: "800", color: on ? "#fff" : C.orange }}>{on ? "Excited ✓" : "Excited?"}</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
});

export default function AnimeThisWeek({ navigation, refreshKey = 0 }) {
  const { C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const { user } = useAuth();
  const now = useNow(1000);
  const { clock24 } = useSettings().settings;
  const [episodes, setEpisodes] = useState(null); // null while loading
  const [lib, setLib] = useState({});
  const [excited, setExcited] = useState({});
  const [showPast, setShowPast] = useState(false);

  const readMine = useCallback(() => {
    getLibrary(user).then(setLib).catch(() => {});
    getExcited(user).then(setExcited).catch(() => {});
  }, [user]);
  useEffect(() => { loadAnimeThisWeek().then(setEpisodes).catch(() => setEpisodes([])); }, [refreshKey]);
  useEffect(() => { readMine(); }, [readMine, refreshKey]);
  useEffect(() => onDataChange(readMine), [readMine]);

  const minute = Math.floor(now / 60000);
  const week = useMemo(() => (episodes ? buildAnimeWeek(episodes, lib, minute * 60000) : null), [episodes, lib, minute]);
  const open = useCallback((it) => openDetail(navigation, it), [navigation]);
  const excite = useCallback(async (item) => { await toggleExcited(user, item); setExcited(await getExcited(user)); }, [user]);

  if (!week) return <SkeletonList rows={4} />;
  const row = (r, isToday) => (
    <Row key={`${r.item.id}-${r.episode}`} r={r} now={isToday ? now : null} clock24={clock24} excited={excited}
      onOpen={open} onExcite={excite} C={C} styles={styles} />
  );
  const pastCount = week.past.reduce((n, d) => n + d.rows.length, 0);

  return (
    <View>
      {week.earlier.length > 0 && (
        <>
          <Text style={styles.day}>Aired earlier · not watched yet</Text>
          {week.earlier.map(({ item, earlier }) => (
            <TouchableOpacity key={item.id} style={styles.row} onPress={() => open(item)} accessibilityRole="button">
              {item.image ? <Image source={{ uri: item.image }} style={styles.thumb} /> : <View style={styles.thumb} />}
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle} numberOfLines={2}>{item.title}</Text>
                <Text style={[styles.state, { color: C.orange }]}>{earlier} episode{earlier === 1 ? "" : "s"} from before this week</Text>
              </View>
            </TouchableOpacity>
          ))}
        </>
      )}

      {week.total === 0 && week.earlier.length === 0 && <Text style={styles.empty}>No episodes found for this week. Pull down to retry.</Text>}

      {week.upcoming.map((d) => (
        <View key={d.key}>
          <Text style={[styles.day, d.isToday && { color: C.orange }]}>{dayLabel(d)}</Text>
          {d.rows.map((r) => row(r, d.isToday))}
        </View>
      ))}

      {pastCount > 0 && (
        <>
          <TouchableOpacity onPress={() => setShowPast((v) => !v)} style={styles.fold} accessibilityRole="button" accessibilityState={{ expanded: showPast }}>
            <Text style={styles.foldText}>{showPast ? "Hide" : "Show"} earlier this week · {pastCount} episode{pastCount === 1 ? "" : "s"}</Text>
          </TouchableOpacity>
          {showPast && week.past.map((d) => (
            <View key={d.key}>
              <Text style={styles.day}>{dayLabel(d)}</Text>
              {d.rows.map((r) => row(r, false))}
            </View>
          ))}
        </>
      )}
    </View>
  );
}

const makeStyles = (C) => StyleSheet.create({
  day: {
    color: C.sub, fontSize: 12, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase",
    paddingHorizontal: 14, marginTop: 16, marginBottom: 2,
  },
  empty: { color: C.faint, fontSize: 13, paddingHorizontal: 14, marginTop: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 7 },
  time: { color: C.text, fontSize: 13, fontWeight: "900", width: 58, fontVariant: ["tabular-nums"] },
  thumb: { width: 40, height: 56, borderRadius: 6, backgroundColor: C.border },
  rowTitle: { color: C.text, fontSize: 13, fontWeight: "700" },
  rowSub: { color: C.faint, fontSize: 11, marginTop: 2 },
  countdown: { color: C.purple, fontWeight: "800", fontSize: 12, marginTop: 3, fontVariant: ["tabular-nums"] },
  state: { fontSize: 11, fontWeight: "800", marginTop: 3 },
  excite: { borderWidth: 1, borderColor: C.orange, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  fold: { marginHorizontal: 14, marginTop: 18, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: C.border, alignItems: "center" },
  foldText: { color: C.sub, fontSize: 12, fontWeight: "800" },
});
