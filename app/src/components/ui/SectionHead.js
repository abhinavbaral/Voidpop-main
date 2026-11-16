// FILE: app/src/components/ui/SectionHead.js — the heading above a row: big heavy capitals, and a pink "See more" pill when there is more.
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useTheme } from "../../context/ThemeContext.js";

export default function SectionHead({ title, onMore, right }) {
  const { C } = useTheme();
  return (
    <View style={s.head}>
      <Text style={[s.title, { color: C.text }]} accessibilityRole="header" numberOfLines={1}>{title}</Text>
      {right || null}
      {onMore ? (
        <Pressable onPress={onMore} hitSlop={8} accessibilityRole="button" accessibilityLabel={`See more: ${title}`} style={[s.more, { borderColor: C.purple }]}>
          <Text style={{ color: C.purple, fontWeight: "800", fontSize: 12 }}>See more</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, paddingHorizontal: 14, marginTop: 22, marginBottom: 10 },
  title: { flexShrink: 1, fontSize: 22, fontWeight: "900", letterSpacing: 0.6, textTransform: "uppercase" },
  more: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
});
