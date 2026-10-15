// One followed show: poster, title (+ Japanese title), next episode with a big
// DAY / HOURS / MINS / SECS countdown, and your pending episodes with +1.
import { View, Text, Image, TouchableOpacity, StyleSheet } from "react-native";
import { countdownParts, dayLabel, airTime } from "@voidpop/shared/lib/format";
import { useTheme } from "../../context/ThemeContext.js";

const STATUS = { plan: "Plan to Watch", onhold: "On Hold" };

export default function CountdownCard({ show, now, clock24, onPlus, onOpen, width }) {
  const { C } = useTheme();
  const styles = makeStyles(C);
  const { item, next, pending, delay, entry } = show;
  const parts = next ? countdownParts(next.airingAt, now) : null;
  return (
    <View style={[styles.card, width ? { width } : null]}>
      <TouchableOpacity onPress={() => onOpen(item)}>
        {item.image ? <Image source={{ uri: item.image }} style={styles.poster} /> : <View style={styles.poster} />}
      </TouchableOpacity>
      <View style={{ flex: 1, minWidth: 0 }}>
        <TouchableOpacity onPress={() => onOpen(item)}>
          <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
          {!!item.altTitle && <Text style={styles.alt} numberOfLines={1}>{item.altTitle}</Text>}
        </TouchableOpacity>
        {next ? (
          <>
            <View style={styles.epRow}>
              <Text style={styles.ep}>Episode {next.episode}{item.episodes ? <Text style={{ color: C.faint }}> of {item.episodes}</Text> : null}</Text>
              {!!STATUS[entry.status] && <Text style={styles.status}>{STATUS[entry.status]}</Text>}
            </View>
            <View style={styles.boxes}>
              {[[parts.d, parts.d === 1 ? "DAY" : "DAYS"], [parts.h, "HOURS"], [parts.m, "MINS"], [parts.s, "SECS"]].map(([n, label]) => (
                <View key={label} style={{ alignItems: "center", flex: 1 }}>
                  <Text style={[styles.num, parts.d === 0 && { color: C.orange }]}>{n}</Text>
                  <Text style={styles.unit}>{label}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.when} numberOfLines={2}>
              {dayLabel(next.airingAt, now)}, {airTime(next.airingAt, clock24)}
              {delay ? <Text style={{ color: C.rose, fontWeight: "700" }}> · Delayed, was {dayLabel(delay.from, now)}</Text> : null}
            </Text>
          </>
        ) : (
          <Text style={[styles.ep, { marginTop: 6 }]}>No date for the next episode yet</Text>
        )}
        {entry.status === "watching" && (
          <View style={styles.foot}>
            {pending > 0 ? (
              <>
                <Text style={styles.pending}>{pending} pending</Text>
                <TouchableOpacity onPress={() => onPlus(entry)} style={styles.plus} hitSlop={6}
                  accessibilityLabel={`Watched episode ${(entry.progress || 0) + 1} of ${item.title}`}>
                  <Text style={styles.plusText}>+1</Text>
                </TouchableOpacity>
              </>
            ) : (
              <Text style={styles.caught}>Caught up ✓</Text>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const makeStyles = (C) => StyleSheet.create({
  card: { flexDirection: "row", gap: 12, backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 10 },
  poster: { width: 84, aspectRatio: 2 / 3, borderRadius: 10, backgroundColor: C.border },
  title: { color: C.text, fontWeight: "800", fontSize: 15, lineHeight: 19 },
  alt: { color: C.sub, fontSize: 12, marginTop: 2 },
  epRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6, flexWrap: "wrap" },
  ep: { color: C.sub, fontWeight: "700", fontSize: 13 },
  status: { color: C.faint, fontSize: 10, fontWeight: "800", borderWidth: 1, borderColor: C.border, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 },
  boxes: { flexDirection: "row", marginTop: 6 },
  num: { color: C.text, fontSize: 22, fontWeight: "900", fontVariant: ["tabular-nums"] },
  unit: { color: C.faint, fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  when: { color: C.faint, fontSize: 11, marginTop: 4 },
  foot: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  pending: { color: C.orange, fontSize: 11, fontWeight: "800" },
  plus: { borderWidth: 1, borderColor: C.purple, borderRadius: 9, paddingHorizontal: 11, paddingVertical: 5 },
  plusText: { color: C.purple, fontWeight: "800", fontSize: 13 },
  caught: { color: C.green, fontSize: 11, fontWeight: "800" },
});
