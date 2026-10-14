// Trends: what's trending on AniList right now, one big poster at a time.
// Swipe sideways; the card under the poster shows its genres, episodes and
// minutes per episode (no scores or counts).
// Country switch: all, Japan, Korea, China.
import { useEffect, useState } from "react";
import { View, Text, Image, FlatList, Pressable, TouchableOpacity, StyleSheet, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { fetchAniList } from "@voidation/shared/api/anilist";
import { useTheme } from "../../context/ThemeContext.js";
import { openDetail, goBackOrHome } from "../../utils/nav";
import Icon from "../../components/ui/Icon.js";
import Chips from "../../components/ui/Chips.js";
import Skeleton from "../../components/ui/Skeleton.js";
import { VoidmonTrouble } from "../../components/brand/Voidmon.js";

export const COUNTRIES = [
  { key: "", label: "Everywhere" },
  { key: "JP", label: "Japan" },
  { key: "KR", label: "Korea" },
  { key: "CN", label: "China" },
];

export default function TrendsScreen({ navigation, route }) {
  const { C } = useTheme();
  const styles = makeStyles(C);
  const { width } = useWindowDimensions();
  const cardW = Math.min(width * 0.72, 320);
  const gap = 14;
  const [country, setCountry] = useState(route.params?.country ?? "");
  const [items, setItems] = useState(null);
  const [failed, setFailed] = useState(false);
  const [index, setIndex] = useState(0);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setItems(null); setFailed(false); setIndex(0);
    fetchAniList("anime", { sort: "trending", origin: country, perPage: 20 })
      .then((r) => alive && setItems(r.items))
      .catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [country, attempt]);

  const it = items?.[index];
  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.head}>
        <TouchableOpacity onPress={() => goBackOrHome(navigation)} hitSlop={12} accessibilityLabel="Back"><Icon name="back" size={22} color={C.text} /></TouchableOpacity>
        <Text style={styles.title}>Trending now</Text>
        <View style={{ width: 22 }} />
      </View>
      <View style={{ paddingHorizontal: 14 }}>
        <Chips value={country} onChange={setCountry} options={COUNTRIES} />
      </View>
      {failed ? <VoidmonTrouble what="Trends" onRetry={() => setAttempt((n) => n + 1)} navigation={navigation} /> : !items ? (
        <View style={{ alignItems: "center", marginTop: 20, gap: 14 }}>
          <Skeleton width={cardW} height={cardW * 1.45} />
          <Skeleton width={width - 60} height={150} />
        </View>
      ) : (
        <>
          <FlatList
            horizontal
            data={items}
            keyExtractor={(x) => String(x.id)}
            showsHorizontalScrollIndicator={false}
            snapToInterval={cardW + gap}
            decelerationRate="fast"
            contentContainerStyle={{ paddingHorizontal: (width - cardW) / 2, gap, paddingTop: 18 }}
            onScroll={(e) => setIndex(Math.max(0, Math.min(items.length - 1, Math.round(e.nativeEvent.contentOffset.x / (cardW + gap)))))}
            scrollEventThrottle={32}
            renderItem={({ item, index: k }) => (
              <Pressable onPress={() => openDetail(navigation, item)} accessibilityRole="button" accessibilityLabel={item.title}
                style={{ width: cardW, height: cardW * 1.45, borderRadius: 22, overflow: "hidden", opacity: k === index ? 1 : 0.55, backgroundColor: C.card }}>
                {item.image ? <Image source={{ uri: item.image }} style={{ width: "100%", height: "100%" }} /> : null}
                <View style={styles.rankBadge}><Text style={styles.rankText}>#{k + 1}</Text></View>
              </Pressable>
            )}
          />
          {it && (
            <View style={styles.info}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, justifyContent: "center" }}>
                <Text style={styles.name} numberOfLines={1}>{it.title}</Text>
              </View>
              <Text style={styles.genres} numberOfLines={1}>{it.genres.slice(0, 3).join("  ·  ")}</Text>
              <View style={styles.stats}>
                <View style={styles.stat}><Text style={styles.statNum}>{it.episodes ?? (it.nextEpisode ? it.nextEpisode.episode - 1 : "?")}</Text><Text style={styles.statLabel}>{it.episodes ? "Episodes" : "Episodes so far"}</Text></View>
                <View style={[styles.stat, { borderLeftWidth: 1, borderLeftColor: C.border }]}><Text style={styles.statNum}>{it.duration ? `${it.duration} min` : "?"}</Text><Text style={styles.statLabel}>Per episode</Text></View>
              </View>
            </View>
          )}
        </>
      )}
    </SafeAreaView>
  );
}

const makeStyles = (C) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14 },
  title: { color: C.text, fontSize: 18, fontWeight: "900" },
  rankBadge: { position: "absolute", left: 12, top: 12, backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  rankText: { color: "#fff", fontWeight: "900" },
  info: { margin: 16, marginTop: 18, padding: 16, borderRadius: 18, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, gap: 10 },
  name: { color: C.text, fontSize: 19, fontWeight: "900", flexShrink: 1 },
  genres: { color: C.sub, fontSize: 13, textAlign: "center" },
  stats: { flexDirection: "row", borderRadius: 12, borderWidth: 1, borderColor: C.border },
  stat: { flex: 1, alignItems: "center", paddingVertical: 10 },
  statNum: { color: C.text, fontSize: 17, fontWeight: "900" },
  statLabel: { color: C.faint, fontSize: 11, marginTop: 2 },
});
