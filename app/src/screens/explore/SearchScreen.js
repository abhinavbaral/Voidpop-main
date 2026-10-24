// Universal search with LIVE suggestions (Netflix-style).
// As you type, matching anime and manga appear grouped.

import { useCallback, useEffect, useState } from "react";
import {
  View, Text, TextInput, SectionList, TouchableOpacity, Image, StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { fetchAniList, fetchPeople } from "@voidpop/shared/api/anilist";
import { fetchCinema } from "@voidpop/shared/api/tmdb";
import Chips from "../../components/ui/Chips.js";
import { useTheme } from "../../context/ThemeContext.js";
import { openDetail, goBackOrHome } from "../../utils/nav";
import { releaseLabel } from "@voidpop/shared/lib/format";
import { VoidmonEmpty, VoidmonLoading, VoidmonTrouble } from "../../components/brand/Voidmon.js";

// what the empty box says, by the pill that is selected
const HINTS = {
  all: "Type at least 2 characters to search.",
  anime: "Type at least 2 characters to search anime.",
  manga: "Type at least 2 characters to search manga.",
  novel: "Type at least 2 characters to search novels.",
  movie: "Type at least 2 characters to search movies.",
  tv: "Type at least 2 characters to search TV shows.",
  people: "Type at least 2 characters to search people (voice actors, directors, mangaka).",
};

function CreatorText({ item, style }) {
  const creator = item.creator;
  return creator ? <Text style={style} numberOfLines={1}>{creator}</Text> : null;
}

export default function SearchScreen({ navigation, route }) {
  const { C } = useTheme();
  const styles = makeStyles(C);
  const [q, setQ] = useState(route.params?.q || "");

  // a new search submitted from the desktop top nav
  useEffect(() => {
    if (route.params?.q) setQ(route.params.q);
  }, [route.params?.q]);
  const [sections, setSections] = useState([]);
  // idle (under 2 letters) → loading → done, or failed when AniList didn't
  // answer. "loading" starts as you type, so "No matches" never flashes up
  // while the search is still on its way.
  const [status, setStatus] = useState("idle");
  // All, or just Anime / Manga / Novels / Movies / TV / People (voice actors, directors, mangaka)
  const [kind, setKind] = useState("all");
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) {
      setSections([]);
      setStatus("idle");
      return undefined;
    }
    let alive = true;
    setStatus("loading");
    const t = setTimeout(async () => {
      const n = kind === "all" ? 5 : 20;
      const none = Promise.resolve(null);
      const [anime, manga, novels, people, movies, tv] = await Promise.allSettled([
        kind === "all" || kind === "anime" ? fetchAniList("anime", { search: query, perPage: n }) : none,
        kind === "all" || kind === "manga" ? fetchAniList("manga", { search: query, perPage: n }) : none,
        kind === "all" || kind === "novel" ? fetchAniList("novel", { search: query, perPage: n }) : none,
        kind === "all" || kind === "people" ? fetchPeople(query, n) : none,
        kind === "all" || kind === "movie" ? fetchCinema("movie", { search: query }) : none,
        kind === "all" || kind === "tv" ? fetchCinema("tv", { search: query }) : none,
      ]);
      if (!alive) return; // you kept typing; a newer search owns the screen
      const asked = [anime, manga, novels, people, movies, tv].filter((r) => r.status === "rejected" || r.value !== null);
      if (asked.every((r) => r.status === "rejected")) {
        setSections([]);
        setStatus("failed");
        return;
      }
      const items = (r) => (r.status === "fulfilled" && r.value ? r.value.items.slice(0, n) : []);
      const folks = people.status === "fulfilled" && people.value ? people.value.slice(0, n).map((p) => ({ ...p, person: true })) : [];
      setSections(
        [
          { title: "Anime", data: items(anime) },
          { title: "Manga", data: items(manga) },
          { title: "Novels", data: items(novels) },
          { title: "Movies", data: items(movies) },
          { title: "TV", data: items(tv) },
          { title: "People", data: folks },
        ].filter((s) => s.data.length > 0)
      );
      setStatus("done");
    }, 350);
    return () => { alive = false; clearTimeout(t); };
  }, [q, attempt, kind]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBackOrHome(navigation)}>
          <Text style={{ color: C.purple, fontSize: 15 }}>←</Text>
        </TouchableOpacity>
        <TextInput
          value={q}
          onChangeText={setQ}
          autoFocus
          placeholder="Search anime, manga, novels, movies, TV..."
          placeholderTextColor={C.faint}
          style={styles.input}
        />
      </View>
      <View style={{ paddingHorizontal: 14, paddingBottom: 6 }}>
        <Chips value={kind} onChange={setKind}
          options={[{ key: "all", label: "All" }, { key: "anime", label: "Anime" }, { key: "manga", label: "Manga" }, { key: "novel", label: "Novels" }, { key: "movie", label: "Movies" }, { key: "tv", label: "TV" }, { key: "people", label: "People" }]} />
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => (item.person ? `person-${item.id}` : `${item.segment}-${item.id}`)}
        keyboardShouldPersistTaps="handled"
        renderSectionHeader={({ section }) => (
          <Text style={styles.section}>{section.title}</Text>
        )}
        renderItem={({ item }) => item.person ? (
          <TouchableOpacity style={styles.row} onPress={() => navigation.navigate("Person", { id: item.id })}>
            {item.image ? <Image source={{ uri: item.image }} style={[styles.thumb, { borderRadius: 999, width: 46, height: 46 }]} />
              : <View style={[styles.thumb, { backgroundColor: C.card, borderRadius: 999, width: 46, height: 46 }]} />}
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle} numberOfLines={1}>{item.name}</Text>
              {!!item.native && <Text style={styles.rowCreator} numberOfLines={1}>{item.native}</Text>}
              <Text style={styles.rowSub} numberOfLines={1}>{item.occupations.join(" · ") || "Person"}</Text>
            </View>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.row}
            onPress={() => openDetail(navigation, item)}
          >
            {item.image ? (
              <Image source={{ uri: item.image }} style={styles.thumb} />
            ) : (
              <View style={[styles.thumb, { backgroundColor: C.card }]} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
              <CreatorText item={item} style={styles.rowCreator} />
              <Text style={styles.rowSub}>
                {item.genre} · {releaseLabel(item)}
              </Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          status === "loading" ? <VoidmonLoading text="Searching…" style={{ marginTop: 28 }} />
          : status === "failed" ? <VoidmonTrouble what="Search" onRetry={retry} navigation={navigation} />
          : status === "done" ? <VoidmonEmpty pose="peeking" text="No matches found. Try the English or Japanese title." />
          : <Text style={styles.hint}>{HINTS[kind] || HINTS.all}</Text>
        }
        contentContainerStyle={{ paddingBottom: 30 }}
      />
    </SafeAreaView>
  );
}

const makeStyles = (C) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 14, paddingTop: 8,
  },
  input: {
    flex: 1, height: 42, borderRadius: 12, borderWidth: 1,
    borderColor: C.border, backgroundColor: C.card,
    color: C.text, paddingHorizontal: 14,
  },
  section: {
    color: C.purple, fontWeight: "800", fontSize: 13,
    paddingHorizontal: 14, paddingTop: 16, paddingBottom: 6,
    backgroundColor: C.bg,
  },
  row: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 14, paddingVertical: 7,
  },
  thumb: { width: 42, height: 60, borderRadius: 6 },
  rowTitle: { color: C.text, fontSize: 14, fontWeight: "600" },
  rowCreator: { color: C.orange, fontSize: 11, fontWeight: "600", marginTop: 2 },
  rowSub: { color: C.faint, fontSize: 11, marginTop: 2 },
  hint: { color: C.faint, textAlign: "center", marginTop: 40, paddingHorizontal: 30, fontSize: 13 },
});
