// UPCOMING — a month calendar of premieres (tap a day to see them), what's
// airing in the next 24 hours, and the latest premieres. Same as the website.
import { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, View, Text, Image, TouchableOpacity, StyleSheet, RefreshControl, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { loadMonthPremieres, monthGrid, dayKey, loadAiringSoon, loadLatestPremieres } from "@voidation/shared/upcoming";
import { getExcited, toggleExcited } from "@voidation/shared/backend/store";
import { useAuth } from "@voidation/shared/backend/AuthContext";
import { useNow } from "@voidation/shared/hooks/useNow";
import { useSettings } from "@voidation/shared/backend/SettingsContext";
import { formatCountdown, airTime } from "@voidation/shared/format";
import PosterRow from "../components/PosterRow.js";
import { useTheme } from "../context/ThemeContext.js";
import { openDetail } from "../lib/nav";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

export default function UpcomingScreen({ navigation }) {
  const { C } = useTheme();
  const styles = makeStyles(C);
  const { width } = useWindowDimensions();
  const { user } = useAuth();
  const now = useNow(1000);
  const { clock24 } = useSettings().settings;
  const today = new Date();
  const [month, setMonth] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const [byDay, setByDay] = useState(null);
  const [picked, setPicked] = useState(null);
  const [soon, setSoon] = useState(null);
  const [latest, setLatest] = useState([]);
  const [excited, setExcited] = useState({});
  const [refreshing, setRefreshing] = useState(false);

  const loadMonth = useCallback(async () => {
    setByDay(null);
    try {
      const d = await loadMonthPremieres(month.y, month.m);
      setByDay(d);
      const t = dayKey(new Date());
      const keys = Object.keys(d).sort();
      setPicked(d[t] ? t : keys.find((k) => k >= t) || keys[0] || null);
    } catch { setByDay({}); }
  }, [month.y, month.m]);
  const loadRest = useCallback(async () => {
    loadAiringSoon(24).then(setSoon).catch(() => setSoon([]));
    loadLatestPremieres(21).then(setLatest).catch(() => {});
    getExcited(user).then(setExcited).catch(() => {});
  }, [user]);
  useEffect(() => { loadMonth(); }, [loadMonth]);
  useEffect(() => { loadRest(); }, [loadRest]);

  const weeks = useMemo(() => monthGrid(month.y, month.m), [month.y, month.m]);
  const title = new Date(month.y, month.m, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const shift = (d) => setMonth(({ y, m }) => { const x = new Date(y, m + d, 1); return { y: x.getFullYear(), m: x.getMonth() }; });
  const dayItems = picked && byDay ? byDay[picked] || [] : [];
  const cell = Math.floor((Math.min(width, 720) - 28 - 6 * 4) / 7);
  const open = (it) => openDetail(navigation, it);
  const excite = async (item) => { await toggleExcited(user, item); setExcited(await getExcited(user)); };
  const refresh = async () => { setRefreshing(true); await Promise.all([loadMonth(), loadRest()]); setRefreshing(false); };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 30 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.purple} colors={[C.purple]} />}>
        <Text style={styles.title}>Upcoming</Text>

        <View style={styles.monthRow}>
          <Text style={styles.section}>🗓️ Premieres</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <TouchableOpacity style={styles.arrow} onPress={() => shift(-1)} accessibilityLabel="Previous month"><Text style={styles.arrowText}>‹</Text></TouchableOpacity>
            <Text style={{ color: C.text, fontWeight: "800", minWidth: 110, textAlign: "center" }}>{title}</Text>
            <TouchableOpacity style={styles.arrow} onPress={() => shift(1)} accessibilityLabel="Next month"><Text style={styles.arrowText}>›</Text></TouchableOpacity>
          </View>
        </View>

        <View style={styles.grid}>
          {WEEKDAYS.map((d, i) => <Text key={i} style={[styles.weekday, { width: cell }]}>{d}</Text>)}
          {weeks.flat().map((d, i) => {
            if (!d) return <View key={i} style={{ width: cell, height: cell }} />;
            const k = dayKey(d);
            const items = byDay?.[k] || [];
            const on = picked === k;
            const isToday = k === dayKey(today);
            return (
              <TouchableOpacity key={k} onPress={() => setPicked(k)}
                style={[styles.cell, { width: cell, height: cell }, items.length > 0 && styles.cellHas, on && { borderColor: C.purple, borderWidth: 2 }]}
                accessibilityLabel={`${d.toDateString()}: ${items.length} premieres`}>
                <Text style={[styles.num, isToday && { color: C.orange }, items.length > 0 && { color: C.text }]}>{d.getDate()}</Text>
                {items.length > 0 && (items[0].image
                  ? <Image source={{ uri: items[0].image }} style={styles.cellImg} />
                  : <View style={styles.dot} />)}
                {items.length > 1 && <Text style={styles.more}>+{items.length - 1}</Text>}
              </TouchableOpacity>
            );
          })}
        </View>

        {byDay === null ? <Text style={styles.empty}>Loading…</Text> : picked ? (
          <>
            <Text style={styles.dayTitle}>{new Date(`${picked}T00:00`).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</Text>
            {dayItems.length ? dayItems.map((item) => {
              const on = !!excited[`anime:${item.id}`];
              return (
                <View key={item.id} style={styles.row}>
                  <TouchableOpacity style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10 }} onPress={() => open(item)}>
                    {item.image ? <Image source={{ uri: item.image }} style={styles.thumb} /> : <View style={styles.thumb} />}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle} numberOfLines={2}>{item.title}</Text>
                      <Text style={styles.rowSub} numberOfLines={1}>{[item.format?.replace("_", " "), item.creator, item.genres?.slice(0, 2).join(", ")].filter(Boolean).join(" · ")}</Text>
                    </View>
                  </TouchableOpacity>
                  {item.unreleased && (
                    <TouchableOpacity onPress={() => excite(item)} style={[styles.excite, on && { backgroundColor: C.orange }]}>
                      <Text style={{ fontSize: 11, fontWeight: "800", color: on ? "#fff" : C.orange }}>{on ? "Excited ✓" : "Excited?"}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            }) : <Text style={styles.empty}>No premieres that day.</Text>}
          </>
        ) : <Text style={styles.empty}>No premieres with a set date this month yet.</Text>}

        <Text style={[styles.section, { paddingHorizontal: 14, marginTop: 22 }]}>⏰ Airing soon <Text style={{ color: C.faint, fontSize: 12, fontWeight: "600" }}>next 24 hours</Text></Text>
        {soon === null ? <Text style={styles.empty}>Loading…</Text> : !soon.length ? <Text style={styles.empty}>Nothing airs in the next 24 hours.</Text> : soon.map((s) => (
          <TouchableOpacity key={`${s.item.id}-${s.episode}`} style={styles.row} onPress={() => open(s.item)}>
            <Text style={styles.time}>{airTime(s.airingAt, clock24)}</Text>
            {s.item.image ? <Image source={{ uri: s.item.image }} style={styles.thumbSm} /> : <View style={styles.thumbSm} />}
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle} numberOfLines={1}>{s.item.title}</Text>
              <Text style={styles.rowSub}>Episode {s.episode}</Text>
            </View>
            <Text style={styles.countdown}>{formatCountdown(s.airingAt, now)}</Text>
          </TouchableOpacity>
        ))}

        {latest.length > 0 && <PosterRow title="🎬 Latest premieres · last 3 weeks" items={latest} onOpen={open} />}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (C) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  title: { color: C.text, fontSize: 20, fontWeight: "800", paddingHorizontal: 14, paddingTop: 8 },
  monthRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, marginTop: 14, marginBottom: 8 },
  section: { color: C.text, fontWeight: "800", fontSize: 15 },
  arrow: { width: 34, height: 34, borderRadius: 9, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" },
  arrowText: { color: C.text, fontSize: 20, marginTop: -2 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 4, paddingHorizontal: 14 },
  weekday: { textAlign: "center", color: C.faint, fontSize: 11, fontWeight: "800", marginBottom: 2 },
  cell: { borderRadius: 9, borderWidth: 1, borderColor: C.border, padding: 3, overflow: "hidden" },
  cellHas: { backgroundColor: C.card },
  num: { color: C.faint, fontSize: 11, fontWeight: "800" },
  cellImg: { position: "absolute", right: 3, bottom: 3, width: "46%", aspectRatio: 2 / 3, borderRadius: 3 },
  dot: { position: "absolute", bottom: 5, alignSelf: "center", width: 6, height: 6, borderRadius: 3, backgroundColor: C.purple },
  more: { position: "absolute", left: 4, bottom: 3, color: C.purple, fontSize: 10, fontWeight: "900" },
  dayTitle: { color: C.text, fontWeight: "800", fontSize: 14, paddingHorizontal: 14, marginTop: 14, marginBottom: 4 },
  empty: { color: C.faint, fontSize: 13, paddingHorizontal: 14, marginTop: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 7 },
  thumb: { width: 40, height: 56, borderRadius: 6, backgroundColor: C.border },
  thumbSm: { width: 36, height: 50, borderRadius: 6, backgroundColor: C.border },
  rowTitle: { color: C.text, fontSize: 13, fontWeight: "700" },
  rowSub: { color: C.faint, fontSize: 11, marginTop: 2 },
  time: { color: C.sub, fontSize: 11, fontWeight: "700", width: 58 },
  countdown: { color: C.purple, fontWeight: "800", fontSize: 12 },
  excite: { borderWidth: 1, borderColor: C.orange, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
});
