// "Available on" for manga: official readers first, then stores that sell the
// volumes. Information only: the chips name the services, they don't open them.
// Everything here is official (see shared/features/readLinks.js).
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "../../context/ThemeContext.js";

export default function WhereToRead({ links }) {
  const { C } = useTheme();
  if (!links) return null;
  const { read = [], buy = [] } = links;
  if (!read.length && !buy.length) return null;

  const chips = (list) => (
    <View style={styles.wrap}>
      {list.map((l) => (
        <View key={l.site} style={[styles.chip, { borderColor: C.border, backgroundColor: C.card }]}>
          <View style={[styles.dot, { backgroundColor: l.color || C.purple }]} />
          <View>
            <Text style={{ color: C.text, fontWeight: "700", fontSize: 13 }}>{l.site}</Text>
            {l.languages?.length > 0 && (
              <Text style={{ color: C.faint, fontSize: 10, marginTop: 1 }} numberOfLines={1}>{l.languages.join(" · ")}</Text>
            )}
          </View>
        </View>
      ))}
    </View>
  );
  const head = (t) => <Text style={{ color: C.sub, fontWeight: "800", fontSize: 12, marginTop: 12, marginBottom: 6 }}>{t}</Text>;

  return (
    <View style={{ marginTop: 20 }}>
      <Text style={{ color: C.text, fontWeight: "800", fontSize: 15 }}>Available on</Text>
      {read.length > 0 && <>{head("Read officially")}{chips(read)}</>}
      {buy.length > 0 && <>{head("Buy the volumes")}{chips(buy)}</>}
      <Text style={{ color: C.faint, fontSize: 10, marginTop: 8 }}>
        Official services only. Availability depends on your country. From AniList.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
