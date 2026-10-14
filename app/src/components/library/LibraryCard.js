// Library poster in one of four layouts (idea from Mihon):
//   compact      the whole card is the cover, title over the bottom
//   comfortable  cover, then the title and progress underneath
//   cover        covers only
//   list         a row: small cover, title, status line and progress
// Every layout keeps the badge with how many episodes (chapters) are out that
// you haven't watched, the Delayed tag, and when the next episode airs
// ("Ep 6 · Sat 4 Oct, 9:30 PM"; on covers the short "Ep 6 · 2d 4h").
import { Pressable, Image, Text, View, StyleSheet } from "react-native";
import { leftToWatch, totalFor } from "@voidation/shared/backend/store";
import { dayLabel, airTime, formatCountdown } from "@voidation/shared/lib/format";
import { useSettings } from "@voidation/shared/backend/SettingsContext";
import { useTheme } from "../../context/ThemeContext.js";

const progressLine = (entry) => {
  const item = entry.item;
  const unit = item.segment === "manga" ? "Ch" : "Ep";
  const total = totalFor(item);
  return `${unit} ${entry.progress || 0}${total ? ` / ${total}` : ""}`;
};

export default function LibraryCard({ entry, columns, layout = "compact", onPress, onLongPress, selecting, selected }) {
  const { C } = useTheme();
  const item = entry.item;
  const left = leftToWatch(entry);
  const label = `${item.title}${left ? `, ${left} ${item.segment === "manga" ? "chapters" : "episodes"} left` : ""}`;
  const tick = selecting && (
    <View style={[styles.tick, selected && { backgroundColor: C.purple, borderColor: C.purple }]}>
      <Text style={{ color: "#fff", fontWeight: "900", fontSize: 12 }}>{selected ? "✓" : ""}</Text>
    </View>
  );
  const badges = (
    <>
      {left > 0 && <Text style={[styles.badge, { backgroundColor: C.purple }]}>{left}</Text>}
      {!!entry.delay && !selecting && <Text style={[styles.late, { backgroundColor: C.rose }]}>Delayed</Text>}
    </>
  );
  const { clock24 } = useSettings().settings;
  const next = item.segment === "anime" && entry.status !== "completed" && item.nextEpisode
    && item.nextEpisode.airingAt > Date.now() / 1000 ? item.nextEpisode : null;
  const nextLong = next ? `Ep ${next.episode} · ${dayLabel(next.airingAt)}, ${airTime(next.airingAt, clock24)}` : null;
  const nextShort = next ? `Ep ${next.episode} · ${formatCountdown(next.airingAt)}` : null;
  const press = { onPress, onLongPress, delayLongPress: 350, accessibilityLabel: `${label}${nextLong ? `, next: ${nextLong}` : ""}` };

  if (layout === "list") {
    const total = totalFor(item);
    const pct = total ? Math.min(1, (entry.progress || 0) / total) : 0;
    return (
      <Pressable {...press}
        style={({ pressed }) => [styles.row, { backgroundColor: C.card, borderColor: selected ? C.purple : C.border }, selected && { borderWidth: 2 }, pressed && { opacity: 0.85 }]}>
        <View style={styles.rowCover}>
          {item.image ? <Image source={{ uri: item.image }} style={StyleSheet.absoluteFill} /> : null}
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <Text style={{ color: C.text, fontWeight: "800", fontSize: 15 }} numberOfLines={2}>{item.title}</Text>
          <Text style={{ color: C.sub, fontSize: 12 }} numberOfLines={1}>
            {[progressLine(entry), left > 0 ? `${left} to catch up` : null, entry.delay ? "Delayed" : null].filter(Boolean).join(" · ")}
          </Text>
          {nextLong ? <Text style={{ color: C.purple, fontSize: 12, fontWeight: "700" }} numberOfLines={1}>{nextLong}</Text> : null}
          {total ? (
            <View style={[styles.bar, { backgroundColor: C.border }]}>
              <View style={{ width: `${pct * 100}%`, height: "100%", backgroundColor: C.purple, borderRadius: 2 }} />
            </View>
          ) : null}
        </View>
        {tick}
      </Pressable>
    );
  }

  const cover = (
    <Pressable {...press}
      style={({ pressed }) => [styles.card, { backgroundColor: C.card }, selected && { borderColor: C.purple, borderWidth: 3 }, pressed && { opacity: 0.85 }]}>
      {item.image ? <Image source={{ uri: item.image }} style={StyleSheet.absoluteFill} /> : null}
      {layout === "compact" && <View style={styles.shade} />}
      {badges}
      {nextShort && layout !== "comfortable" && (
        <Text style={[styles.next, { backgroundColor: C.purple }, layout === "cover" && { bottom: 7, top: undefined }]} numberOfLines={1}>{nextShort}</Text>
      )}
      {tick}
      {layout === "compact" && <Text style={styles.title} numberOfLines={2}>{item.title}</Text>}
    </Pressable>
  );

  return (
    <View style={{ width: `${100 / columns}%`, padding: layout === "cover" ? 4 : 6 }}>
      {cover}
      {layout === "comfortable" && (
        <View style={{ paddingTop: 6, paddingHorizontal: 2 }}>
          <Text style={{ color: C.text, fontWeight: "700", fontSize: 13, lineHeight: 17 }} numberOfLines={2}>{item.title}</Text>
          <Text style={{ color: C.faint, fontSize: 11, marginTop: 1 }} numberOfLines={1}>{progressLine(entry)}</Text>
          {nextLong ? <Text style={{ color: C.purple, fontSize: 11, fontWeight: "700", marginTop: 1 }} numberOfLines={1}>{nextLong}</Text> : null}
        </View>
      )}
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
  // compact: sits just above the title; covers only: at the bottom
  next: { position: "absolute", left: 7, right: 7, bottom: 52, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, color: "#fff", fontWeight: "800", fontSize: 10, textAlign: "center", overflow: "hidden" },
  tick: { position: "absolute", top: 7, right: 7, width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: "#fff", backgroundColor: "rgba(11,15,25,0.8)", alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, marginHorizontal: 6, marginVertical: 4, padding: 8, borderRadius: 12, borderWidth: 1 },
  rowCover: { width: 52, aspectRatio: 2 / 3, borderRadius: 8, overflow: "hidden", backgroundColor: "rgba(127,127,127,0.2)" },
  bar: { height: 4, borderRadius: 2, overflow: "hidden", marginTop: 3 },
});
