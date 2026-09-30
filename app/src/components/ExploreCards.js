// Explore's big cards (ideas from the "It's Fun Time!" concept):
//   NewEpisodeCards   one colourful card per show with episodes you haven't
//                     watched yet: "New episode · Ep 22", swipe sideways
//   PremiereCountdown "Tick tock": a big days : hours : minutes countdown to
//                     the next premiere you're waiting for (your Excited or
//                     Plan to Watch titles first, otherwise the most popular
//                     upcoming one)
import { useCallback, useEffect, useState } from "react";
import { View, Text, Image, ScrollView, Pressable, StyleSheet } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import Svg, { Defs, LinearGradient, Stop, Rect } from "react-native-svg";
import { getLibrary, getExcited, yourShows, onDataChange } from "@voidation/shared/backend/store";
import { fetchNextEpisodes } from "@voidation/shared/api/anilist";
import { useNow } from "@voidation/shared/hooks/useNow";
import { readableAccent } from "@voidation/shared/color";
import { useTheme } from "../context/ThemeContext.js";
import Icon from "./Icon.js";

// a soft two-colour wash from the cover's own colour
function Wash({ color, id }) {
  return (
    <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none" viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity="1" />
          <Stop offset="1" stopColor="#ee8f2e" stopOpacity="0.9" />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100" height="100" fill={`url(#${id})`} />
    </Svg>
  );
}

export function NewEpisodeCards({ onOpen }) {
  const { C } = useTheme();
  const [shows, setShows] = useState([]);
  const read = useCallback(async () => {
    const lib = await getLibrary();
    const ids = Object.values(lib).filter((e) => e.item.segment === "anime" && e.status === "watching").map((e) => e.item.id);
    const fresh = await fetchNextEpisodes(ids).catch(() => ({}));
    setShows(yourShows(lib, fresh).filter((s) => s.pending > 0).sort((a, b) => b.pending - a.pending).slice(0, 10));
  }, []);
  useFocusEffect(useCallback(() => { read().catch(() => {}); }, [read]));
  useEffect(() => onDataChange(() => { read().catch(() => {}); }), [read]);
  if (!shows.length) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 14, paddingTop: 14 }}>
      {shows.map(({ item, entry, pending }) => {
        const nextEp = (entry.progress || 0) + 1;
        return (
          <Pressable key={item.id} onPress={() => onOpen(item)} style={s.epCard} accessibilityRole="button"
            accessibilityLabel={`${item.title}: ${pending} new episode${pending === 1 ? "" : "s"}, next is episode ${nextEp}`}>
            <Wash color={readableAccent(item.color, C.purple)} id={`w${item.id}`} />
            <View style={{ flex: 1, justifyContent: "space-between", padding: 14 }}>
              <View style={s.badge}>
                <Icon name="bell" size={12} color="#7c2d12" />
                <Text style={s.badgeText}>{pending === 1 ? "New episode" : `${pending} new episodes`}</Text>
              </View>
              <View>
                <Text style={s.epTitle} numberOfLines={2}>{item.title}</Text>
                <Text style={s.epSub}>Up next: Episode {nextEp}</Text>
              </View>
            </View>
            {item.image ? <Image source={{ uri: item.image }} style={s.epPoster} /> : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const pad = (n) => String(Math.max(0, n)).padStart(2, "0");
// when a title starts: its first episode's air time, or its start date
const premiereAt = (item) => (item.nextEpisode?.episode === 1 ? item.nextEpisode.airingAt * 1000 : item.unreleased && item.date ? new Date(item.date).getTime() : null);

export function PremiereCountdown({ upcoming = [], onOpen }) {
  const { C } = useTheme();
  const now = useNow(30000);
  const [mine, setMine] = useState([]);
  useFocusEffect(useCallback(() => {
    Promise.all([getLibrary(), getExcited()]).then(([lib, ex]) => {
      const fromLib = Object.values(lib).filter((e) => e.item.segment === "anime" && ["plan", "watching"].includes(e.status)).map((e) => e.item);
      setMine([...Object.values(ex).map((e) => e.item).filter((i) => i.segment === "anime"), ...fromLib]);
    }).catch(() => {});
  }, []));
  const future = (list) => list.map((item) => ({ item, at: premiereAt(item) })).filter((x) => x.at && x.at > now);
  const yours = future(mine).sort((a, b) => a.at - b.at)[0];
  const popular = future(upcoming).sort((a, b) => (b.item.popularity || 0) - (a.item.popularity || 0))[0];
  const pick = yours || popular;
  if (!pick) return null;
  const { item, at } = pick;
  const left = Math.floor((at - now) / 60000);
  const [d, h, m] = [Math.floor(left / 1440), Math.floor((left % 1440) / 60), left % 60];
  return (
    <View style={{ marginTop: 22 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, marginBottom: 10 }}>
        <Icon name="clock" size={17} color={C.orange} />
        <Text style={{ color: C.text, fontWeight: "800", fontSize: 16 }}>Tick tock…</Text>
        <Text style={{ color: C.faint, fontSize: 12 }}>{yours ? "on your list" : "most awaited"}</Text>
      </View>
      <Pressable onPress={() => onOpen(item)} style={s.tick} accessibilityRole="button"
        accessibilityLabel={`${item.title} premieres in ${d} days, ${h} hours and ${m} minutes`}>
        <Image source={{ uri: item.banner || item.image }} style={StyleSheet.absoluteFill} blurRadius={item.banner ? 0 : 6} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(20,8,30,0.55)" }]} />
        <View style={{ flex: 1, justifyContent: "space-between", padding: 16 }}>
          <Text style={s.tickTitle} numberOfLines={2}>{item.title}</Text>
          <View style={{ flexDirection: "row", gap: 14, alignItems: "flex-end" }}>
            {[[d, "Days"], [h, "Hours"], [m, "Min"]].map(([n, label], k) => (
              <View key={label} style={{ flexDirection: "row", alignItems: "flex-end", gap: 14 }}>
                {k > 0 && <Text style={s.tickColon}>:</Text>}
                <View style={{ alignItems: "center" }}>
                  <Text style={s.tickNum}>{pad(n)}</Text>
                  <Text style={s.tickLabel}>{label}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  epCard: { width: 300, height: 130, borderRadius: 18, overflow: "hidden", flexDirection: "row" },
  badge: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", backgroundColor: "#fde68a", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { color: "#7c2d12", fontSize: 11, fontWeight: "800" },
  epTitle: { color: "#fff", fontSize: 16, fontWeight: "900" },
  epSub: { color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: "700", marginTop: 2 },
  epPoster: { width: 86, height: 130 },
  tick: { marginHorizontal: 14, height: 170, borderRadius: 18, overflow: "hidden" },
  tickTitle: { color: "#fff", fontSize: 20, fontWeight: "900" },
  tickNum: { color: "#fff", fontSize: 34, fontWeight: "900" },
  tickColon: { color: "#fff", fontSize: 28, fontWeight: "900", marginBottom: 18 },
  tickLabel: { color: "rgba(255,255,255,0.8)", fontSize: 11, fontWeight: "700" },
});
