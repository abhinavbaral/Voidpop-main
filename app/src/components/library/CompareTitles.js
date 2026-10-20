// More > Compare: set 1 to 5 titles against 1 to 5 others (1 v 1 up to 5 v 5).
// A title can come from your library or not: search finds anything on AniList, so
// you can also compare things you haven't watched yet. Each side is shown with
// status, progress, your Void Verdict, length, genres and your note, and a side
// with several titles gets a short total. Nothing here is a score.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { View, Text, Image, Modal, FlatList, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { fetchAniList } from "@voidpop/shared/api/anilist";
import { getLibrary, getReviews, statusesFor, totalFor, isDone, kindOf, VERDICTS } from "@voidpop/shared/backend/store";
import { fillerFor, fillerSummary } from "@voidpop/shared/features/fillers";
import { useTheme } from "../../context/ThemeContext.js";

const MAX = 5; // titles per side
const SIDE = ["A", "B"];
const KIND = { anime: "Anime", manga: "Manga", novel: "Novel" };
const keyOf = (item) => `${item.segment}:${item.id}`;

// one value: plain text, or { text, color } for a Void Verdict
function Value({ v, styles }) {
  if (v && typeof v === "object") {
    return <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 }}><View style={[styles.dot, { backgroundColor: v.color }]} /><Text style={styles.value}>{v.text}</Text></View>;
  }
  return <Text style={styles.value}>{v}</Text>;
}

// one side of a row: its titles' values, each tagged A1, A2… when there are several
function Cell({ values, side, styles }) {
  return (
    <View style={{ flex: 1, gap: 4 }}>
      {values.map((v, i) => (
        <View key={i} style={{ flexDirection: "row", gap: 6, alignItems: "flex-start" }}>
          {values.length > 1 && <Text style={styles.chip}>{SIDE[side]}{i + 1}</Text>}
          <View style={{ flex: 1 }}><Value v={v} styles={styles} /></View>
        </View>
      ))}
    </View>
  );
}

