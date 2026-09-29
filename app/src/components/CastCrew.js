// Characters (with their Japanese voice actor), staff and themes for a title,
// from AniList. Themes are AniList's non-spoiler tags that fit the title well.
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { useTheme } from "../context/ThemeContext.js";

export default function CastCrew({ characters = [], staff = [], themes = [], segment, navigation }) {
  const openPerson = (p) => p?.id && navigation?.navigate("Person", { id: p.id, name: p.name });
  const { C } = useTheme();
  const styles = makeStyles(C);
  if (!characters.length && !staff.length && !themes.length) return null;
  const face = (p, round) => (p?.image
    ? <Image source={{ uri: p.image }} style={round ? styles.round : styles.face} />
    : <View style={[round ? styles.round : styles.face, { backgroundColor: C.border }]} />);
  return (
    <View style={{ marginTop: 20, gap: 18 }}>
      {themes.length > 0 && (
        <View>
          <Text style={styles.title}>Themes</Text>
          <View style={styles.wrap}>
            {themes.map((t) => (
              <View key={t.name} style={styles.chip}><Text style={styles.chipText}>{t.name}</Text></View>
            ))}
          </View>
        </View>
      )}
      {characters.length > 0 && (
        <View>
          <Text style={styles.title}>{segment === "anime" ? "Characters and voice actors" : "Characters"}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {characters.map((c) => (
              <View key={c.id} style={styles.card}>
                {face(c)}
                <Text style={styles.name} numberOfLines={2}>{c.name}</Text>
                <Text style={styles.role}>{c.role}</Text>
                {c.voice && (
                  <TouchableOpacity style={styles.voice} onPress={() => openPerson(c.voice)} accessibilityRole="link"
                    accessibilityLabel={`${c.voice.name}, voice of ${c.name}. See their other roles`}>
                    {face(c.voice, true)}
                    <Text style={styles.voiceName} numberOfLines={2}>{c.voice.name}</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </ScrollView>
          {segment === "anime" && <Text style={styles.note}>Japanese voice cast. Tap a voice actor to see their other roles.</Text>}
        </View>
      )}
      {staff.length > 0 && (
        <View>
          <Text style={styles.title}>Staff</Text>
          {staff.map((s, i) => (
            <TouchableOpacity key={`${s.id}-${i}`} style={styles.staffRow} onPress={() => openPerson(s)} accessibilityRole="link">
              {face(s, true)}
              <Text style={styles.staffName} numberOfLines={1}>{s.name}</Text>
              <Text style={styles.staffRole} numberOfLines={1}>{s.role}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const makeStyles = (C) => StyleSheet.create({
  title: { color: C.text, fontWeight: "800", fontSize: 15, marginBottom: 8 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { borderWidth: 1, borderColor: C.border, backgroundColor: C.card, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  chipText: { color: C.sub, fontSize: 12, fontWeight: "600" },
  card: { width: 96 },
  face: { width: 96, height: 128, borderRadius: 10 },
  round: { width: 28, height: 28, borderRadius: 14 },
  name: { color: C.text, fontSize: 12, fontWeight: "700", marginTop: 6 },
  role: { color: C.faint, fontSize: 10, marginTop: 1 },
  voice: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  voiceName: { color: C.sub, fontSize: 10, flex: 1 },
  note: { color: C.faint, fontSize: 10, marginTop: 6 },
  staffRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  staffName: { color: C.text, fontSize: 13, fontWeight: "600", flex: 1 },
  staffRole: { color: C.faint, fontSize: 12, maxWidth: "45%" },
});
