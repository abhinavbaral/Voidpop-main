// YOUR LIBRARY — the VoidPop logo, "Library" and a search icon on top; the kinds as chips (Anime, Manga, Novels, Movies, TV,
// Games, Comics); a totals strip; then one tab per status that has titles (Watching, Completed, Plan to Watch…) over a grid of
// covers, each with a progress bar and where you are (Ep 7/12 · in 5d, 23 h 30 m played, Issue 12/48).
//   - The search icon searches your titles in the chosen kind, across every status.
// Saved on this phone. Airing anime get a fresh next-episode countdown when this opens.

import { useCallback, useMemo, useState } from "react";
import { View, Text, TextInput, FlatList, ScrollView, StyleSheet, TouchableOpacity, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "@voidpop/shared/backend/AuthContext";
import { getLibrary, getLibraryAll, statusesFor, LIBRARY_KINDS as KINDS, kindOf, kindsMissing, fillKinds, noteAiring } from "@voidpop/shared/backend/store";
import { playlistEntries, searchEntries } from "@voidpop/shared/features/playlists";
import { libraryStats } from "@voidpop/shared/features/summaries";
import { fetchNextEpisodes, fetchKinds } from "@voidpop/shared/api/anilist";
import { useNow } from "@voidpop/shared/lib/useNow";
import { useTheme } from "../../context/ThemeContext.js";
import { openDetail } from "../../utils/nav";
import Brand from "../../components/brand/Brand.js";
import Chips from "../../components/ui/Chips.js";
import Icon from "../../components/ui/Icon.js";
import LibraryCard from "../../components/library/LibraryCard.js";
import LibraryTile from "../../components/library/LibraryTile.js";
import StatStrip from "../../components/library/StatStrip.js";
import { VoidmonEmpty } from "../../components/brand/Voidmon.js";

export default function LibraryScreen({ navigation }) {
  const { C } = useTheme();
  const styles = makeStyles(C);
  const { width } = useWindowDimensions();
  const now = useNow(60000);
  const columns = width >= 900 ? 5 : width >= 600 ? 4 : 3;
  const tile = Math.floor((width - 28 - 14 * (columns - 1)) / columns);
  const { user } = useAuth();
  const [kind, setKind] = useState("anime");
  const [entries, setEntries] = useState([]);
  const [tab, setTab] = useState(null); // the status shown; null = the first one that has titles
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");

  const reload = useCallback(async () => {
    setEntries(Object.values(await getLibraryAll().catch(() => ({}))));
  }, []);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        await reload();
        // saved items are snapshots: refresh "next episode" for anime still airing (also spots delays)
        const lib = Object.values(await getLibrary(user));
        const airing = lib.filter((e) => e.item.segment === "anime" && !e.item.finished && e.status !== "completed");
        const fresh = await fetchNextEpisodes(airing.map((e) => e.item.id)).catch(() => ({}));
        if (alive && (await noteAiring(fresh))) reload();
        // manga saved without a format: look it up once so novels move to Novels
        const missing = await kindsMissing();
        if (alive && missing.length) {
          const found = await fetchKinds(missing.map((k) => k.split(":")[1])).catch(() => ({}));
          if (alive && (await fillKinds(found))) reload();
        }
      })();
      return () => { alive = false; };
    }, [user, reload])
  );

  const current = KINDS.find((k) => k.key === kind);
  const kindEntries = useMemo(() => entries.filter((e) => kindOf(e.item) === kind), [entries, kind]);
  // one tab per status that has titles, in the usual status order
  const tabs = useMemo(() => statusesFor(current.segment).map((s) => ({ ...s, count: playlistEntries(kindEntries, s.key).length })).filter((t) => t.count > 0), [kindEntries, current.segment]);
  const activeTab = tabs.find((t) => t.key === tab)?.key || tabs[0]?.key || null;
  const shown = useMemo(
    () => (activeTab ? playlistEntries(kindEntries, activeTab).sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""))) : []),
    [kindEntries, activeTab],
  );
  const results = useMemo(() => searchEntries(kindEntries, query), [kindEntries, query]);
  const stats = useMemo(() => libraryStats(kindEntries), [kindEntries]);
  const q = query.trim();

  const toggleSearch = () => { setSearching((s) => !s); setQuery(""); };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <View style={styles.logo}><Brand size={18} /></View>
        <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>Library</Text>
        <TouchableOpacity onPress={toggleSearch} hitSlop={10} accessibilityRole="button" accessibilityLabel={searching ? "Close search" : "Search your library"}>
          <Icon name={searching ? "close" : "search"} size={24} color={C.text} />
        </TouchableOpacity>
      </View>

      <View style={{ paddingHorizontal: 14 }}>
        <Chips options={KINDS.map((k) => ({ key: k.key, label: k.label }))} value={kind} onChange={(k) => { setKind(k); setTab(null); setQuery(""); }} />
      </View>

      {searching && (
        <TextInput value={query} onChangeText={setQuery} autoFocus placeholder={`Search in ${current.label}`} placeholderTextColor={C.faint}
          style={styles.search} returnKeyType="search" clearButtonMode="while-editing" accessibilityLabel={`Search in ${current.label}`} />
      )}

      {searching && q ? (
        <FlatList
          data={results}
          keyExtractor={(e) => `${e.item.segment}-${e.item.id}`}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 6, paddingBottom: 30 }}
          renderItem={({ item: entry }) => <LibraryCard entry={entry} columns={1} layout="list" onPress={() => openDetail(navigation, entry.item)} />}
          ListEmptyComponent={<VoidmonEmpty pose="peeking" text={`No ${current.label} titles match "${q}".`} />}
        />
      ) : (
        <>
          <StatStrip stats={stats} />
          <View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
              {tabs.map((t) => (
                <TouchableOpacity key={t.key} onPress={() => setTab(t.key)} accessibilityRole="tab" accessibilityState={{ selected: t.key === activeTab }}
                  style={[styles.tab, t.key === activeTab && { borderBottomColor: C.purple }]}>
                  <Text style={[styles.tabText, t.key === activeTab && { color: C.text }]}>{t.label} {t.count}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
          <FlatList
            data={shown}
            key={`grid-${columns}`}
            numColumns={columns}
            keyExtractor={(e) => `${e.item.segment}:${e.item.id}`}
            columnWrapperStyle={{ gap: 14, paddingHorizontal: 14, marginBottom: 16 }}
            contentContainerStyle={{ paddingBottom: 30, paddingTop: 14 }}
            renderItem={({ item: entry }) => <LibraryTile entry={entry} width={tile} now={now} onPress={() => openDetail(navigation, entry.item)} />}
            ListEmptyComponent={
              <VoidmonEmpty pose="peeking" text={`Your ${current.label} library is empty. Add a title from Explore${current.segment === "movie" || current.segment === "tv" || current.segment === "game" || current.segment === "comic" ? "" : " or Search"}.`} />
            }
          />
        </>
      )}
    </SafeAreaView>
  );
}

const makeStyles = (C) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 18, paddingHorizontal: 14, paddingTop: 8, paddingBottom: 6 },
  logo: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  title: { flex: 1, color: C.text, fontSize: 30, fontWeight: "900", letterSpacing: 0.6, textTransform: "uppercase" },
  search: { marginHorizontal: 14, marginTop: 10, height: 42, borderRadius: 10, borderWidth: 1, borderColor: C.border, backgroundColor: C.card, color: C.text, paddingHorizontal: 12, fontSize: 15 },
  tabs: { paddingHorizontal: 14, gap: 22, marginTop: 14 },
  tab: { paddingVertical: 10, borderBottomWidth: 3, borderBottomColor: "transparent" },
  tabText: { color: C.faint, fontSize: 14, fontWeight: "800" },
});
