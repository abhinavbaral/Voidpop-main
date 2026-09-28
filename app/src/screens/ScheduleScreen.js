// SCHEDULE — when does the next episode drop? (same sections as the website)
//   1. Your next episodes: airing anime in your library, soonest first, live countdown
//   2. This week: everything airing in the next 7 days, grouped by day
//   3. Upcoming anime: not started yet — mark yourself Excited

import { useCallback, useMemo, useState } from "react";
import {
  ScrollView, View, Text, Image, TouchableOpacity, StyleSheet, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { fetchAiringSchedule, fetchAniList, fetchNextEpisodes } from "@voidation/shared/api/anilist";
import { useAuth } from "@voidation/shared/backend/AuthContext";
import { getLibrary, getExcited, toggleExcited, noteAiring } from "@voidation/shared/backend/store";
import { formatCountdown, dayLabel, airTime, releaseLabel, secondsUntil } from "@voidation/shared/format";
import { useNow } from "@voidation/shared/hooks/useNow";
import { useSettings } from "@voidation/shared/backend/SettingsContext";
import { useTheme } from "../context/ThemeContext.js";
import { openDetail } from "../lib/nav";

const FOLLOWING = new Set(["watching", "plan", "onhold"]);

export default function ScheduleScreen({ navigation }) {
  const { C } = useTheme();
  const styles = makeStyles(C);
  const { user } = useAuth();
  const now = useNow(1000);
  const { clock24 } = useSettings().settings;
  const [mine, setMine] = useState(null);
  const [week, setWeek] = useState(null);
  const [upcoming, setUpcoming] = useState([]);
  const [excited, setExcited] = useState({});
  const [tracked, setTracked] = useState(new Set());
  const [onlyMine, setOnlyMine] = useState(false);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    const lib = Object.values(await getLibrary(user));
    const following = lib.filter((e) => e.item.segment === "anime" && FOLLOWING.has(e.status));
    setTracked(new Set(following.map((e) => e.item.id)));
    const [fresh, sched, up, ex] = await Promise.all([
      fetchNextEpisodes(following.map((e) => e.item.id)).catch(() => { setError(true); return {}; }),
      fetchAiringSchedule(7).catch(() => { setError(true); return []; }),
      fetchAniList("anime", { sort: "popular", unreleasedOnly: true, perPage: 12 }).catch(() => ({ items: [] })),
      getExcited(user).catch(() => ({})),
    ]);
    // compare with the saved times to spot delays, then read the entries back
    await noteAiring(fresh);
    const saved = await getLibrary(user);
    setMine(
      following
        .map((e) => {
          const now = saved[`anime:${e.item.id}`] || e;
          const item = fresh[e.item.id] || e.item;
          return { status: e.status, item, delay: now.delay?.episode === item.nextEpisode?.episode ? now.delay : null };
        })
        .filter((e) => e.item.nextEpisode)
        .sort((a, b) => a.item.nextEpisode.airingAt - b.item.nextEpisode.airingAt)
    );
    setWeek(sched);
    setUpcoming(up.items);
    setExcited(ex);
  }, [user]);

  // reload whenever the tab is opened: you may have just tracked something
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const days = useMemo(() => {
    const groups = [];
    (week || [])
      .filter((s) => secondsUntil(s.airingAt, now) > -3600)
      .filter((s) => !onlyMine || tracked.has(s.item.id))
      .forEach((s) => {
        const label = dayLabel(s.airingAt, now);
        const last = groups[groups.length - 1];
        if (last && last.label === label) last.items.push(s);
        else groups.push({ label, items: [s] });
      });
    return groups;
  }, [week, onlyMine, tracked, Math.floor(now / 60000)]); // eslint-disable-line react-hooks/exhaustive-deps

  const open = (item) => openDetail(navigation, item);
  const onExcite = async (item) => {
    await toggleExcited(user, item);
    setExcited(await getExcited(user));
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
          <Text style={styles.error}>Couldn't reach AniList for the latest airing times. Pull down to retry.</Text>
        )}

        <Text style={styles.section}>⏳ Your next episodes</Text>
        {mine === null ? (
          <Text style={styles.empty}>Loading…</Text>
        ) : !mine.length ? (
          <Text style={styles.empty}>
            Nothing you follow is airing right now. Mark an airing anime as Watching or Plan to Watch and its
            countdown shows up here.
          </Text>
        ) : (
          mine.map(({ item, delay }) => {
            const next = item.nextEpisode;
            const soon = secondsUntil(next.airingAt, now) < 86400;
            return (
              <TouchableOpacity key={item.id} style={styles.row} onPress={() => open(item)}>
                {item.image ? <Image source={{ uri: item.image }} style={styles.thumb} /> : <View style={styles.thumb} />}
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle} numberOfLines={2}>{item.title}</Text>
                  <Text style={styles.rowSub}>
                    Episode {next.episode}{item.episodes ? ` of ${item.episodes}` : ""} · {dayLabel(next.airingAt, now)}, {airTime(next.airingAt, clock24)}
                  </Text>
                  {delay && (
                    <Text style={styles.delayed}>Delayed · was {dayLabel(delay.from, now)}, {airTime(delay.from, clock24)}</Text>
                  )}
                </View>
                <Text style={[styles.countdown, soon && styles.soon]}>{formatCountdown(next.airingAt, now)}</Text>
              </TouchableOpacity>
            );
          })
        )}

        <View style={styles.weekHead}>
          <Text style={[styles.section, { marginTop: 0, marginBottom: 0, paddingHorizontal: 0 }]}>📅 This week</Text>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {[[false, "All"], [true, "Mine"]].map(([v, label]) => (
              <TouchableOpacity key={label} onPress={() => setOnlyMine(v)} style={[styles.chip, onlyMine === v && styles.chipOn]}>
                <Text style={[styles.chipText, onlyMine === v && { color: "#fff" }]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        {week === null ? (
          <Text style={styles.empty}>Loading…</Text>
        ) : !days.length ? (
          <Text style={styles.empty}>{onlyMine ? "None of your shows air this week." : "No episodes found for this week."}</Text>
        ) : (
          days.map((g) => (
            <View key={g.label}>
              <Text style={styles.day}>{g.label}</Text>
              {g.items.map((s) => (
                <TouchableOpacity key={`${s.item.id}-${s.episode}`} style={styles.row} onPress={() => open(s.item)}>
                  <Text style={styles.time}>{airTime(s.airingAt, clock24)}</Text>
                  {s.item.image ? <Image source={{ uri: s.item.image }} style={styles.thumbSm} /> : <View style={styles.thumbSm} />}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle} numberOfLines={2}>{s.item.title}</Text>
                    <Text style={styles.rowSub}>Episode {s.episode}{tracked.has(s.item.id) ? " · in your library" : ""}</Text>
                  </View>
                  <Text style={styles.countdownSm}>{formatCountdown(s.airingAt, now)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ))
        )}

        {upcoming.length > 0 && <Text style={styles.section}>🚀 Upcoming anime</Text>}
        {upcoming.slice(0, 8).map((item) => {
          const on = !!excited[`${item.segment}:${item.id}`];
          return (
            <View key={item.id} style={styles.row}>
              <TouchableOpacity style={{ flexDirection: "row", flex: 1, alignItems: "center", gap: 10 }} onPress={() => open(item)}>
                {item.image ? <Image source={{ uri: item.image }} style={styles.thumbSm} /> : <View style={styles.thumbSm} />}
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.rowSub}>{item.date ? releaseLabel(item) : "Release date TBA"}</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => onExcite(item)} style={[styles.excite, on && styles.excited]}>
                <Text style={{ fontSize: 11, fontWeight: "800", color: on ? "#fff" : C.orange }}>{on ? "Excited ✓" : "Excited?"}</Text>
              </TouchableOpacity>
            </View>
          );
        })}
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
