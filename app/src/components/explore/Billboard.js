// Billboard: the big featured title at the top of Explore (the layout idea is
// Netflix's; the look is VoidPop's). Wide banner picture fading into the
// page, the title, genres, two lines of story, and two buttons:
// "My list" (adds it to Plan to Watch, or says where it already is) and Info.
// It can be an anime, a movie or a TV series (never manga or a novel).
import { useCallback, useState } from "react";
import { View, Text, Image, Pressable, StyleSheet, useWindowDimensions } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import Svg, { Defs, LinearGradient, Stop, Rect } from "react-native-svg";
import { useAuth } from "@voidpop/shared/backend/AuthContext";
import { getStatus, setStatus, statusesFor, getCinemaEntry, setCinemaStatus } from "@voidpop/shared/backend/store";
import { isCinema } from "@voidpop/shared/api/tmdb";
import { isShelf } from "@voidpop/shared/features/shelfKinds";
import { dayLabel, airTime, formatCountdown } from "@voidpop/shared/lib/format";
import { useNow } from "@voidpop/shared/lib/useNow";
import { useTheme } from "../../context/ThemeContext.js";
import Icon from "../ui/Icon.js";

export default function Billboard({ item, onOpen }) {
  const { C } = useTheme();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const [status, setStat] = useState(null);
  const now = useNow(60000);
  const read = useCallback(() => {
    if (!item) return;
    // movies and TV live on their own shelf, anime in the library
    (isCinema(item.segment) || isShelf(item.segment) ? getCinemaEntry(item.segment, item.id).then((e) => e?.status || null) : getStatus(user, item.segment, item.id)).then(setStat).catch(() => {});
  }, [user, item]);
  useFocusEffect(read);
  if (!item) return null;

  const height = Math.min(Math.round(width * 0.95), 420);
  const label = status ? statusesFor(item.segment).find((s) => s.key === status)?.label : null;
  const add = async () => {
    if (status) return onOpen(item);
    if (isCinema(item.segment) || isShelf(item.segment)) await setCinemaStatus(item, "plan");
    else await setStatus(user, item.segment, item, "plan");
    read();
  };
  const kind = { movie: "Movie", tv: "Series", game: "Game", comic: "Comic", manga: "Manga", novel: "Novel" }[item.segment] || "Anime";
  const airing = item.segment === "anime" && !item.finished ? "Airing" : null;
  const meta = [...(item.genres || []).slice(0, 3), airing].filter(Boolean).join("  ·  ");
  // the next episode (anime), release (game) or issue (comic), when there is one still to come
  const nextAt = item.nextEpisode?.airingAt || item.releaseAt || item.nextIssue?.airingAt;
  const nextLine = nextAt && nextAt * 1000 > now
    ? `${item.nextEpisode ? `Episode ${item.nextEpisode.episode}` : item.releaseAt ? "Releases" : `Issue ${item.nextIssue.issue}`} · ${dayLabel(nextAt, now)}, ${airTime(nextAt, false)} · in ${formatCountdown(nextAt, now)}`
    : null;

  return (
    <View style={{ marginTop: 12 }}>
      <Pressable onPress={() => onOpen(item)} accessibilityRole="button" accessibilityLabel={`${item.title}. Open`}>
        <View style={{ height, backgroundColor: item.color || undefined }}>
          {item.banner ? <Image source={{ uri: item.banner }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
          {/* fade into the page at the bottom so the title sits on the page colour */}
          <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none" viewBox="0 0 100 100">
            <Defs>
              <LinearGradient id="bb" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={C.bg} stopOpacity="0" />
                <Stop offset="0.45" stopColor={C.bg} stopOpacity="0.05" />
                <Stop offset="1" stopColor={C.bg} stopOpacity="1" />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100" height="100" fill="url(#bb)" />
          </Svg>
          <View style={[s.tag, { backgroundColor: C.purple }]}>
            <Text style={s.tagText}>{kind.toUpperCase()}</Text>
          </View>
        </View>
      </Pressable>
      <View style={{ paddingHorizontal: 16, marginTop: -54 }}>
        <Text style={[s.title, { color: C.text }]} numberOfLines={2}>{item.title}</Text>
        <Text style={{ color: C.sub, fontSize: 12, fontWeight: "700", marginTop: 6 }} numberOfLines={1}>{meta}</Text>
        {!!nextLine && <Text style={{ color: C.purple, fontSize: 13, fontWeight: "800", marginTop: 4 }} numberOfLines={1}>{nextLine}</Text>}
        {!!item.overview && <Text style={{ color: C.sub, fontSize: 13, lineHeight: 19, marginTop: 6 }} numberOfLines={2}>{item.overview}</Text>}
        <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
          <Pressable onPress={add} style={({ pressed }) => [s.btn, { backgroundColor: C.purple }, pressed && { opacity: 0.8 }]} accessibilityRole="button"
            accessibilityLabel={label ? `In your list: ${label}. Open` : "Add to Plan to Watch"}>
            <Icon name={label ? "library" : "plus"} size={17} color="#fff" />
            <Text style={[s.btnText, { color: "#fff" }]} numberOfLines={1}>{label ? label : "Add to list"}</Text>
          </Pressable>
          <Pressable onPress={() => onOpen(item)} style={({ pressed }) => [s.btn, { backgroundColor: C.card, borderWidth: 1, borderColor: C.border }, pressed && { opacity: 0.8 }]}
            accessibilityRole="button" accessibilityLabel="More info">
            <Icon name="info" size={17} color={C.text} />
            <Text style={[s.btnText, { color: C.text }]}>Details</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  tag: { position: "absolute", top: 12, left: 14, flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  tagText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  title: { fontSize: 36, fontWeight: "900", letterSpacing: 0.4, lineHeight: 38, textTransform: "uppercase", textShadowColor: "rgba(0,0,0,0.35)", textShadowRadius: 8 },
  btn: { flex: 1, height: 44, borderRadius: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  btnText: { fontSize: 15, fontWeight: "800" },
});
