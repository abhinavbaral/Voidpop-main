// "Available on": the official services AniList lists for this anime.
// Information only: the chips name the services, they don't open them.
// YouTube appears only for a licensed channel ("On YouTube · Muse Asia").
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "../../context/ThemeContext.js";

export default function WhereToWatch({ links = [], youtube = [], segment }) {
  const { C } = useTheme();
  if (!links.length && !youtube.length) return null;
  return (
    <View style={{ marginTop: 20 }}>
      <Text style={{ color: C.text, fontWeight: "800", fontSize: 15, marginBottom: 8 }}>
        Available on
      </Text>
      <View style={styles.wrap}>
        {youtube.map((channel) => (
          <View key={`yt-${channel}`} style={[styles.chip, { borderColor: C.border, backgroundColor: C.card }]}>
            <View style={[styles.dot, { backgroundColor: "#ff0000" }]} />
            <View>
              <Text style={{ color: C.text, fontWeight: "700", fontSize: 13 }}>YouTube</Text>
              <Text style={{ color: C.faint, fontSize: 10, marginTop: 1 }} numberOfLines={1}>{channel}</Text>
            </View>
          </View>
        ))}
        {links.map((l) => (
          <View key={l.site} style={[styles.chip, { borderColor: C.border, backgroundColor: C.card }]}>
            <View style={[styles.dot, { backgroundColor: l.color || C.purple }]} />
            <View>
              <Text style={{ color: C.text, fontWeight: "700", fontSize: 13 }}>{l.site}</Text>
              {l.languages.length > 0 && (
                <Text style={{ color: C.faint, fontSize: 10, marginTop: 1 }} numberOfLines={1}>{l.languages.join(" · ")}</Text>
              )}
            </View>
          </View>
        ))}
      </View>
      <Text style={{ color: C.faint, fontSize: 10, marginTop: 6 }}>
        {youtube.length > 0 ? "Availability depends on your country. Dubs are not included." : "Availability depends on your country."}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