export default function CompareTitles() {
  const { C } = useTheme();
  const styles = makeStyles(C);
  const [byKey, setByKey] = useState({}); // library entries
  const [reviews, setReviews] = useState({});
  const [sides, setSides] = useState([[], []]); // title keys chosen for A and B
  const [pool, setPool] = useState({}); // key → item, for every title chosen (library or not)
  const [slot, setSlot] = useState(null); // 0 or 1 while the picker is open for that side
  const [query, setQuery] = useState("");
  const [remote, setRemote] = useState({ status: "idle", items: [] }); // AniList results

  useFocusEffect(useCallback(() => {
    getLibrary().then((lib) => setByKey(Object.fromEntries(Object.values(lib).map((e) => [keyOf(e.item), e])))).catch(() => {});
    getReviews().then((r) => setReviews(Object.fromEntries(r.map((x) => [`${x.segment}:${x.titleId}`, x])))).catch(() => {});
  }, []));

  const entries = useMemo(() => Object.values(byKey).sort((a, b) => a.item.title.localeCompare(b.item.title)), [byKey]);

  // chosen titles with what we know about them (entry is null when not in your library)
  const groups = sides.map((ks) => ks.map((k) => {
    const entry = byKey[k] || null;
    const item = entry?.item || pool[k];
    return item ? { key: k, item, entry } : null;
  }).filter(Boolean));

  // search AniList for titles that aren't in the library
  useEffect(() => {
    const q = query.trim();
    if (slot === null || q.length < 2) { setRemote({ status: "idle", items: [] }); return undefined; }
    let alive = true;
    setRemote({ status: "loading", items: [] });
    const t = setTimeout(async () => {
      const res = await Promise.allSettled(["anime", "manga", "novel"].map((s) => fetchAniList(s, { search: q, perPage: 5 })));
      if (!alive) return; // you kept typing
      if (res.every((r) => r.status === "rejected")) { setRemote({ status: "failed", items: [] }); return; }
      setRemote({ status: "done", items: res.flatMap((r) => (r.status === "fulfilled" ? r.value.items.slice(0, 5) : [])) });
    }, 400);
    return () => { alive = false; clearTimeout(t); };
  }, [query, slot]);

  const toggle = (item) => {
    const k = keyOf(item);
    setSides((s) => s.map((ks, i) => {
      if (i !== slot) return ks;
      if (ks.includes(k)) return ks.filter((x) => x !== k);
      return ks.length >= MAX ? ks : [...ks, k];
    }));
    setPool((p) => (p[k] ? p : { ...p, [k]: item }));
  };
  const remove = (side, k) => setSides((s) => s.map((ks, i) => (i === side ? ks.filter((x) => x !== k) : ks)));
  const closePicker = () => { setSlot(null); setQuery(""); };

  // ---- what the table says about one title ----
  const factsOf = ({ key, item, entry }) => {
    const r = reviews[key];
    const v = VERDICTS.find((x) => x.key === r?.verdict);
    const total = totalFor(item);
    const fi = fillerFor(item);
    const fs = fi ? fillerSummary(fi, item) : null;
    return {
      Type: KIND[kindOf(item)],
      Status: entry ? (statusesFor(item.segment).find((s) => s.key === entry.status)?.label || entry.status) : "Not in your library",
      Progress: entry ? `${entry.progress || 0}${total != null ? ` of ${total}` : ""}` : "Not started",
      "Void Verdict": v ? { text: v.label, color: v.color } : "Not given yet",
      Filler: fs ? `${fs.filler} of ${fs.total} (${fs.percent}%)${fs.animeCanon ? ` · ${fs.animeCanon} anime canon` : ""}` : null, // only for shows in the filler database
      Length: total != null ? `${total} ${item.segment === "manga" ? "chapters" : "episodes"}` : "Unknown",
      Genres: (item.genres || []).slice(0, 3).join(", ") || "None listed",
      Aired: (item.date || "").slice(0, 4) || "Unknown",
      Vibes: r?.vibes?.length ? r.vibes.join(", ") : null, // old verdicts only; the row hides when nobody has any
    };
  };
  const ready = groups[0].length > 0 && groups[1].length > 0;
  const facts = groups.map((g) => g.map(factsOf));
  const labels = ["Type", "Status", "Progress", "Void Verdict", "Length", ...(facts.flat().some((f) => f.Filler) ? ["Filler"] : []), "Genres", "Aired", ...(facts.flat().some((f) => f.Vibes) ? ["Vibes"] : [])];
  const several = groups.some((g) => g.length > 1);
  const tally = (g) => VERDICTS.map((v) => [v.label, g.filter((t) => reviews[t.key]?.verdict === v.key).length]).filter(([, n]) => n).map(([l, n]) => `${l} ${n}`).join(" · ") || "None given";
  const totals = several ? [
    ["Titles", groups.map((g) => `${g.length} · ${g.filter((t) => t.entry).length} in your library`)],
    ["Finished", groups.map((g) => `${g.filter((t) => t.entry && isDone(t.entry.status)).length} of ${g.length}`)],
    ["Void Verdicts", groups.map(tally)],
  ] : [];

  // ---- the two sides ----
  const sideView = (i) => {
    const g = groups[i];
    const w = g.length === 1 ? "70%" : g.length === 2 ? "44%" : "30%";
    return (
      <View style={{ flex: 1, alignItems: "center", gap: 8 }}>
        <Text style={styles.sideName}>{SIDE[i]}</Text>
        {g.length === 0 ? (
          <TouchableOpacity style={{ width: "70%" }} onPress={() => setSlot(i)} accessibilityRole="button" accessibilityLabel={`Choose titles for ${SIDE[i]}`}>
            <View style={[styles.poster, styles.empty]}><Text style={{ color: C.faint, fontSize: 28 }}>+</Text></View>
          </TouchableOpacity>
        ) : (
          <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 6, width: "100%" }}>
            {g.map((t, n) => (
              <View key={t.key} style={{ width: w }}>
                <Image source={{ uri: t.item.image }} style={styles.poster} accessibilityLabel={t.item.title} />
                <TouchableOpacity style={styles.remove} onPress={() => remove(i, t.key)} accessibilityRole="button" accessibilityLabel={`Remove ${t.item.title}`} hitSlop={6}>
                  <Text style={{ color: "#fff", fontWeight: "900", fontSize: 12 }}>×</Text>
                </TouchableOpacity>
                {g.length > 1 && <Text style={styles.posterChip}>{SIDE[i]}{n + 1}</Text>}
                {g.length === 1 && <Text style={styles.slotTitle} numberOfLines={2}>{t.item.title}</Text>}
              </View>
            ))}
          </View>
        )}
        {g.length > 0 && (
          <TouchableOpacity onPress={() => setSlot(i)} accessibilityRole="button">
            <Text style={{ color: C.purple, fontWeight: "800", fontSize: 13 }}>{g.length >= MAX ? `Edit (${g.length} of ${MAX})` : `+ Add title (${g.length} of ${MAX})`}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // ---- the picker ----
  const q = query.trim().toLowerCase();
  const rows = useMemo(() => {
    if (slot === null) return [];
    const other = sides[1 - slot];
    const inLib = entries.filter((e) => !other.includes(keyOf(e.item)) && e.item.title.toLowerCase().includes(q)).map((e) => ({ item: e.item, entry: e }));
    const seen = new Set();
    const outside = remote.items.filter((it) => {
      const k = keyOf(it);
      if (byKey[k] || other.includes(k) || seen.has(k)) return false;
      seen.add(k);
      return true;
    }).map((item) => ({ item, entry: null }));
    return [...(inLib.length ? [{ header: "In your library" }] : []), ...inLib, ...(outside.length ? [{ header: "Not in your library" }] : []), ...outside];
  }, [slot, entries, sides, q, remote, byKey]);
  const mine = slot === null ? [] : sides[slot];
  const full = mine.length >= MAX;

  const empty = remote.status === "loading" ? "Searching…"
    : remote.status === "failed" ? "Couldn't search AniList just now. Titles from your library still work."
      : q ? "Nothing matches." : "Your library is empty. Type at least 2 letters to search anything on AniList.";

  return (
    <View>
      <Text style={styles.note}>Set 1 to 5 titles against 1 to 5 others. Pick from your library, or search for anything, even shows you haven't watched.</Text>
      <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>{sideView(0)}{sideView(1)}</View>
      {!ready && <Text style={[styles.note, { marginTop: 14 }]}>Add at least one title to each side to compare.</Text>}

      {ready && totals.map(([label, cells]) => (
        <View key={label} style={styles.block}>
          <Text style={styles.label}>{label}</Text>
          <View style={{ flexDirection: "row", gap: 12 }}>
            {cells.map((c, i) => <View key={i} style={{ flex: 1 }}><Text style={styles.value}>{c}</Text></View>)}
          </View>
        </View>
      ))}
      {ready && labels.map((label) => (
        <View key={label} style={styles.block}>
          <Text style={styles.label}>{label}</Text>
          <View style={{ flexDirection: "row", gap: 12 }}>
            {facts.map((f, i) => <Cell key={i} side={i} styles={styles} values={f.map((x) => x[label] ?? (label === "Filler" ? "No filler data" : "None"))} />)}
          </View>
        </View>
      ))}

      <Modal visible={slot !== null} animationType="slide" onRequestClose={closePicker}>
        <View style={[styles.sheet, { backgroundColor: C.bg }]}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ color: C.text, fontWeight: "900", fontSize: 16 }}>Choose for {slot === null ? "" : SIDE[slot]} · {mine.length} of {MAX}</Text>
            <TouchableOpacity onPress={closePicker} accessibilityRole="button"><Text style={{ color: C.purple, fontWeight: "800" }}>Done</Text></TouchableOpacity>
          </View>
          <TextInput value={query} onChangeText={setQuery} placeholder="Search your library or AniList" placeholderTextColor={C.faint} autoFocus
            accessibilityLabel="Search titles" style={[styles.search, { marginTop: 10 }]} />
          {q.length < 2 && <Text style={[styles.note, { marginTop: 8 }]}>Type 2 or more letters to also search titles that aren't in your library.</Text>}
          <FlatList data={rows} keyExtractor={(r) => (r.header ? `h:${r.header}` : keyOf(r.item))} keyboardShouldPersistTaps="handled" style={{ marginTop: 10 }}
            ListEmptyComponent={<Text style={[styles.note, { marginTop: 20 }]}>{empty}</Text>}
            renderItem={({ item: r }) => {
              if (r.header) return <Text style={[styles.label, { marginTop: 10 }]}>{r.header}</Text>;
              const picked = mine.includes(keyOf(r.item));
              const blocked = full && !picked;
              const sub = r.entry ? statusesFor(r.item.segment).find((s) => s.key === r.entry.status)?.label : `${KIND[kindOf(r.item)]}${r.item.date ? ` · ${r.item.date.slice(0, 4)}` : ""}`;
              return (
                <TouchableOpacity style={[styles.pick, blocked && { opacity: 0.4 }]} onPress={() => !blocked && toggle(r.item)} accessibilityRole="button"
                  accessibilityState={{ selected: picked, disabled: blocked }} accessibilityLabel={`${r.item.title}. ${sub || ""}. ${picked ? "Chosen. Tap to remove" : "Tap to add"}`}>
                  <Image source={{ uri: r.item.imageSmall || r.item.image }} style={styles.thumb} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.text, fontWeight: "700" }} numberOfLines={1}>{r.item.title}</Text>
                    <Text style={{ color: C.faint, fontSize: 12 }}>{sub}</Text>
                  </View>
                  <View style={[styles.check, picked && { backgroundColor: C.purple, borderColor: C.purple }]}>{picked && <Text style={{ color: "#fff", fontWeight: "900", fontSize: 12 }}>✓</Text>}</View>
                </TouchableOpacity>
              );
            }} />
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = (C) => StyleSheet.create({
  note: { color: C.faint, fontSize: 13, lineHeight: 19 },
  sideName: { color: C.text, fontWeight: "900", fontSize: 15 },
  poster: { width: "100%", aspectRatio: 2 / 3, borderRadius: 10, backgroundColor: C.card },
  empty: { alignItems: "center", justifyContent: "center", borderWidth: 1, borderStyle: "dashed", borderColor: C.border },
  slotTitle: { color: C.text, fontWeight: "800", fontSize: 13, textAlign: "center", marginTop: 6 },
  remove: { position: "absolute", top: 4, right: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: "rgba(0,0,0,0.65)", alignItems: "center", justifyContent: "center" },
  posterChip: { color: C.faint, fontSize: 11, fontWeight: "800", textAlign: "center", marginTop: 2 },
  block: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.border },
  label: { color: C.faint, fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  value: { color: C.text, fontSize: 14, lineHeight: 20 },
  chip: { color: C.faint, fontSize: 11, fontWeight: "800", width: 24, lineHeight: 20 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  sheet: { flex: 1, padding: 16, paddingTop: 48 },
  search: { color: C.text, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  pick: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  thumb: { width: 40, height: 58, borderRadius: 6, backgroundColor: C.card },
  check: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: C.border, alignItems: "center", justifyContent: "center" },
});
