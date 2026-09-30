// Explore's big cards (ideas from the "It's Fun Time!" concept):
//   NewEpisodeCards   one colourful card per show with episodes you haven't
//                     watched yet: "New episode · Ep 22", swipe sideways
//   Countdowns        "Coming up" (replaced Up next): a days : hours : minutes
//                     banner card for every anime you're Watching or Excited
//                     about, soonest first, with "3 pending" / "All caught up"
//                     in the heading and +1 on cards you're behind on
import { useCallback, useEffect, useState } from "react";
import { View, Text, Image, ScrollView, Pressable, StyleSheet, useWindowDimensions } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import Svg, { Defs, LinearGradient, Stop, Rect } from "react-native-svg";
import { getLibrary, getExcited, yourShows, onDataChange, noteAiring, behindBy, setProgress, setStatus, addReview } from "@voidation/shared/backend/store";
import { useAuth } from "@voidation/shared/backend/AuthContext";
import { fetchNextEpisodes } from "@voidation/shared/api/anilist";
import { useNow } from "@voidation/shared/hooks/useNow";
import { readableAccent } from "@voidation/shared/color";
import { useTheme } from "../context/ThemeContext.js";
import Icon from "./Icon.js";
import VerdictModal from "./VerdictModal.js";
import { VoidmonCheer } from "./Voidmon.js";

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
// when the next thing drops: the next episode's air time, or the start date
const nextAt = (item) => (item.nextEpisode ? item.nextEpisode.airingAt * 1000 : item.unreleased && item.date ? new Date(item.date).getTime() : null);
const nextLabel = (item) => (!item.nextEpisode || item.nextEpisode.episode === 1 ? "Premiere" : `Episode ${item.nextEpisode.episode}`);

// dark only at the bottom so the banner itself stays clear
function Fade({ id }) {
  return (
    <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none" viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#000" stopOpacity="0.15" />
          <Stop offset="0.45" stopColor="#000" stopOpacity="0.05" />
          <Stop offset="1" stopColor="#000" stopOpacity="0.8" />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100" height="100" fill={`url(#${id})`} />
    </Svg>
  );
}

