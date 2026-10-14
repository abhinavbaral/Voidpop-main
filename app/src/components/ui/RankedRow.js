// "Top rated" (idea from Zenshu): a sideways row with a big 01, 02… above
// each poster, a status badge (Finished / Airing / Upcoming) on the poster
// (no scores: Voidation only shows your own verdict), and "Ep 28 · Adventure" under the title.
import { View, Text, Image, FlatList, Pressable, StyleSheet } from "react-native";
import { useTheme } from "../../context/ThemeContext.js";
import Skeleton from "./Skeleton.js";

const STATUS = (it) => (it.unreleased ? "UPCOMING" : it.finished ? "FINISHED" : "AIRING");

export default function RankedRow({ title, subtitle, items, loading, onOpen, onMore }) {
  const { C } = useTheme();
  if (!loading && (items?.length || 0) < 4) return null;
  return (
    <View style={{ marginTop: 22 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", paddingHorizontal: 14 }}>
        <View style={{ flexShrink: 1 }}>
          <Text style={{ color: C.text, fontSize: 17, fontWeight: "900" }}>{title}</Text>
          {!!subtitle && <Text style={{ color: C.faint, fontSize: 12, marginTop: 2 }}>{subtitle}</Text>}
        </View>
        {onMore && (
          <Pressable onPress={onMore} hitSlop={10} accessibilityRole="button" accessibilityLabel={`See all: ${title}`}>
            <Text style={{ color: C.purple, fontWeight: "800", fontSize: 13 }}>See all ›</Text>
          </Pressable>
        )}
      </View>
      {loading ? (
        <View style={{ flexDirection: "row", gap: 12, paddingHorizontal: 14, marginTop: 12 }}>
          {[0, 1, 2].map((k) => <Skeleton key={k} width={140} height={250} />)}
        </View>
      ) : (
        <FlatList
          horizontal
          data={items}
          keyExtractor={(it) => `${it.segment}-${it.id}`}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 12, paddingHorizontal: 14, paddingTop: 4 }}
          renderItem={({ item, index }) => (
            <Pressable onPress={() => onOpen(item)} style={{ width: 140 }} accessibilityRole="button"
              accessibilityLabel={`${index + 1}. ${item.title}`}>
              <Text style={[s.num, { color: C.purple }]}>{String(index + 1).padStart(2, "0")}</Text>
              <View style={[s.card, { backgroundColor: C.card }]}>
                {item.image ? <Image source={{ uri: item.image }} style={StyleSheet.absoluteFill} /> : null}
                <View style={s.shade} />
                <View style={s.top}>
                  <View style={s.status}><Text style={s.statusText}>{STATUS(item)}</Text></View>
                </View>
                <View style={s.bottom}>
                  <Text style={s.title} numberOfLines={2}>{item.title}</Text>
                  <Text style={s.meta} numberOfLines={1}>
                    {[item.episodes ? `Ep ${item.episodes}` : item.nextEpisode ? `Ep ${item.nextEpisode.episode - 1}` : null, item.genre].filter(Boolean).join(" · ")}
                  </Text>
                </View>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  num: { fontSize: 30, fontWeight: "900", marginBottom: -6, marginLeft: 2, letterSpacing: -1 },
  card: { width: 140, height: 210, borderRadius: 14, overflow: "hidden", justifyContent: "space-between" },
  shade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.25)" },
  top: { flexDirection: "row", justifyContent: "space-between", padding: 7 },
  status: { backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2, borderWidth: 1, borderColor: "rgba(255,255,255,0.25)" },
  statusText: { color: "#e5e7eb", fontSize: 8, fontWeight: "900", letterSpacing: 1 },
  bottom: { padding: 8, backgroundColor: "rgba(0,0,0,0.55)" },
  title: { color: "#fff", fontSize: 12, fontWeight: "800" },
  meta: { color: "#d1d5db", fontSize: 10, marginTop: 2 },
});
