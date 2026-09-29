// "Where to read" for manga: official readers first, then stores that sell the
// volumes. When AniList lists no reader, search buttons for the likeliest
// official services. Everything here is official (see shared/readLinks.js).
import { View, Text, TouchableOpacity, Linking, StyleSheet } from "react-native";
import { useTheme } from "../context/ThemeContext.js";

export default function WhereToRead({ links }) {
  const { C } = useTheme();
  if (!links) return null;
  const { read = [], buy = [], search = [] } = links;
  if (!read.length && !buy.length && !search.length) return null;

  const chips = (list, hint) => (
    <View style={styles.wrap}>
      {list.map((l) => (
        <TouchableOpacity key={l.site} onPress={() => Linking.openURL(l.url).catch(() => {})} accessibilityRole="link"
          accessibilityLabel={`${hint ? `${hint} ` : ""}${l.site}`}
          style={[styles.chip, { borderColor: C.border, backgroundColor: C.card }]}>
          <View style={[styles.dot, { backgroundColor: l.color || C.purple }]} />
          <View>
            <Text style={{ color: C.text, fontWeight: "700", fontSize: 13 }}>{l.site}</Text>
            {l.languages?.length > 0 && (
              <Text style={{ color: C.faint, fontSize: 10, marginTop: 1 }} numberOfLines={1}>{l.languages.join(" · ")}</Text>
            )}
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
  const head = (t) => <Text style={{ color: C.sub, fontWeight: "800", fontSize: 12, marginTop: 12, marginBottom: 6 }}>{t}</Text>;

  return (
    <View style={{ marginTop: 20 }}>
      <Text style={{ color: C.text, fontWeight: "800", fontSize: 15 }}>Where to read</Text>
      {read.length > 0 && <>{head("Read officially")}{chips(read)}</>}
      {search.length > 0 && (
        <>
          {head("Not listed on AniList yet. Search on:")}
          {chips(search, "Search")}
        </>
      )}
      {buy.length > 0 && <>{head("Buy the volumes")}{chips(buy)}</>}
      <Text style={{ color: C.faint, fontSize: 10, marginTop: 8 }}>
        Official services only. Availability depends on your country. Links from AniList.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