// Every anime you're Watching or Excited about that has something coming,
// soonest first, one banner card each (swipe sideways).
export function Countdowns({ onOpen }) {
  const { C } = useTheme();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const cardW = Math.min(width - 28, 520);
  const now = useNow(30000);
  const [mine, setMine] = useState(null);
  const [watching, setWatching] = useState({}); // id -> library entry with fresh item (for pending and +1)
  const [finishing, setFinishing] = useState(null);
  const read = useCallback(async () => {
    const [lib, ex] = await Promise.all([getLibrary(), getExcited()]);
    const watch = Object.values(lib).filter((e) => e.status === "watching" && e.item.segment === "anime");
    const picked = [...watch, ...Object.values(ex)].map((e) => e.item).filter((i) => i.segment === "anime");
    const ids = [...new Set(picked.map((i) => i.id))];
    // fresh data: the saved copy may be old or missing its banner
    const fresh = await fetchNextEpisodes(ids).catch(() => ({}));
    await noteAiring(fresh).catch(() => {}); // keeps the saved copies (and delay tags) current
    setMine(ids.map((id) => fresh[id] || picked.find((i) => i.id === id)));
    setWatching(Object.fromEntries(watch.map((e) => [e.item.id, { ...e, item: { ...e.item, ...(fresh[e.item.id] || {}) } }])));
  }, []);
  useFocusEffect(useCallback(() => { read().catch(() => {}); }, [read]));
  useEffect(() => onDataChange(() => { read().catch(() => {}); }), [read]);
  if (!mine || !mine.length) return null;
  const list = mine.map((item) => ({ item, at: nextAt(item) })).filter((x) => x.at && x.at > now).sort((a, b) => a.at - b.at);
  const behind = (id) => (watching[id] ? behindBy(watching[id]) : 0);
  const pending = Object.keys(watching).reduce((n, id) => n + behind(id), 0);
  const plus = async (id) => {
    const e = watching[id];
    const r = await setProgress(user, e.item, (e.progress || 0) + 1, "plus");
    if (r.reachedEnd) setFinishing(e.item);
  };
  const finish = async ({ verdict, vibes, moods, comment }) => {
    await setStatus(user, finishing.segment, finishing, "completed");
    await addReview(user, finishing.segment, finishing.id, { verdict, vibes, moods, comment });
    setFinishing(null);
  };
  return (
    <View style={{ marginTop: 22 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, marginBottom: 10 }}>
        <Icon name="clock" size={17} color={C.orange} />
        <Text style={{ color: C.text, fontWeight: "800", fontSize: 16, flex: 1 }}>Coming up</Text>
        {Object.keys(watching).length > 0 && (
          <Text style={{ color: pending ? C.orange : C.green, fontWeight: "800", fontSize: 12 }}>{pending ? `${pending} pending` : "All caught up"}</Text>
        )}
      </View>
      {!list.length && (
        pending ? (
          <Text style={{ color: C.faint, fontSize: 13, paddingHorizontal: 14 }}>Nothing airing soon. Catch up on your new episodes above.</Text>
        ) : (
          <VoidmonCheer sub="Nothing airing soon. Countdowns show up here as your shows get dates." style={{ marginHorizontal: 14 }} />
        )
      )}
      {list.length > 0 && (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={cardW + 10} decelerationRate="fast"
        contentContainerStyle={{ gap: 10, paddingHorizontal: 14 }}>
        {list.map(({ item, at }) => {
          const left = Math.floor((at - now) / 60000);
          const [d, h, m] = [Math.floor(left / 1440), Math.floor((left % 1440) / 60), left % 60];
          const what = nextLabel(item);
          return (
            <Pressable key={item.id} onPress={() => onOpen(item)} style={[s.tick, { width: cardW, backgroundColor: C.card }]} accessibilityRole="button"
              accessibilityLabel={`${item.title}: ${what} in ${d} days, ${h} hours and ${m} minutes`}>
              {item.banner ? (
                <Image source={{ uri: item.banner }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              ) : item.image ? (
                // no banner: the cover sits on the right on its own colour, never stretched or blurred
                <>
                  <View style={[StyleSheet.absoluteFill, { backgroundColor: readableAccent(item.color, C.purple) }]} />
                  <Image source={{ uri: item.image }} style={s.tickCover} />
                </>
              ) : null}
              <Fade id={`f${item.id}`} />
              <View style={{ flex: 1, justifyContent: "space-between", padding: 16 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View style={s.tickTag}><Text style={s.tickTagText}>{what}</Text></View>
                  <View style={{ flex: 1 }} />
                  {behind(item.id) > 0 && (
                    <Pressable onPress={() => plus(item.id)} hitSlop={8} style={[s.plus, { backgroundColor: C.orange }]} accessibilityRole="button"
                      accessibilityLabel={`Mark episode ${(watching[item.id].progress || 0) + 1} watched, ${behind(item.id)} to catch up`}>
                      <Text style={s.plusText}>+1</Text>
                      <Text style={s.plusSub}>{behind(item.id)} to watch</Text>
                    </Pressable>
                  )}
                </View>
                <View>
                  <Text style={s.tickTitle} numberOfLines={2}>{item.title}</Text>
                  <View style={{ flexDirection: "row", gap: 14, alignItems: "flex-end", marginTop: 6 }}>
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
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
      )}
      {finishing && <VerdictModal visible initial={null} onSave={finish} onClose={() => setFinishing(null)} />}
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
  tick: { height: 190, borderRadius: 18, overflow: "hidden" },
  tickCover: { position: "absolute", right: 0, top: 0, bottom: 0, width: 132 },
  tickTag: { alignSelf: "flex-start", backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  tickTagText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  plus: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 5 },
  plusText: { color: "#1a1205", fontSize: 14, fontWeight: "900" },
  plusSub: { color: "#1a1205", fontSize: 11, fontWeight: "700" },
  tickTitle: { color: "#fff", fontSize: 20, fontWeight: "900", textShadowColor: "rgba(0,0,0,0.6)", textShadowRadius: 6 },
  tickNum: { color: "#fff", fontSize: 34, fontWeight: "900" },
  tickColon: { color: "#fff", fontSize: 28, fontWeight: "900", marginBottom: 18 },
  tickLabel: { color: "rgba(255,255,255,0.8)", fontSize: 11, fontWeight: "700" },
});
