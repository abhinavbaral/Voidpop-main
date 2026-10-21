// One playlist opened from Your Library: a status (Watching, Completed, Plan to Watch…).
// Its titles with the sort, four layouts (compact, comfortable, covers, list), "Pick for me"
// and long-press to select several (move them to another status, or remove them from your library).

import { useCallback, useMemo, useState } from "react";
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import {
  getLibraryAll, statusesFor, LIBRARY_KINDS as KINDS, kindOf, LIBRARY_SORTS, LIBRARY_LAYOUTS, sortEntries, getLibraryDates,
  bulkSetStatus, bulkRemove,
} from "@voidpop/shared/backend/store";
import { playlistEntries } from "@voidpop/shared/features/playlists";
import { useSettings } from "@voidpop/shared/backend/SettingsContext";
import { useTheme } from "../../context/ThemeContext.js";
import { useGridColumns } from "../../utils/layout";
import { openDetail, goBackOrHome } from "../../utils/nav";
import OptionsSheet from "../../components/ui/OptionsSheet.js";
import LibraryCard from "../../components/library/LibraryCard.js";
import PickForMe from "../../components/explore/PickForMe.js";
import { VoidmonEmpty } from "../../components/brand/Voidmon.js";
import Icon from "../../components/ui/Icon.js";

