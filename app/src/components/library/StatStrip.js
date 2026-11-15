// FILE: app/src/components/library/StatStrip.js — Library's totals strip: titles, finished, and added this year, for the chosen kind.
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "../../context/ThemeContext.js";

export default function StatStrip({ stats }) {
  const { C } = useTheme();
  const cell = (label, value) => (
    <View style={{ flex: 1 }}>
      <Text style={[s.label, { color: C.purple }]}>{label}</Text>
      <Text style={[s.value, { color: C.text }]}>{value}</Text>
    </View>
  );
  return (
    <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]} accessible accessibilityLabel={`${stats.titles} titles, ${stats.done} finished, ${stats.thisYear} added this year`}>
      {cell("TITLES", stats.titles)}
      {cell("FINISHED", stats.done)}
      {cell("THIS YEAR", stats.thisYear)}
    </View>
  );
}

const s = StyleSheet.create({
  card: { flexDirection: "row", borderRadius: 16, borderWidth: 1, paddingVertical: 14, paddingHorizontal: 16, marginHorizontal: 14, marginTop: 12 },
  label: { fontSize: 11, fontWeight: "800", letterSpacing: 1.2 },
  value: { fontSize: 28, fontWeight: "900", marginTop: 2 },
});
