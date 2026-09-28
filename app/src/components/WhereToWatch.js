// "Where to watch" / "Where to read": official services from AniList.
// Tapping one opens that service's page (its app, if installed).
import { View, Text, TouchableOpacity, Linking, StyleSheet } from "react-native";
import { useTheme } from "../context/ThemeContext.js";

export default function WhereToWatch({ links, segment }) {
  const { C } = useTheme();
  if (!links?.length) return null;
  return (
    <View style={{ marginTop: 20 }}>
      <Text style={{ color: C.text, fontWeight: "800", fontSize: 15, marginBottom: 8 }}>
        {segment === "manga" ? "Where to read" : "Where to watch"}
      </Text>
      <View style={styles.wrap}>
        {links.map((l) => (
          <TouchableOpacity
            key={l.site}
            onPress={() => Linking.openURL(l.url)}
            accessibilityRole="link"
            style={[styles.chip, { borderColor: C.border, backgroundColor: C.card }]}
          >
            <View style={[styles.dot, { backgroundColor: l.color || C.purple }]} />
            <View>
              <Text style={{ color: C.text, fontWeight: "700", fontSize: 13 }}>{l.site}</Text>
              {l.languages.length > 0 && (
                <Text style={{ color: C.faint, fontSize: 10, marginTop: 1 }} numberOfLines={1}>{l.languages.join(" · ")}</Text>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={{ color: C.faint, fontSize: 10, marginTop: 6 }}>
        Availability depends on your country. Links from AniList.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
