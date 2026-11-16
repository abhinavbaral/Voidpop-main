// FILE: app/src/components/explore/WeekBanner.js — the pink banner between Explore's rows: how many releases land for your list
// in the next 7 days (episodes, games, issues) and which one is first. Hidden when nothing is coming.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Text, Pressable, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "@react-navigation/native";
import { getLibraryAll, onDataChange } from "@voidpop/shared/backend/store";
import { weekAhead } from "@voidpop/shared/features/summaries";
import { formatCountdown } from "@voidpop/shared/lib/format";
import { useNow } from "@voidpop/shared/lib/useNow";

export default function WeekBanner({ onOpen }) {
  const now = useNow(60000);
  const [entries, setEntries] = useState([]);
  const load = useCallback(() => getLibraryAll().then((l) => setEntries(Object.values(l))).catch(() => {}), []);
  useFocusEffect(load);
  useEffect(() => onDataChange(load), [load]);
  const w = useMemo(() => weekAhead(entries, now), [entries, Math.floor(now / 60000)]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!w.count) return null;
  return (
    <Pressable onPress={() => onOpen(w.next.item)} accessibilityRole="button" accessibilityLabel={`${w.count} releases this week. First: ${w.next.item.title}`} style={s.wrap}>
      <LinearGradient colors={["#e45ec5", "#6a2bd9"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.card}>
        <Text style={s.label}>YOUR WEEK</Text>
        <Text style={s.big}>{w.count} {w.count === 1 ? "release lands" : "releases land"} for your list</Text>
        <Text style={s.sub} numberOfLines={1}>First: {w.next.item.title}, in {formatCountdown(w.next.airingAt, now)}</Text>
      </LinearGradient>
    </Pressable>
  );
}

const s = StyleSheet.create({
  wrap: { marginHorizontal: 14, marginTop: 22 },
  card: { borderRadius: 18, padding: 18 },
  label: { color: "#190714", fontSize: 11, fontWeight: "900", letterSpacing: 1.4 },
  big: { color: "#fff", fontSize: 24, fontWeight: "900", lineHeight: 28, marginTop: 4, textTransform: "uppercase" },
  sub: { color: "#190714", fontSize: 13, fontWeight: "700", marginTop: 6 },
});
