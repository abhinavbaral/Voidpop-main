// "Links": everything AniList lists for a title besides streaming services
// (those are under Where to watch): the official site, social accounts, and
// the title's AniList / MyAnimeList pages. Each chip opens in the browser
// (or that site's app, if installed).
import { View, Text, TouchableOpacity, Linking, StyleSheet } from "react-native";
import { useTheme } from "../context/ThemeContext.js";

function Group({ label, links, C }) {
  if (!links?.length) return null;
  return (
    <View style={{ marginTop: 8 }}>
      <Text style={{ color: C.faint, fontSize: 11, fontWeight: "700", marginBottom: 6 }}>{label}</Text>
      <View style={styles.wrap}>
        {links.map((l) => (
          <TouchableOpacity
            key={l.url}
            onPress={() => Linking.openURL(l.url).catch(() => {})}
            accessibilityRole="link"
            accessibilityLabel={`${l.site}${l.language ? `, ${l.language}` : ""}. Opens outside the app`}
            style={[styles.chip, { borderColor: C.border, backgroundColor: C.card }]}
          >
            <View style={[styles.dot, { backgroundColor: l.color || C.purple }]} />
            <Text style={{ color: C.text, fontWeight: "700", fontSize: 13 }}>{l.site}</Text>
            {l.language && l.language !== "English" && (
              <Text style={{ color: C.faint, fontSize: 10 }}>{l.language}</Text>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

export default function TitleLinks({ links }) {
  const { C } = useTheme();
  if (!links) return null;
  const { official = [], social = [], databases = [] } = links;
  if (!official.length && !social.length && !databases.length) return null;
  return (
    <View style={{ marginTop: 20 }}>
      <Text style={{ color: C.text, fontWeight: "800", fontSize: 15 }}>Links</Text>
      <Group label="Official" links={official} C={C} />
      <Group label="Social" links={social} C={C} />
      <Group label="Databases" links={databases} C={C} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