export default function PlaylistScreen({ navigation, route }) {
  const { kind, ref, title } = route.params;
  const { C } = useTheme();
  const styles = makeStyles(C);
  const { settings, update } = useSettings();
  const layout = settings.libraryLayout || "compact";
  const gridCols = useGridColumns(layout === "cover" ? 120 : 190);
  const cols = layout === "list" ? 1 : gridCols;
  const [entries, setEntries] = useState([]);
  const [dates, setDates] = useState({});
  const [sort, setSort] = useState("updated");
  const [picking, setPicking] = useState(false);
  const [selected, setSelected] = useState(null); // null = not selecting; Set of keys while selecting
  const [sheet, setSheet] = useState(null); // "status" | "sort" | "layout"

  const reload = useCallback(async () => {
    setEntries(Object.values(await getLibraryAll().catch(() => ({}))));
    setDates(await getLibraryDates().catch(() => ({})));
  }, []);
  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  const keyOf = (e) => `${e.item.segment}:${e.item.id}`;
  const selecting = selected !== null;
  const toggle = (e) => setSelected((prev) => {
    const next = new Set(prev || []);
    if (next.has(keyOf(e))) next.delete(keyOf(e)); else next.add(keyOf(e));
    return next;
  });
  const bulk = async (fn) => { const keys = [...(selected || [])]; setSheet(null); setSelected(null); await fn(keys); reload(); };

  const current = KINDS.find((k) => k.key === kind);
  const sorts = LIBRARY_SORTS.filter((s) => !s.anime || current.segment === "anime");
  const list = useMemo(() => playlistEntries(entries.filter((e) => kindOf(e.item) === kind), ref), [entries, kind, ref]);
  const filtered = sortEntries(list, sort, dates);
  const sortLabel = sorts.find((x) => x.key === sort)?.label || "Sort";

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBackOrHome(navigation)} hitSlop={12} accessibilityLabel="Back"><Icon name="back" size={22} color={C.text} /></TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1} accessibilityRole="header">{title}</Text>
          <Text style={styles.sub}>Playlist • VoidPop • {list.length} {list.length === 1 ? "title" : "titles"}</Text>
        </View>
      </View>

      <View style={styles.tools}>
        <TouchableOpacity onPress={() => setSheet("sort")} style={[styles.tool, { flexShrink: 1 }]} accessibilityRole="button" accessibilityLabel={`Sort: ${sortLabel}`}>
          <Icon name="sort" size={15} color={C.sub} />
          <Text style={styles.toolText} numberOfLines={1}>{sortLabel}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setSheet("layout")} style={styles.tool} accessibilityRole="button"
          accessibilityLabel={`Layout: ${LIBRARY_LAYOUTS.find((l) => l.key === layout)?.label}`}>
          <Icon name={layout === "list" ? "list" : "browse"} size={15} color={C.sub} />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        {filtered.length > 1 && !selecting && (
          <TouchableOpacity onPress={() => setPicking(true)} style={[styles.tool, { borderColor: C.purple }]} accessibilityRole="button">
            <Icon name="shuffle" size={15} color={C.purple} />
            <Text style={[styles.toolText, { color: C.purple }]}>Pick for me</Text>
          </TouchableOpacity>
        )}
      </View>

      {selecting && (
        <View style={styles.bulkBar}>
          <Text style={styles.bulkCount}>{selected.size} selected</Text>
          <Text style={styles.bulkBtn} onPress={() => setSelected(new Set(filtered.map(keyOf)))}>All</Text>
          <Text style={[styles.bulkBtn, !selected.size && styles.bulkOff]} onPress={selected.size ? () => setSheet("status") : undefined}>Move</Text>
          <Text style={[styles.bulkBtn, { color: C.rose }, !selected.size && styles.bulkOff]}
            onPress={selected.size ? () => Alert.alert(`Remove ${selected.size} from your library?`, "Their progress is lost.", [
              { text: "Cancel", style: "cancel" },
              { text: "Remove", style: "destructive", onPress: () => bulk(bulkRemove) },
            ]) : undefined}>Remove</Text>
          <Text style={[styles.bulkBtn, { color: C.sub }]} onPress={() => setSelected(null)}>Done</Text>
        </View>
      )}

      <FlatList
        data={filtered}
        key={`${layout}-${cols}`}
        keyExtractor={(e) => `${e.item.segment}-${e.item.id}`}
        numColumns={cols}
        contentContainerStyle={{ padding: 6, paddingBottom: 30 }}
        renderItem={({ item: entry }) => (
          <LibraryCard
            entry={entry}
            columns={cols}
            layout={layout}
            selecting={selecting}
            selected={selecting && selected.has(keyOf(entry))}
            onLongPress={() => (selecting ? toggle(entry) : setSelected(new Set([keyOf(entry)])))}
            onPress={() => (selecting ? toggle(entry) : openDetail(navigation, entry.item))}
          />
        )}
        ListEmptyComponent={
          <VoidmonEmpty pose="peeking"
            text={`Nothing in ${title} yet. ${current.segment === "manga" ? "Find something to read!" : "Tag some titles!"}`} />
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
        visible={sheet === "sort"}
        title="Sort by"
        options={sorts.map((x) => ({ key: x.key, label: x.key === sort ? `${x.label}  (now)` : x.label }))}
        onPick={(k) => { setSort(k); setSheet(null); }}
        onClose={() => setSheet(null)}
      />
      <OptionsSheet
        visible={sheet === "layout"}
        title="Layout"
        options={LIBRARY_LAYOUTS.map((x) => ({ key: x.key, label: x.key === layout ? `${x.label}  (now)` : x.label }))}
        onPick={(k) => { update("libraryLayout", k); setSheet(null); }}
        onClose={() => setSheet(null)}
      />
      <PickForMe visible={picking} entries={filtered} onClose={() => setPicking(false)}
        onOpen={(item) => { setPicking(false); openDetail(navigation, item); }} />
    </SafeAreaView>
  );
}

const makeStyles = (C) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 14, paddingTop: 8, paddingBottom: 4 },
  title: { color: C.text, fontSize: 22, fontWeight: "900" },
  sub: { color: C.faint, fontSize: 12, marginTop: 2 },
  bulkBar: {
    flexDirection: "row", alignItems: "center", gap: 16, marginHorizontal: 14, marginTop: 8, paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 12, borderWidth: 1, borderColor: C.purple, backgroundColor: C.card, flexWrap: "wrap",
  },
  bulkCount: { color: C.text, fontWeight: "800", flex: 1 },
  bulkBtn: { color: C.purple, fontWeight: "800" },
  bulkOff: { opacity: 0.4 },
  tools: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10, paddingHorizontal: 14 },
  tool: {
    flexDirection: "row", alignItems: "center", gap: 6, height: 34, paddingHorizontal: 11,
    borderRadius: 999, borderWidth: 1, borderColor: C.border, backgroundColor: C.card,
  },
  toolText: { color: C.sub, fontWeight: "700", fontSize: 13 },
});
