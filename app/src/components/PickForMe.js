// "Pick for me": Voidmon picks one random title from the list you're looking
// at (Mihon has Random as a sort; a button that answers "what next?" is more
// useful). Open it, or ask for another one. Never picks the same title twice
// in a row.
import { useEffect, useState } from "react";
import { Modal, View, Text, Image, Pressable, TouchableOpacity, StyleSheet } from "react-native";
import { totalFor } from "@voidation/shared/backend/store";
import { useTheme } from "../context/ThemeContext.js";
import Voidmon from "./Voidmon.js";

const pickFrom = (list, not) => {
  const pool = list.length > 1 ? list.filter((e) => e !== not) : list;
  return pool[Math.floor(Math.random() * pool.length)] || null;
};

export default function PickForMe({ visible, entries, onOpen, onClose }) {
  const { C } = useTheme();
  const [pick, setPick] = useState(null);
  useEffect(() => { if (visible) setPick(pickFrom(entries, null)); }, [visible, entries]);
  if (!visible || !pick) return null;
  const item = pick.item;
  const total = totalFor(item);
  const unit = item.segment === "manga" ? "chapters" : "episodes";
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.box, { backgroundColor: C.card, borderColor: C.border }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Voidmon pose="asking" size={56} />
            <Text style={{ color: C.text, fontWeight: "800", fontSize: 16, flex: 1 }}>How about this one?</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 14, marginTop: 14 }}>
            <View style={styles.cover}>
              {item.image ? <Image source={{ uri: item.image }} style={StyleSheet.absoluteFill} /> : null}
            </View>
            <View style={{ flex: 1, minWidth: 0, justifyContent: "center", gap: 4 }}>
              <Text style={{ color: C.text, fontWeight: "900", fontSize: 18 }} numberOfLines={3}>{item.title}</Text>
              {!!item.genre && <Text style={{ color: C.sub, fontSize: 13 }} numberOfLines={1}>{item.genre}</Text>}
              {total ? <Text style={{ color: C.faint, fontSize: 12 }}>{total} {unit}</Text> : null}
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
            {entries.length > 1 && (
              <TouchableOpacity onPress={() => setPick(pickFrom(entries, pick))} style={[styles.btn, { borderColor: C.border }]} accessibilityRole="button">
                <Text style={{ color: C.text, fontWeight: "800" }}>Another one</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => onOpen(item)} style={[styles.btn, { backgroundColor: C.purple, borderColor: C.purple }]} accessibilityRole="button">
              <Text style={{ color: "#fff", fontWeight: "800" }}>Open</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: 20 },
  box: { borderRadius: 18, borderWidth: 1, padding: 16, maxWidth: 440, width: "100%", alignSelf: "center" },
  cover: { width: 96, aspectRatio: 2 / 3, borderRadius: 10, overflow: "hidden", backgroundColor: "rgba(127,127,127,0.2)" },
  btn: { flex: 1, height: 44, borderRadius: 11, borderWidth: 1, alignItems: "center", justifyContent: "center" },
});
