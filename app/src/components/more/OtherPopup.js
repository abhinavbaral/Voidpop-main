// More → Other: one popup that holds "You're watching" and "New announcements". The popup opens on a short
// list of the two; picking one shows its content in the same popup, with ← to go back.
// (They used to be two pages of their own under More.)

import { useCallback, useEffect, useState } from "react";
import { Modal, View, Text, Pressable, TouchableOpacity, ScrollView, Image, StyleSheet } from "react-native";
import { useAuth } from "@voidpop/shared/backend/AuthContext";
import {
  getLibrary, youreWatching, setProgress, setStatus, addReview, totalFor, getExcited, toggleExcited,
} from "@voidpop/shared/backend/store";
import { loadAnnounced, daysLeft, ANNOUNCED_DAYS } from "@voidpop/shared/features/announced";
import { releaseLabel } from "@voidpop/shared/lib/format";
import { useTheme } from "../../context/ThemeContext.js";
import { openDetail } from "../../utils/nav";
import VerdictModal from "../title/VerdictModal.js";
import Icon from "../ui/Icon.js";
import { SkeletonList } from "../ui/Skeleton.js";

const SECTIONS = [
  { key: "youwatching", icon: "play", label: "You're watching", Body: YoureWatching },
  { key: "announced", icon: "bell", label: "New announcements", Body: Announced },
];

export default function OtherPopup({ visible, onClose, navigation }) {
  const { C } = useTheme();
  const styles = makeStyles(C);
  const [open, setOpen] = useState(null); // null = the short list of the two
  const section = SECTIONS.find((s) => s.key === open);
  const close = () => { setOpen(null); onClose(); };
  // tapping a title closes the popup first, then opens it
  const goTo = (item) => { close(); openDetail(navigation, item); };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => (open ? setOpen(null) : close())}>
      <Pressable style={styles.backdrop} onPress={close}>
        <Pressable style={styles.popup} onPress={() => {}}>
          <View style={styles.head}>
            {section && (
              <TouchableOpacity onPress={() => setOpen(null)} hitSlop={10} accessibilityLabel="Back to Other" style={{ marginRight: 10 }}>
                <Icon name="back" size={22} color={C.purple} />
              </TouchableOpacity>
            )}
            <Text style={styles.title} numberOfLines={1}>{section ? section.label : "Other"}</Text>
            <TouchableOpacity onPress={close} hitSlop={10} accessibilityLabel="Close">
              <Icon name="close" size={22} color={C.sub} />
            </TouchableOpacity>
          </View>
          {section ? (
            <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4 }}>
              <section.Body styles={styles} C={C} goTo={goTo} />
            </ScrollView>
          ) : (
            SECTIONS.map((s, i) => (
              <Pressable key={s.key} onPress={() => setOpen(s.key)}
                style={({ pressed }) => [styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: C.border }, pressed && { backgroundColor: C.bg }]}>
                <Icon name={s.icon} size={21} color={C.purple} />
                <Text style={[styles.label, { flex: 1 }]}>{s.label}</Text>
              </Pressable>
            ))
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const Poster = ({ item, C }) => (item.image
  ? <Image source={{ uri: item.image }} style={{ width: 38, height: 54, borderRadius: 6 }} />
  : <View style={{ width: 38, height: 54, borderRadius: 6, backgroundColor: C.border }} />);

