// One poster card — NO numerical ratings anywhere (Voidation rule).
// Under the poster:  Title
//                    Creator (mangaka / studio)
//                    Genre · release date
// Anime that are airing get an "Ep 7 · 2d 4h" countdown badge on the poster.

import { Pressable, Image, Text, View, StyleSheet, Platform } from "react-native";
import { useTheme } from "../context/ThemeContext.js";
import { releaseLabel, formatCountdown } from "@voidation/shared/format";
import { useSettings } from "@voidation/shared/backend/SettingsContext";
import { totalFor, unitFor, behindBy, maxProgress, doneLabel } from "@voidation/shared/backend/store";
import Icon from "./Icon.js";

// `columns`: when used in a grid, each cell gets an exact 1/columns width so an
// incomplete last row doesn't stretch its cards.
// `entry` (Library only): shows your progress; with onPlus, a +1 button.
// selecting / selected / onLongPress: the Library's select mode.
export default function Card({ item, onPress, width, columns, entry, onPlus, selecting, selected, onLongPress }) {
  const { C } = useTheme();
  const styles = makeStyles(C);

  if (columns) {
    return (
      <View style={{ width: `${100 / columns}%`, padding: 6 }}>
        <CardInner item={item} entry={entry} onPlus={onPlus} onPress={onPress} onLongPress={onLongPress}
          selecting={selecting} selected={selected} styles={styles} C={C} style={{ margin: 0, flex: undefined }} />
      </View>
    );
  }
  return (
    <CardInner
      item={item} entry={entry} onPlus={onPlus} onPress={onPress} styles={styles} C={C}
      style={width ? { width, flex: undefined } : null}
    />
  );
}

function CardInner({ item, entry, onPlus, onPress, onLongPress, selecting, selected, styles, C, style }) {
  const creator = item.creator;
  const { settings } = useSettings();
  const next = settings.posterBadges ? item.nextEpisode : null;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      style={({ hovered, pressed }) => [
        styles.card,
        style,
        selected && { borderColor: C.purple, borderWidth: 3 },
        hovered && styles.hovered,
        pressed && { opacity: 0.85 },
      ]}
    >
      <View>
        {item.image ? (
          <Image source={{ uri: item.image }} style={styles.poster} />
        ) : (
          <View style={[styles.poster, styles.noImg]}>
            <Text style={{ color: C.faint, fontSize: 12 }}>No image</Text>
          </View>
        )}
        {!!item.awardYear && <View style={styles.award}><Icon name="trophy" size={11} color="#1a1205" strokeWidth={2.4} /><Text style={styles.awardText}>{item.awardYear}</Text></View>}
        {selecting && (
          <View style={[styles.tick, selected && { backgroundColor: C.purple, borderColor: C.purple }]}>
            <Text style={{ color: "#fff", fontWeight: "900", fontSize: 12 }}>{selected ? "✓" : ""}</Text>
          </View>
        )}
        {next && (
          <Text style={[styles.badge, entry?.delay && styles.late]} numberOfLines={1}>
            {entry?.delay ? "Delayed · " : ""}Ep {next.episode} · {formatCountdown(next.airingAt)}
          </Text>
        )}
      </View>
      <View style={styles.meta}>
        <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
        {/* always rendered so cards in a row keep the same height while it loads */}
        <Text style={styles.creator} numberOfLines={1}>{creator || " "}</Text>
        <Text style={styles.sub} numberOfLines={1}>
          {item.genre} · {releaseLabel(item)}
        </Text>
        {entry && (
          <View style={styles.progressRow}>
            {entry.status === "completed" ? (
              <Text style={[styles.progress, { color: C.green }]} numberOfLines={1}>{doneLabel(item)}</Text>
            ) : (
              <Text style={styles.progress} numberOfLines={1}>
                {unitFor(item.segment)} {entry.progress || 0}{totalFor(item) ? `/${totalFor(item)}` : ""}
                {behindBy(entry) > 0 && <Text style={{ color: C.orange }}> · {behindBy(entry)} new</Text>}
              </Text>
            )}
            {onPlus && !selecting && (maxProgress(item) == null || (entry.progress || 0) < maxProgress(item)) && (
              <Pressable onPress={onPlus} hitSlop={8} style={styles.plus}
                accessibilityLabel={item.segment === "manga" ? "Mark next chapter read" : "Mark next episode watched"}>
                <Text style={styles.plusText}>+1</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
    </Pressable>
  );
}

const makeStyles = (C) => StyleSheet.create({
  card: {
    flex: 1,
    margin: 6,
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    overflow: "hidden",
    ...(Platform.OS === "web" ? { cursor: "pointer", transitionDuration: "150ms", transitionProperty: "transform, border-color" } : null),
  },
  hovered: { transform: [{ translateY: -3 }], borderColor: C.purple },
  poster: { width: "100%", aspectRatio: 2 / 3, backgroundColor: C.border },
  noImg: { alignItems: "center", justifyContent: "center" },
  meta: { padding: 8 },
  title: { color: C.text, fontWeight: "700", fontSize: 13 },
  creator: { color: C.orange, fontSize: 11, fontWeight: "600", marginTop: 3 },
  sub: { color: C.sub, fontSize: 11, marginTop: 2 },
  award: { position: "absolute", top: 6, left: 6, flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#f59e0b", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  awardText: { color: "#1a1205", fontWeight: "900", fontSize: 11 },
  tick: {
    position: "absolute", top: 6, left: 6, width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: "#fff",
    backgroundColor: "rgba(11,15,25,0.8)", alignItems: "center", justifyContent: "center",
  },
  late: { backgroundColor: "rgba(190,18,60,0.92)" },
  progressRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 4, marginTop: 6 },
  progress: { flex: 1, color: C.sub, fontSize: 11, fontWeight: "700" },
  plus: { borderWidth: 1, borderColor: C.purple, borderRadius: 7, paddingHorizontal: 7, paddingVertical: 2 },
  plusText: { color: C.purple, fontSize: 11, fontWeight: "800" },
  badge: {
    position: "absolute", left: 5, right: 5, bottom: 5, textAlign: "center",
    backgroundColor: "rgba(11,15,25,0.85)", color: "#fff", fontSize: 10, fontWeight: "800",
    borderRadius: 6, paddingVertical: 3, overflow: "hidden", fontVariant: ["tabular-nums"],
  },
});
