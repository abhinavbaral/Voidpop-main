// "Not a score. A feeling." The community's split of Void Verdicts for a title.
// Hidden until 20 people have given one, so two votes never look like "50% Void It".
// Counts come from the VoidPop server (accounts); with no server this isn't shown, except
// for the built-in sample titles, where the numbers are labelled as sample data.
import { View, Text, StyleSheet } from "react-native";
import { communitySplit, MIN_VERDICTS } from "@voidpop/shared/features/verdictMeter";
import { VERDICTS } from "@voidpop/shared/backend/store";
import { useTheme } from "../../context/ThemeContext.js";

export default function VerdictMeter({ counts, sample, myVerdict }) {
  const { C } = useTheme();
  const styles = makeStyles(C);
  const split = communitySplit(counts || {});
  const mine = VERDICTS.find((v) => v.key === myVerdict);
  return (
    <View style={styles.box} accessibilityLabel="Void Verdict meter">
      <Text style={styles.eyebrow}>THE VOID VERDICT METER</Text>
      <Text style={styles.heading}>Not a score. A feeling.</Text>
      {split.ready ? (
        <View style={{ gap: 12, marginTop: 14 }}>
          {split.rows.map((r) => (
            <View key={r.key} style={styles.row} accessibilityLabel={`${r.label}: ${r.pct} percent`}>
              <View style={styles.labelWrap}>
                <View style={[styles.dot, { backgroundColor: r.color }]} />
                <Text style={styles.label} numberOfLines={1}>{r.label}</Text>
              </View>
              <View style={styles.track}><View style={{ width: `${r.pct}%`, height: "100%", borderRadius: 4, backgroundColor: r.color }} /></View>
              <Text style={styles.pct}>{r.pct}%</Text>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.locked}>
          <Text style={styles.lockedTitle}>{split.total} of {MIN_VERDICTS} verdicts</Text>
          <Text style={styles.small}>The split opens once {MIN_VERDICTS} people who finished or dropped it have given a verdict, so a couple of votes can’t pose as a trend.</Text>
        </View>
      )}
      {mine && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14 }}>
          <Text style={styles.small}>Your verdict:</Text>
          <View style={[styles.chip, { backgroundColor: mine.color }]}><Text style={styles.chipText}>{mine.label}</Text></View>
        </View>
      )}
      {sample && <Text style={[styles.small, { marginTop: 10 }]}>Sample data for this demo, not real people’s votes.</Text>}
    </View>
  );
}

const makeStyles = (C) => StyleSheet.create({
  box: { marginTop: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 16 },
  eyebrow: { color: C.purple, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  heading: { color: C.text, fontSize: 18, fontWeight: "800", marginTop: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  labelWrap: { width: 88, flexDirection: "row", alignItems: "center", gap: 7 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  label: { color: C.text, fontSize: 13, fontWeight: "700", flexShrink: 1 },
  track: { flex: 1, height: 8, borderRadius: 4, backgroundColor: C.border, overflow: "hidden" },
  pct: { width: 40, textAlign: "right", color: C.text, fontWeight: "800", fontSize: 13 },
  locked: { marginTop: 14, padding: 14, borderWidth: 1, borderStyle: "dashed", borderColor: C.border, borderRadius: 12, gap: 6 },
  lockedTitle: { color: C.text, fontWeight: "800", fontSize: 15 },
  small: { color: C.sub, fontSize: 12, lineHeight: 18 },
  chip: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  chipText: { color: "#fff", fontSize: 12, fontWeight: "800" },
});
