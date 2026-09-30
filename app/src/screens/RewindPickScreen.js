// Rewind › Pick titles: tick the anime and manga you watched or read this
// year, so they count in this year's Rewind. Titles you add this year are
// ticked already; imports aren't (they're usually older viewing).
import { useEffect, useMemo, useState } from "react";
import { View, Text, TextInput, FlatList, Image, TouchableOpacity, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getLibrary, setRewindYear, statusesFor } from "@voidation/shared/backend/store";
import { useTheme } from "../context/ThemeContext.js";
import { goBackOrHome } from "../lib/nav";
import Chips from "../components/Chips.js";
import Icon from "../components/Icon.js";
import { SkeletonList } from "../components/Skeleton.js";
import { VoidmonEmpty } from "../components/Voidmon.js";

export default function RewindPickScreen({ navigation, route }) {
  const { C } = useTheme();
  const styles = makeStyles(C);
  const year = route.params?.year || new Date().getFullYear();
  const [lib, setLib] = useState(null);
  const [picked, setPicked] = useState(new Set());
  const [segment, setSegment] = useState("anime");
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getLibrary().then((l) => {
      setLib(l);
      setPicked(new Set(Object.keys(l).filter((k) => l[k].rewindYear === year)));
    });
  }, [year]);

  const rows = useMemo(() => {
    if (!lib) return [];
    const needle = q.trim().toLowerCase();
    return Object.entries(lib)
      .filter(([, e]) => e.item.segment === segment && e.status !== "plan")
      .filter(([, e]) => !needle || (e.item.title || "").toLowerCase().includes(needle))
      .sort((a, b) => String(b[1].updatedAt || "").localeCompare(String(a[1].updatedAt || "")));
  }, [lib, segment, q]);

  const toggle = (key) => setPicked((prev) => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  const save = async () => {
    setSaving(true);
    const was = new Set(Object.keys(lib).filter((k) => lib[k].rewindYear === year));
    await setRewindYear([...picked].filter((k) => !was.has(k)), year);
    await setRewindYear([...was].filter((k) => !picked.has(k)), null);
    goBackOrHome(navigation);
  };
  const count = lib ? [...picked].filter((k) => lib[k]?.item.segment === segment).length : 0;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.head}>
        <TouchableOpacity onPress={() => goBackOrHome(navigation)} hitSlop={12} accessibilityLabel="Back">
          <Icon name="back" size={22} color={C.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Your {year} Rewind</Text>
          <Text style={styles.sub}>Tick what you watched or read in {year}. The rest stays in Before {year}.</Text>
        </View>
      </View>
      <View style={{ paddingHorizontal: 14, gap: 10 }}>
        <Chips value={segment} onChange={setSegment} options={[{ key: "anime", label: "Anime" }, { key: "manga", label: "Manga" }]} />
        <TextInput value={q} onChangeText={setQ} placeholder="Search your library" placeholderTextColor={C.faint} style={styles.input} />
      </View>
      {!lib ? <SkeletonList rows={8} /> : (
        <FlatList
          data={rows}
          keyExtractor={([k]) => k}
          contentContainerStyle={{ padding: 14, paddingBottom: 90 }}
          ListEmptyComponent={<VoidmonEmpty pose="peeking" text={q ? "Nothing in your library matches that." : `No ${segment} in your library yet.`} />}
          renderItem={({ item: [key, e] }) => {
            const on = picked.has(key);
            const label = statusesFor(e.item.segment).find((s) => s.key === e.status)?.label || "";
            return (
              <TouchableOpacity onPress={() => toggle(key)} style={[styles.row, on && { borderColor: C.purple }]}
                accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
                {e.item.image ? <Image source={{ uri: e.item.image }} style={styles.thumb} /> : <View style={styles.thumb} />}
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle} numberOfLines={2}>{e.item.title}</Text>
                  <Text style={styles.sub}>{label}</Text>
                </View>
                <View style={[styles.box, on && { backgroundColor: C.purple, borderColor: C.purple }]}>
                  {on && <Text style={{ color: "#fff", fontWeight: "900" }}>✓</Text>}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
      <View style={styles.bar}>
        <Text style={[styles.sub, { flex: 1 }]}>{count} {segment} in {year}</Text>
        <TouchableOpacity onPress={save} disabled={!lib || saving} style={[styles.save, (!lib || saving) && { opacity: 0.5 }]}>
          <Text style={{ color: "#fff", fontWeight: "800" }}>{saving ? "Saving…" : "Save"}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (C) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  head: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  title: { color: C.text, fontSize: 20, fontWeight: "900" },
  sub: { color: C.faint, fontSize: 12, marginTop: 2 },
  input: { borderWidth: 1, borderColor: C.border, backgroundColor: C.inputBg, color: C.text, borderRadius: 10, paddingHorizontal: 12, height: 42 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 8, borderRadius: 12, borderWidth: 1, borderColor: C.border, backgroundColor: C.card, marginBottom: 8 },
  thumb: { width: 42, height: 60, borderRadius: 6, backgroundColor: C.border },
  rowTitle: { color: C.text, fontWeight: "700", fontSize: 14 },
  box: { width: 26, height: 26, borderRadius: 7, borderWidth: 2, borderColor: C.border, alignItems: "center", justifyContent: "center" },
  bar: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", alignItems: "center", gap: 12, padding: 14, backgroundColor: C.bg, borderTopWidth: 1, borderTopColor: C.border },
  save: { backgroundColor: C.purple, borderRadius: 10, paddingHorizontal: 22, paddingVertical: 10 },
});
