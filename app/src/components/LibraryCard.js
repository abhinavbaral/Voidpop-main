// Library poster: the whole card is the cover, title over the bottom, and a
// badge with how many episodes (chapters) are out that you haven't watched.
import { Pressable, Image, Text, View, StyleSheet } from "react-native";
import { leftToWatch } from "@voidation/shared/backend/store";
import { useTheme } from "../context/ThemeContext.js";

export default function LibraryCard({ entry, columns, onPress, onLongPress, selecting, selected }) {
  const { C } = useTheme();
  const item = entry.item;
  const left = leftToWatch(entry);
  return (
    <View style={{ width: `${100 / columns}%`, padding: 6 }}>
      <Pressable onPress={onPress} onLongPress={onLongPress} delayLongPress={350}
        style={({ pressed }) => [styles.card, { backgroundColor: C.card }, selected && { borderColor: C.purple, borderWidth: 3 }, pressed && { opacity: 0.85 }]}
        accessibilityLabel={`${item.title}${left ? `, ${left} ${item.segment === "manga" ? "chapters" : "episodes"} left` : ""}`}>
        {item.image ? <Image source={{ uri: item.image }} style={StyleSheet.absoluteFill} /> : null}
        <View style={styles.shade} />
        {left > 0 && <Text style={[styles.badge, { backgroundColor: C.purple }]}>{left}</Text>}
        {!!entry.delay && <Text style={[styles.late, { backgroundColor: C.rose }]}>Delayed</Text>}
        {selecting && (
          <View style={[styles.tick, selected && { backgroundColor: C.purple, borderColor: C.purple }]}>
            <Text style={{ color: "#fff", fontWeight: "900", fontSize: 12 }}>{selected ? "✓" : ""}</Text>
          </View>
        )}
        <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { aspectRatio: 2 / 3, borderRadius: 12, overflow: "hidden", justifyContent: "flex-end" },
  // darker bottom so the title reads on any cover
  shade: { position: "absolute", left: 0, right: 0, bottom: 0, height: "40%", backgroundColor: "rgba(0,0,0,0.55)" },
  title: { color: "#fff", fontWeight: "700", fontSize: 14, lineHeight: 18, padding: 9, textShadowColor: "rgba(0,0,0,0.6)", textShadowRadius: 3 },
  badge: { position: "absolute", top: 7, left: 7, minWidth: 26, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 7, color: "#fff", fontWeight: "800", fontSize: 13, textAlign: "center", overflow: "hidden" },
  late: { position: "absolute", top: 7, right: 7, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 7, color: "#fff", fontWeight: "800", fontSize: 10, overflow: "hidden" },
  tick: { position: "absolute", top: 7, right: 7, width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: "#fff", backgroundColor: "rgba(11,15,25,0.8)", alignItems: "center", justifyContent: "center" },
});