// Finished shows you're watching again or catching up on: Rewatching, or
// Watching once its two weeks on Schedule are over. +1 for each episode; the
// last one moves it to Completed (with the verdict popup, like everywhere else).
function YoureWatching({ styles, C, goTo }) {
  const { user } = useAuth();
  const [list, setList] = useState(null);
  const [finishing, setFinishing] = useState(null);
  const refresh = useCallback(() => { getLibrary().then((lib) => setList(youreWatching(lib))).catch(() => setList([])); }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const plus = async (entry) => {
    const r = await setProgress(user, entry.item, (entry.progress || 0) + 1, "plus");
    if (r.reachedEnd) setFinishing(entry.item);
    refresh();
  };
  const finish = async ({ verdict, vibes, moods, comment }) => {
    await setStatus(user, finishing.segment, finishing, "completed");
    await addReview(user, finishing.segment, finishing.id, { verdict, vibes, moods, comment });
    setFinishing(null);
    refresh();
  };

  if (!list) return <SkeletonList rows={4} style={{ paddingHorizontal: 0 }} />;
  if (!list.length) {
    return <Text style={styles.note}>Nothing here yet. Finished shows you mark as Watching or Rewatching show up here, so they don't crowd your Schedule.</Text>;
  }
  return (
    <>
      <Text style={styles.note}>Shows that have finished airing and that you're watching or rewatching. New episodes of airing shows stay on your Schedule.</Text>
      <View style={{ paddingVertical: 6 }}>
        {list.map((entry, i) => {
          const { item } = entry;
          const total = totalFor(item);
          const done = total != null && (entry.progress || 0) >= total;
          return (
            <View key={item.id} style={[styles.entry, i > 0 && { borderTopWidth: 1, borderTopColor: C.border }]}>
              <TouchableOpacity style={styles.entryMain} onPress={() => goTo(item)}>
                <Poster item={item} C={C} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                  <Text style={styles.note} numberOfLines={1}>
                    {entry.status === "rewatching" ? "Rewatching" : "Watching"} · Ep {entry.progress || 0}{total ? ` of ${total}` : ""}
                  </Text>
                </View>
              </TouchableOpacity>
              {!done && (
                <TouchableOpacity onPress={() => plus(entry)} accessibilityLabel={`Watched episode ${(entry.progress || 0) + 1} of ${item.title}`}
                  style={{ borderWidth: 1, borderColor: C.orange, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 }}>
                  <Text style={{ fontSize: 12, fontWeight: "800", color: C.orange }}>+1</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </View>
      {finishing && <VerdictModal visible initial={null} onSave={finish} onClose={() => setFinishing(null)} />}
    </>
  );
}

// Anime announced on AniList this week. Each stays 7 days, then drops off.
function Announced({ styles, C, goTo }) {
  const { user } = useAuth();
  const [list, setList] = useState(null);
  const [excited, setExcited] = useState({});
  useEffect(() => {
    loadAnnounced().then(setList).catch(() => setList([]));
    getExcited().then(setExcited);
  }, []);
  if (!list) return <SkeletonList rows={5} style={{ paddingHorizontal: 0 }} />;
  if (!list.length) return <Text style={styles.note}>No new announcements in the last {ANNOUNCED_DAYS} days.</Text>;
  return (
    <>
      <Text style={styles.note}>Newly announced anime. Each one stays here for {ANNOUNCED_DAYS} days. Tap Excited to get it on your Schedule.</Text>
      <View style={{ paddingVertical: 6 }}>
        {list.map(({ item, seenAt }, i) => {
          const on = !!excited[`anime:${item.id}`];
          const left = daysLeft(seenAt);
          return (
            <View key={item.id} style={[styles.entry, i > 0 && { borderTopWidth: 1, borderTopColor: C.border }]}>
              <TouchableOpacity style={styles.entryMain} onPress={() => goTo(item)}>
                <Poster item={item} C={C} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                  <Text style={styles.note} numberOfLines={1}>
                    {item.date ? releaseLabel(item) : "Release date TBA"}{item.creator ? ` · ${item.creator}` : ""}
                  </Text>
                  <Text style={[styles.note, { fontSize: 10 }]}>{left} day{left === 1 ? "" : "s"} left here</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity onPress={async () => { await toggleExcited(user, item); setExcited(await getExcited()); }}
                style={{ borderWidth: 1, borderColor: C.orange, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: on ? C.orange : "transparent" }}>
                <Text style={{ fontSize: 11, fontWeight: "800", color: on ? "#fff" : C.orange }}>{on ? "Excited ✓" : "Excited?"}</Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
    </>
  );
}

const makeStyles = (C) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: 18 },
  popup: { backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: C.border, maxHeight: "82%", overflow: "hidden" },
  head: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14 },
  title: { flex: 1, color: C.text, fontSize: 18, fontWeight: "800" },
  row: { flexDirection: "row", alignItems: "center", gap: 18, paddingHorizontal: 20, paddingVertical: 16 },
  label: { color: C.text, fontSize: 16, fontWeight: "600" },
  note: { color: C.faint, fontSize: 12, lineHeight: 17 },
  cardTitle: { color: C.text, fontSize: 14, fontWeight: "700" },
  entry: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  entryMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
});
