// More > Compare: pick two titles from your own library and see them side by
// side: status, progress, your Void Verdict and vibes, and your note. It's a
// way to answer "compared to what?" about your own taste; nothing here is a score.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { View, Text, Image, Modal, FlatList, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { getLibrary, getReviews, getNote, statusesFor, totalFor, VERDICTS } from "@voidpop/shared/backend/store";
import { useTheme } from "../../context/ThemeContext.js";

const keyOf = (item) => `${item.segment}:${item.id}`;

export default function CompareTitles() {
  const { C } = useTheme();
  const styles = makeStyles(C);
  const [entries, setEntries] = useState([]);
  const [reviews, setReviews] = useState({});
  const [picked, setPicked] = useState([null, null]); // library keys
  const [notes, setNotes] = useState({});
  const [slot, setSlot] = useState(null); // which side the picker is choosing for
  const [query, setQuery] = useState("");

  useFocusEffect(useCallback(() => {
    getLibrary().then((lib) => setEntries(Object.values(lib).sort((a, b) => a.item.title.localeCompare(b.item.title)))).catch(() => {});
    getReviews().then((r) => setReviews(Object.fromEntries(r.map((x) => [`${x.segment}:${x.titleId}`, x])))).catch(() => {});
  }, []));

  const byKey = useMemo(() => Object.fromEntries(entries.map((e) => [keyOf(e.item), e])), [entries]);
  const chosen = picked.map((k) => (k ? byKey[k] : null));

  useEffect(() => {
    chosen.forEach((e) => {
      if (e && notes[keyOf(e.item)] === undefined) {
        getNote(e.item.segment, e.item.id).then((t) => setNotes((n) => ({ ...n, [keyOf(e.item)]: t }))).catch(() => {});
      }
    });
  }, [picked, byKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const choose = (e) => {
    setPicked((p) => p.map((k, i) => (i === slot ? keyOf(e.item) : k)));
    setSlot(null);
    setQuery("");
  };

  const facts = (e) => {
    if (!e) return null;
    const key = keyOf(e.item);
    const r = reviews[key];
    const v = VERDICTS.find((x) => x.key === r?.verdict);
    const total = totalFor(e.item);
    return {
      Type: e.item.segment === "manga" ? "Manga" : "Anime",
      Status: statusesFor(e.item.segment).find((s) => s.key === e.status)?.label || e.status,
      Progress: `${e.progress || 0}${total != null ? ` of ${total}` : ""}`,
      "Void Verdict": v ? { text: v.label, color: v.color } : "Not given yet",
      Vibes: r?.vibes?.length ? r.vibes.join(", ") : "None",
      Genres: (e.item.genres || []).slice(0, 3).join(", ") || "None listed",
      Aired: (e.item.date || "").slice(0, 4) || "Unknown",
      "Your note": (notes[key] || "").slice(0, 140) || "No note",
    };
  };
  const [a, b] = chosen.map(facts);
  const labels = a || b ? Object.keys(a || b) : [];

  const slotCard = (i) => {
    const e = chosen[i];
    return (
      <TouchableOpacity style={styles.slot} onPress={() => setSlot(i)} accessibilityRole="button"
        accessibilityLabel={e ? `${e.item.title}. Tap to change` : `Choose title ${i + 1}`}>
        {e ? <Image source={{ uri: e.item.image }} style={styles.poster} /> : <View style={[styles.poster, styles.empty]}><Text style={{ color: C.faint, fontSize: 28 }}>+</Text></View>}
        <Text style={styles.slotTitle} numberOfLines={2}>{e ? e.item.title : "Choose a title"}</Text>
      </TouchableOpacity>
    );
  };

  const cell = (val) => (typeof val === "object"
    ? <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}><View style={[styles.dot, { backgroundColor: val.color }]} /><Text style={styles.value}>{val.text}</Text></View>
    : <Text style={[styles.value, { flex: 1 }]}>{val}</Text>);

  const shown = entries.filter((e) => e.item.title.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <View>
      <Text style={styles.note}>Pick two titles from your library to set them side by side.</Text>
      <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>{slotCard(0)}{slotCard(1)}</View>
      {entries.length < 2 && <Text style={[styles.note, { marginTop: 14 }]}>Add at least two titles to your library to compare them.</Text>}
      {a && b && labels.map((label) => (
        <View key={label} style={styles.block}>
          <Text style={styles.label}>{label}</Text>
          <View style={{ flexDirection: "row", gap: 12 }}>{cell(a[label])}{cell(b[label])}</View>
        </View>
      ))}

      <Modal visible={slot !== null} animationType="slide" onRequestClose={() => setSlot(null)}>
        <View style={[styles.sheet, { backgroundColor: C.bg }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <TextInput value={query} onChangeText={setQuery} placeholder="Search your library" placeholderTextColor={C.faint} autoFocus
              accessibilityLabel="Search your library" style={styles.search} />
            <TouchableOpacity onPress={() => setSlot(null)} accessibilityRole="button"><Text style={{ color: C.purple, fontWeight: "800" }}>Close</Text></TouchableOpacity>
          </View>
          <FlatList data={shown} keyExtractor={(e) => keyOf(e.item)} keyboardShouldPersistTaps="handled" style={{ marginTop: 10 }}
            ListEmptyComponent={<Text style={[styles.note, { marginTop: 20 }]}>Nothing matches.</Text>}
            renderItem={({ item: e }) => (
              <TouchableOpacity style={styles.pick} onPress={() => choose(e)} accessibilityRole="button">
                <Image source={{ uri: e.item.image }} style={styles.thumb} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.text, fontWeight: "700" }} numberOfLines={1}>{e.item.title}</Text>
                  <Text style={{ color: C.faint, fontSize: 12 }}>{statusesFor(e.item.segment).find((s) => s.key === e.status)?.label}</Text>
                </View>
              </TouchableOpacity>
            )} />
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = (C) => StyleSheet.create({
  note: { color: C.faint, fontSize: 13, lineHeight: 19 },
  slot: { flex: 1, alignItems: "center", gap: 8 },
  poster: { width: "70%", aspectRatio: 2 / 3, borderRadius: 12, backgroundColor: C.card },
  empty: { alignItems: "center", justifyContent: "center", borderWidth: 1, borderStyle: "dashed", borderColor: C.border },
  slotTitle: { color: C.text, fontWeight: "800", fontSize: 13, textAlign: "center" },
  block: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.border },
  label: { color: C.faint, fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  value: { color: C.text, fontSize: 14, lineHeight: 20 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  sheet: { flex: 1, padding: 16, paddingTop: 48 },
  search: { flex: 1, color: C.text, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  pick: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  thumb: { width: 40, height: 58, borderRadius: 6, backgroundColor: C.card },
});
