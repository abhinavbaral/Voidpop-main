// YOUR LIBRARY — laid out like Spotify's: the VoidPop logo, "Your Library" and a search
// icon on top; Anime / Manga / Novels / Movies / TV as chips; then your playlists.
//   - Every status that has titles in it is a playlist made by VoidPop (Watching, Completed,
//     Plan to Watch…), with one cover: the show you touched last. A status with no titles
//     isn't shown. Tap one to open its titles (PlaylistScreen).
//   - The search icon searches your titles in the chosen kind, across every playlist, like it always has.
//   - "Recents" sorts the playlists; the icon on the right switches between a list and a grid.
// Saved on this phone. Airing anime get a fresh next-episode countdown when this opens.

import { useCallback, useMemo, useState } from "react";
import { View, Text, TextInput, FlatList, StyleSheet, TouchableOpacity, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "@voidpop/shared/backend/AuthContext";
import { getLibrary, getLibraryAll, statusesFor, LIBRARY_KINDS as KINDS, kindOf, kindsMissing, fillKinds, noteAiring } from "@voidpop/shared/backend/store";
import { buildPlaylists, searchEntries, PLAYLIST_SORTS } from "@voidpop/shared/features/playlists";
import { fetchNextEpisodes, fetchKinds } from "@voidpop/shared/api/anilist";
import { useSettings } from "@voidpop/shared/backend/SettingsContext";
import { useTheme } from "../../context/ThemeContext.js";
import { openDetail } from "../../utils/nav";
import Brand from "../../components/brand/Brand.js";
import Chips from "../../components/ui/Chips.js";
import Icon from "../../components/ui/Icon.js";
import OptionsSheet from "../../components/ui/OptionsSheet.js";
import LibraryCard from "../../components/library/LibraryCard.js";
import PlaylistItem from "../../components/library/PlaylistItem.js";
import { VoidmonEmpty } from "../../components/brand/Voidmon.js";

export default function LibraryScreen({ navigation }) {
  const { C } = useTheme();
  const styles = makeStyles(C);
  const { width } = useWindowDimensions();
  const { settings, update } = useSettings();
  const grid = settings.libraryHome === "grid";
  const columns = width >= 900 ? 4 : width >= 600 ? 3 : 2;
  const tile = (width - 28 - 14 * (columns - 1)) / columns;
  const { user } = useAuth();
  const [kind, setKind] = useState("anime");
  const [entries, setEntries] = useState([]);
  const [sort, setSort] = useState("recents");
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [sheet, setSheet] = useState(null); // "sort"

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
  const playlists = useMemo(() => buildPlaylists(kindEntries, statusesFor(current.segment), sort), [kindEntries, current.segment, sort]);
  const results = useMemo(() => searchEntries(kindEntries, query), [kindEntries, query]);
  const q = query.trim();

  const open = (p) => navigation.navigate("Playlist", { kind, ref: p.ref, title: p.name });

  const toggleSearch = () => { setSearching((s) => !s); setQuery(""); };
  const sortLabel = PLAYLIST_SORTS.find((s) => s.key === sort)?.label;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <View style={styles.logo}><Brand size={18} /></View>
        <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>Your Library</Text>
        <TouchableOpacity onPress={toggleSearch} hitSlop={10} accessibilityRole="button" accessibilityLabel={searching ? "Close search" : "Search your library"}>
          <Icon name={searching ? "close" : "search"} size={24} color={C.text} />
        </TouchableOpacity>
      </View>

      <View style={{ paddingHorizontal: 14 }}>
        <Chips options={KINDS.map((k) => ({ key: k.key, label: k.label }))} value={kind} onChange={(k) => { setKind(k); setQuery(""); }} />
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
          <View style={styles.sortRow}>
            <TouchableOpacity onPress={() => setSheet("sort")} style={styles.sortBtn} accessibilityRole="button" accessibilityLabel={`Sort playlists: ${sortLabel}`}>
              <Icon name="sort" size={20} color={C.text} />
              <Text style={styles.sortText}>{sortLabel}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => update("libraryHome", grid ? "list" : "grid")} hitSlop={10} accessibilityRole="button"
              accessibilityLabel={grid ? "Show as a list" : "Show as a grid"}>
              <Icon name={grid ? "list" : "browse"} size={22} color={C.text} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={playlists}
            key={grid ? `grid-${columns}` : "list"}
            numColumns={grid ? columns : 1}
            keyExtractor={(p) => p.id}
            columnWrapperStyle={grid ? { gap: 14, paddingHorizontal: 14, marginBottom: 16 } : undefined}
            contentContainerStyle={{ paddingBottom: 30, paddingTop: grid ? 4 : 0 }}
            renderItem={({ item: p }) => <PlaylistItem playlist={p} kind={kind} grid={grid} width={tile} onPress={() => open(p)} />}
            ListEmptyComponent={
              <VoidmonEmpty pose="peeking" text={`Your ${current.label} library is empty. Add a title from Explore${current.segment === "movie" || current.segment === "tv" ? "" : " or Search"} and it shows up here.`} />
            }
          />
        </>
      )}

      <OptionsSheet
        visible={sheet === "sort"}
        title="Sort playlists by"
        options={PLAYLIST_SORTS.map((s) => ({ key: s.key, label: s.key === sort ? `${s.label}  (now)` : s.label }))}
        onPick={(k) => { setSort(k); setSheet(null); }}
        onClose={() => setSheet(null)}
      />
    </SafeAreaView>
  );
}

const makeStyles = (C) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 18, paddingHorizontal: 14, paddingTop: 8, paddingBottom: 6 },
  logo: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  title: { flex: 1, color: C.text, fontSize: 24, fontWeight: "900" },
  search: { marginHorizontal: 14, marginTop: 10, height: 42, borderRadius: 10, borderWidth: 1, borderColor: C.border, backgroundColor: C.card, color: C.text, paddingHorizontal: 12, fontSize: 15 },
  sortRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 12 },
  sortBtn: { flexDirection: "row", alignItems: "center", gap: 8 },
  sortText: { color: C.text, fontWeight: "700", fontSize: 14 },
});
