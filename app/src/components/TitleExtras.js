// Extra sections for a title page:
//   NoteBox       your private note ("stopped at the tournament arc")
//   WatchOrder    the franchise in release order (anime), with your status
//   Discussions   AniList forum threads, opening in the browser
import { useCallback, useEffect, useState } from "react";
import { View, Text, TextInput, Image, TouchableOpacity, StyleSheet } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { fetchWatchOrder } from "@voidation/shared/api/anilist";
import { getNote, setNote, getLibrary, statusesFor } from "@voidation/shared/backend/store";
import { yearOf } from "@voidation/shared/format";
import { useTheme } from "../context/ThemeContext.js";
import { openDetail } from "../lib/nav";
import Icon from "./Icon.js";

const FORMAT = { TV: "TV", TV_SHORT: "TV short", MOVIE: "Movie", OVA: "OVA", ONA: "ONA", SPECIAL: "Special" };

export function NoteBox({ item }) {
  const { C } = useTheme();
  const styles = makeStyles(C);
  const [note, setNoteState] = useState(null);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  useEffect(() => { getNote(item.segment, item.id).then((t) => { setNoteState(t); setDraft(t); }).catch(() => setNoteState("")); }, [item.segment, item.id]);
  if (note === null) return null;
  const save = async () => { const t = await setNote(item.segment, item.id, draft); setNoteState(t); setDraft(t); setEditing(false); };
  if (editing) {
    return (
      <View style={styles.box}>
        <Text style={styles.label}>Your note</Text>
        <TextInput value={draft} onChangeText={setDraft} multiline autoFocus maxLength={2000}
          placeholder="Only you see this, e.g. stopped at the tournament arc" placeholderTextColor={C.faint} style={styles.input} />
        <View style={{ flexDirection: "row", gap: 16, justifyContent: "flex-end", marginTop: 8 }}>
          <Text style={{ color: C.sub }} onPress={() => { setDraft(note); setEditing(false); }}>Cancel</Text>
          <Text style={{ color: C.purple, fontWeight: "800" }} onPress={save}>Save</Text>
        </View>
      </View>
    );
  }
  return (
    <TouchableOpacity style={styles.box} onPress={() => setEditing(true)} accessibilityRole="button" accessibilityLabel={note ? `Your note: ${note}. Tap to edit` : "Add a private note"}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Icon name="edit" size={14} color={C.purple} />
        <Text style={styles.label}>{note ? "Your note" : "Add a note"}</Text>
      </View>
      {note ? <Text style={styles.noteText}>{note}</Text> : <Text style={styles.faint}>Only you see it. Handy for where you stopped.</Text>}
    </TouchableOpacity>
  );
}

// Watch order on every anime's page (and in Browse → Watch order, where
// `finder` makes every row tappable and drops "You're here").
export function WatchOrder({ item, navigation, finder = false }) {
  const { C } = useTheme();
  const styles = makeStyles(C);
  const [list, setList] = useState(null);
  const [lib, setLib] = useState({});
  useEffect(() => { let alive = true; fetchWatchOrder(item.id).then((l) => alive && setList(l)).catch(() => alive && setList([])); return () => { alive = false; }; }, [item.id]);
  useFocusEffect(useCallback(() => { getLibrary().then(setLib).catch(() => {}); }, []));
  if (!list) return null;
  const label = (k) => statusesFor("anime").find((s) => s.key === k)?.label;
  return (
    <View style={{ marginTop: 20 }}>
      <Text style={styles.title}>Watch order</Text>
      {list.length < 2 && <Text style={styles.faint}>Just this one so far: no other seasons, movies or specials on AniList.</Text>}
      {list.map((it, i) => {
        const here = !finder && it.id === item.id;
        const status = lib[`anime:${it.id}`]?.status;
        return (
          <TouchableOpacity key={it.id} disabled={here} onPress={() => openDetail(navigation, it)} style={[styles.row, here && { backgroundColor: C.card }]}>
            <Text style={styles.num}>{i + 1}</Text>
            {it.image ? <Image source={{ uri: it.image }} style={styles.thumb} /> : <View style={[styles.thumb, { backgroundColor: C.border }]} />}
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, here && { color: C.purple }]} numberOfLines={2}>{it.title}</Text>
              <Text style={styles.faint}>{[it.orderLabel, FORMAT[it.format] || it.format, yearOf(it), here ? "You're here" : null].filter(Boolean).join(" · ")}</Text>
            </View>
            {status ? <Text style={styles.status}>{label(status)}</Text> : null}
          </TouchableOpacity>
        );
      })}
      <Text style={[styles.faint, { marginTop: 6 }]}>In release order, from AniList. Recaps and remakes are left out.</Text>
    </View>
  );
}

const makeStyles = (C) => StyleSheet.create({
  title: { color: C.text, fontWeight: "800", fontSize: 15, marginBottom: 6 },
  box: { marginTop: 14, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 12, backgroundColor: C.card },
  label: { color: C.text, fontWeight: "800", fontSize: 13 },
  noteText: { color: C.sub, fontSize: 13, marginTop: 6, lineHeight: 19 },
  input: { color: C.text, fontSize: 13, minHeight: 70, textAlignVertical: "top", marginTop: 6, borderWidth: 1, borderColor: C.border, borderRadius: 8, padding: 8 },
  faint: { color: C.faint, fontSize: 11 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 7, paddingHorizontal: 4, borderRadius: 8 },
  num: { color: C.faint, fontWeight: "800", width: 18, textAlign: "right" },
  thumb: { width: 34, height: 48, borderRadius: 5 },
  rowTitle: { color: C.text, fontSize: 13, fontWeight: "700" },
  status: { color: C.orange, fontSize: 11, fontWeight: "800" },
});
