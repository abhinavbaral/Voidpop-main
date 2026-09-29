// LIBRARY — two separate lists, because watching and reading are different:
//   Watch list: anime  → Watching / Completed / Plan to Watch …
//   Read list:  manga (incl. manhwa, manhua, comics) → Reading / Finished / Plan to Read …
// Saved on this phone. Airing anime get a fresh next-episode countdown on open.
// Search, sort, progress on every card, and +1 on what you're watching.

import { useCallback, useMemo, useState } from "react";
import { View, Text, TextInput, FlatList, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "@voidation/shared/backend/AuthContext";
import {
  getLibrary, statusesFor, LIBRARY_LISTS as LISTS, inLibraryList as inList,
  setStatus, addReview, noteAiring, LIBRARY_SORTS, sortEntries,
  getCategories, categoriesUnlocked, bulkSetStatus, bulkCategory, bulkRemove,
} from "@voidation/shared/backend/store";
import OptionsSheet from "../components/OptionsSheet.js";
import VerdictModal from "../components/VerdictModal.js";
import { fetchNextEpisodes } from "@voidation/shared/api/anilist";
import Chips from "../components/Chips.js";
import LibraryCard from "../components/LibraryCard.js";
import { useTheme } from "../context/ThemeContext.js";
import { useGridColumns } from "../lib/layout";
import { openDetail } from "../lib/nav";


export default function LibraryScreen({ navigation }) {
  const { C } = useTheme();
  const styles = makeStyles(C);
  const cols = useGridColumns();
  const { user } = useAuth();
  const [list, setList] = useState("watch");
  const [tab, setTab] = useState("watching");
  const [entries, setEntries] = useState([]);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("updated");
  const [finishing, setFinishing] = useState(null); // item whose last episode you just marked
  const [cats, setCats] = useState([]);
  const [selected, setSelected] = useState(null); // null = not selecting; Set of keys while selecting
  const [sheet, setSheet] = useState(null); // "status" | "category"

  const reload = useCallback(async () => {
    setEntries(Object.values(await getLibrary(user).catch(() => ({}))));
    setCats((await categoriesUnlocked()) ? await getCategories() : []); // categories unlock at 500 completed anime
  }, [user]);

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
      })();
      return () => { alive = false; };
    }, [user, reload])
  );

  const keyOf = (e) => `${e.item.segment}:${e.item.id}`;
  const selecting = selected !== null;
  const toggle = (e) => setSelected((prev) => {
    const next = new Set(prev || []);
    if (next.has(keyOf(e))) next.delete(keyOf(e)); else next.add(keyOf(e));
    return next;
  });
  const bulk = async (fn) => { const keys = [...(selected || [])]; setSheet(null); setSelected(null); await fn(keys); reload(); };

  const finish = async ({ verdict, vibes, moods, comment }) => {
    await setStatus(user, finishing.segment, finishing, "completed");
    await addReview(user, finishing.segment, finishing.id, { verdict, vibes, moods, comment });
    setFinishing(null);
    reload();
  };

  const current = LISTS.find((l) => l.key === list);
  const q = query.trim().toLowerCase();
  // search narrows every status, so the chip counts show where the matches are
  const listEntries = useMemo(
    () => entries.filter((e) => inList(e, list)
      && (!q || e.item.title.toLowerCase().includes(q))
),
    [entries, list, q]
  );
  const sorts = LIBRARY_SORTS.filter((s) => !s.anime || current.segment === "anime");

  // status chips named for this list, with counts: "Reading 3", "Plan to Watch 5"
  const tabs = statusesFor(current.segment).map((s) => ({
    key: s.key,
    label: `${s.label} ${listEntries.filter((e) => e.status === s.key).length}`,
  }));
  const filtered = sortEntries(listEntries.filter((e) => e.status === tab), sort);
  const tabLabel = statusesFor(current.segment).find((s) => s.key === tab)?.label;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Library</Text>
      </View>

      {/* Anime | Manga */}
      <View style={styles.switcher}>
        {LISTS.map((l) => {
          const active = l.key === list;
          const count = entries.filter((e) => inList(e, l.key)).length;
          return (
            <TouchableOpacity
              key={l.key}
              onPress={() => { setList(l.key); setSelected(null); if (sort === "airing" || sort === "behind") setSort("updated"); }}
              style={[styles.switchBtn, active && styles.switchActive]}
            >
              <Text style={[styles.switchLabel, active && { color: "#fff" }]}>
                {l.segment === "anime" ? "Anime" : "Manga"} <Text style={styles.switchCount}>{count}</Text>
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={`Search your ${current.segment}`}
        placeholderTextColor={C.faint}
        style={styles.search}
        returnKeyType="search"
        clearButtonMode="while-editing"
      />

      <View style={{ paddingHorizontal: 14 }}>
        <Chips options={tabs} value={tab} onChange={setTab} />
        <Chips options={sorts} value={sort} onChange={setSort} style={{ marginTop: 6 }} />
      </View>

      {selecting && (
        <View style={styles.bulkBar}>
          <Text style={styles.bulkCount}>{selected.size} selected</Text>
          <Text style={styles.bulkBtn} onPress={() => setSelected(new Set(filtered.map(keyOf)))}>All</Text>
          <Text style={[styles.bulkBtn, !selected.size && styles.bulkOff]} onPress={selected.size ? () => setSheet("status") : undefined}>Move</Text>
          {cats.length > 0 && (
            <Text style={[styles.bulkBtn, !selected.size && styles.bulkOff]} onPress={selected.size ? () => setSheet("category") : undefined}>Category</Text>
          )}
          <Text style={[styles.bulkBtn, { color: C.rose }, !selected.size && styles.bulkOff]}
            onPress={selected.size ? () => Alert.alert(`Remove ${selected.size} from your library?`, "Their progress and categories are lost.", [
              { text: "Cancel", style: "cancel" },
              { text: "Remove", style: "destructive", onPress: () => bulk(bulkRemove) },
            ]) : undefined}>Remove</Text>
          <Text style={[styles.bulkBtn, { color: C.sub }]} onPress={() => setSelected(null)}>Done</Text>
        </View>
      )}

      <FlatList
        data={filtered}
        key={`grid-${cols}`}
        keyExtractor={(e) => `${e.item.segment}-${e.item.id}`}
        numColumns={cols}
        contentContainerStyle={{ padding: 6, paddingBottom: 30 }}
        renderItem={({ item: entry }) => (
          <LibraryCard
            entry={entry}
            columns={cols}
            selecting={selecting}
            selected={selecting && selected.has(keyOf(entry))}
            onLongPress={() => (selecting ? toggle(entry) : setSelected(new Set([keyOf(entry)])))}
            onPress={() => (selecting ? toggle(entry) : openDetail(navigation, entry.item))}
          />
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {q ? `No ${tabLabel} titles match "${query.trim()}".` : `Nothing in ${tabLabel} yet. ${list === "read" ? "Find some manga to read!" : "Tag some titles!"}`}
          </Text>
        }
      />
      <OptionsSheet
        visible={sheet === "status"}
        title={`Move ${selected?.size || 0} to`}
        options={statusesFor(current.segment).map((st) => ({ key: st.key, label: st.label }))}
        onPick={(status) => bulk((keys) => bulkSetStatus(keys, status))}
        onClose={() => setSheet(null)}
      />
      <OptionsSheet
        visible={sheet === "category"}
        title="Categories"
        options={[
          ...cats.map((c) => ({ key: `+${c.id}`, label: `Add to ${c.name}` })),
        ]}
        onPick={(k) => bulk((keys) => bulkCategory(keys, k.slice(1), k[0] === "+"))}
        onClose={() => setSheet(null)}
      />
      {finishing && (
        <VerdictModal visible initial={null} onSave={finish} onClose={() => { setFinishing(null); reload(); }} />
      )}
    </SafeAreaView>
  );
}

const makeStyles = (C) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 14, paddingTop: 8,
  },
  title: { color: C.text, fontSize: 20, fontWeight: "800" },
  switcher: {
    flexDirection: "row", gap: 4, marginHorizontal: 14, marginTop: 14, marginBottom: 4, padding: 4,
    backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.border,
  },
  switchBtn: { flex: 1, borderRadius: 9, paddingVertical: 9, alignItems: "center" },
  switchActive: { backgroundColor: C.purple, borderColor: C.purple },
  switchLabel: { color: C.text, fontWeight: "800", fontSize: 14 },
  switchCount: { fontWeight: "600", opacity: 0.7 },
  switchHint: { color: C.faint, fontSize: 10, marginTop: 3 },
  bulkBar: {
    flexDirection: "row", alignItems: "center", gap: 16, marginHorizontal: 14, marginTop: 8, paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 12, borderWidth: 1, borderColor: C.purple, backgroundColor: C.card, flexWrap: "wrap",
  },
  bulkCount: { color: C.text, fontWeight: "800", flex: 1 },
  bulkBtn: { color: C.purple, fontWeight: "800" },
  bulkOff: { opacity: 0.4 },
  empty: { color: C.faint, textAlign: "center", marginTop: 40, paddingHorizontal: 20 },
  search: {
    marginHorizontal: 14, marginTop: 8, height: 40, borderRadius: 10, borderWidth: 1, borderColor: C.border,
    backgroundColor: C.card, color: C.text, paddingHorizontal: 12, fontSize: 14,
  },
});
