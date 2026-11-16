// FILE: app/src/components/library/LibraryTile.js — one title in the Library grid: cover, a progress bar under it, and a line
// saying where you are (Ep 7/12 · in 5d, 23 h 30 m played, Issue 12/48...). Works for every kind.
import { View, Text, Pressable, StyleSheet } from "react-native";
import { entryLine } from "@voidpop/shared/features/entryLine";
import { useTheme } from "../../context/ThemeContext.js";
import CoverTile from "../ui/CoverTile.js";

export default function LibraryTile({ entry, width, now, onPress }) {
  const { C } = useTheme();
  const { line, ratio } = entryLine(entry, now);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${entry.item.title}. ${line}`} style={({ pressed }) => [{ width }, pressed && { opacity: 0.8 }]}>
      <CoverTile item={entry.item} width={width} height={Math.round(width * 1.45)} radius={12} />
      <View style={[s.track, { backgroundColor: C.border }]}>{ratio != null && <View style={[s.fill, { backgroundColor: C.purple, width: `${Math.max(3, ratio * 100)}%` }]} />}</View>
      <Text style={[s.title, { color: C.text }]} numberOfLines={1}>{entry.item.title}</Text>
      <Text style={[s.line, { color: C.faint }]} numberOfLines={1}>{line}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  track: { height: 5, borderRadius: 3, marginTop: 8, overflow: "hidden" },
  fill: { height: 5, borderRadius: 3 },
  title: { fontSize: 13, fontWeight: "800", marginTop: 6 },
  line: { fontSize: 11, marginTop: 2 },
});
