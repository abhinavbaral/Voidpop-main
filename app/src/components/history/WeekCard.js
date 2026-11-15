// FILE: app/src/components/history/WeekCard.js — History's "This week" card: how much you marked in the last 7 days, and a
// small bar for each day. Numbers come from shared/features/summaries.js.
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "../../context/ThemeContext.js";

const BAR_MAX = 56;

export default function WeekCard({ week }) {
  const { C } = useTheme();
  const peak = Math.max(1, ...week.days.map((d) => d.count));
  return (
    <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]} accessible accessibilityLabel={`This week: ${week.total} marked across ${week.titles} titles`}>
      <View style={{ flex: 1 }}>
        <Text style={[s.label, { color: C.purple }]}>THIS WEEK</Text>
        <Text style={[s.big, { color: C.text }]}>{week.total} marked</Text>
        <Text style={{ color: C.faint, fontSize: 12, marginTop: 2 }}>across {week.titles} {week.titles === 1 ? "title" : "titles"}</Text>
      </View>
      <View style={s.bars}>
        {week.days.map((d, i) => (
          <View key={i} style={s.col}>
            <View style={[s.bar, { height: Math.max(4, (d.count / peak) * BAR_MAX), backgroundColor: d.count ? C.purple : C.border, opacity: d.today || !d.count ? 1 : 0.7 }]} />
            <Text style={{ color: d.today ? C.text : C.faint, fontSize: 9, fontWeight: "700", marginTop: 4 }}>{d.label[0]}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "flex-end", borderRadius: 16, borderWidth: 1, padding: 16, marginHorizontal: 14, marginBottom: 6 },
  label: { fontSize: 11, fontWeight: "800", letterSpacing: 1.2 },
  big: { fontSize: 26, fontWeight: "900", marginTop: 2 },
  bars: { flexDirection: "row", alignItems: "flex-end", gap: 6 },
  col: { alignItems: "center", width: 14 },
  bar: { width: 12, borderRadius: 4 },
});
