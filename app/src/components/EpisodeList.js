// Official episodes (thumbnail, number, title) from AniList's streaming links,
// shown as information (they don't open the streaming service). Episodes up to
// your progress are marked watched.
import { View, Text, Image, ScrollView, StyleSheet } from "react-native";
import { useTheme } from "../context/ThemeContext.js";

export default function EpisodeList({ episodes = [], progress = 0 }) {
  const { C } = useTheme();
  const styles = makeStyles(C);
  if (!episodes.length) return null;
  const site = episodes[0].site;
  return (
    <View style={{ marginTop: 20 }}>
      <Text style={styles.title}>Episodes</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
        {episodes.map((e, i) => {
          const watched = e.number != null && e.number <= progress;
          return (
            <View key={e.url} style={styles.card}
              accessibilityLabel={`Episode ${e.number ?? i + 1}${e.name ? `, ${e.name}` : ""}${watched ? ", watched" : ""}, on ${e.site}`}>
              {e.thumbnail ? <Image source={{ uri: e.thumbnail }} style={styles.thumb} /> : <View style={[styles.thumb, { backgroundColor: C.border }]} />}
              {watched && <View style={styles.watched}><Text style={styles.watchedText}>Watched</Text></View>}
              <Text style={styles.num}>{e.number != null ? `Episode ${e.number}` : `Episode ${i + 1}`}</Text>
              {!!e.name && <Text style={styles.name} numberOfLines={2}>{e.name}</Text>}
            </View>
          );
        })}
      </ScrollView>
      {!!site && <Text style={styles.note}>On {site}. Availability depends on your country.</Text>}
    </View>
  );
}

const makeStyles = (C) => StyleSheet.create({
  title: { color: C.text, fontWeight: "800", fontSize: 15, marginBottom: 8 },
  card: { width: 176 },
  thumb: { width: 176, height: 99, borderRadius: 8 },
  watched: { position: "absolute", top: 6, left: 6, backgroundColor: C.green, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  watchedText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  num: { color: C.faint, fontSize: 11, fontWeight: "700", marginTop: 6 },
  name: { color: C.text, fontSize: 12, fontWeight: "600", marginTop: 2 },
  note: { color: C.faint, fontSize: 10, marginTop: 6 },
});
