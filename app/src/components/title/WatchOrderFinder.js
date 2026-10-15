// Browse → Watch order: search any anime and see its whole franchise in watch
// order, first entry to last, whichever entry you searched (search "Attack on
// Titan Season 3" and you still get Season 1, Season 2, OVAs, Season 3, …,
// the movies). Uses the same watch order as every anime's page.
import { useEffect, useState } from "react";
import { View, Text, TextInput, Image, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { fetchAniList } from "@voidpop/shared/api/anilist";
import { useTheme } from "../../context/ThemeContext.js";
import { WatchOrder } from "./TitleExtras.js";
import { VoidmonEmpty, VoidmonLoading } from "../brand/Voidmon.js";

export default function WatchOrderFinder({ navigation }) {
  const { C } = useTheme();
  const styles = makeStyles(C);
  const [q, setQ] = useState("");
  const [results, setResults] = useState(null); // null = nothing typed yet
  const [picked, setPicked] = useState(null);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) { setResults(null); return undefined; }
    let alive = true;
    setResults("loading");
    const t = setTimeout(() => {
      fetchAniList("anime", { search: query, perPage: 8 })
        .then((r) => alive && setResults(r.items))
        .catch(() => alive && setResults([]));
    }, 350);
    return () => { alive = false; clearTimeout(t); };
  }, [q]);

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <TextInput value={q} onChangeText={(t) => { setQ(t); setPicked(null); }} placeholder="Search any anime, any season…"
        placeholderTextColor={C.faint} style={styles.input} returnKeyType="search" />
      {picked ? (
        <>
          <TouchableOpacity onPress={() => setPicked(null)} style={{ marginTop: 10 }} accessibilityRole="button">
            <Text style={{ color: C.purple, fontWeight: "700" }}>‹ Back to results</Text>
          </TouchableOpacity>
          <Text style={[styles.note, { marginTop: 6 }]}>The whole series from the start, whichever part you picked:</Text>
          <WatchOrder key={picked.id} item={picked} navigation={navigation} finder />
        </>
      ) : results === null ? (
        <VoidmonEmpty pose="asking" style={{ marginTop: 20 }}
          text="Type an anime, even a later season or a movie. You'll get its whole watch order, from the very first entry to the last." />
      ) : results === "loading" ? (
        <VoidmonLoading text="Searching…" style={{ marginTop: 20 }} />
      ) : !results.length ? (
        <VoidmonEmpty pose="peeking" text="No anime found. Try the English or Japanese title." style={{ marginTop: 20 }} />
      ) : (
        results.map((it) => (
          <TouchableOpacity key={it.id} onPress={() => setPicked(it)} style={styles.row} accessibilityRole="button"
            accessibilityLabel={`Watch order for ${it.title}`}>
            {it.image ? <Image source={{ uri: it.image }} style={styles.thumb} /> : <View style={[styles.thumb, { backgroundColor: C.border }]} />}
            <View style={{ flex: 1 }}>
              <Text style={styles.title} numberOfLines={2}>{it.title}</Text>
              <Text style={styles.note}>{[it.format?.replace("_", " "), it.date?.slice(0, 4)].filter(Boolean).join(" · ")}</Text>
            </View>
            <Text style={{ color: C.purple, fontWeight: "800" }}>Order ›</Text>
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
}

const makeStyles = (C) => StyleSheet.create({
  input: { height: 42, borderRadius: 12, borderWidth: 1, borderColor: C.border, backgroundColor: C.card, color: C.text, paddingHorizontal: 14, marginTop: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border },
  thumb: { width: 42, height: 60, borderRadius: 6 },
  title: { color: C.text, fontWeight: "700", fontSize: 14 },
  note: { color: C.faint, fontSize: 12, marginTop: 2 },
});
