// Your verdict on a title (Voidation has no public reviews: this is yours alone):
// verdict chip, vibe tags, comment, plus Edit and Share.

import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { VERDICTS, timeAgo } from "@voidation/shared/backend/store";
import { useTheme } from "../context/ThemeContext.js";

export default function ReviewCard({ review, onEdit, onShare }) {
  const { C } = useTheme();
  const styles = makeStyles(C);
  const verdict = VERDICTS.find((v) => v.key === review.verdict);

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>Your Void Verdict</Text>
          <Text style={styles.meta}>{timeAgo(review.date)}</Text>
        </View>
        {onEdit && (
          <TouchableOpacity onPress={onEdit} style={styles.action}>
            <Text style={{ color: C.purple, fontSize: 12, fontWeight: "700" }}>Edit</Text>
          </TouchableOpacity>
        )}
        {onShare && (
          <TouchableOpacity onPress={onShare} style={styles.action}>
            <Text style={{ color: C.purple, fontSize: 12, fontWeight: "700" }}>Share</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
        {verdict && (
          <View style={[styles.chip, { backgroundColor: verdict.color }]}>
            <Text style={styles.chipText}>{verdict.label}</Text>
          </View>
        )}
        {(review.vibes || []).map((v) => (
          <View key={v} style={styles.vibeChip}>
            <Text style={styles.vibeChipText}>{v}</Text>
          </View>
        ))}
        {(review.moods || []).map((m) => (
          <View key={m} style={[styles.vibeChip, { borderColor: C.orange }]}>
            <Text style={[styles.vibeChipText, { color: C.orange }]}>{m}</Text>
          </View>
        ))}
      </View>

      {!!review.comment && <Text style={styles.comment}>{review.comment}</Text>}
    </View>
  );
}

const makeStyles = (C) => StyleSheet.create({
  card: {
    backgroundColor: C.card, borderRadius: 12, borderWidth: 1,
    borderColor: C.border, padding: 14, marginBottom: 10,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  name: { color: C.text, fontWeight: "700", fontSize: 13 },
  meta: { color: C.faint, fontSize: 11, marginTop: 1 },
  action: { padding: 6 },
  chip: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { color: "#000", fontWeight: "800", fontSize: 11 },
  vibeChip: {
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: C.border,
  },
  vibeChipText: { color: C.sub, fontSize: 11 },
  comment: { color: C.sub, fontSize: 13, marginTop: 10, lineHeight: 19 },
});
